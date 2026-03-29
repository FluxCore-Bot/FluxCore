import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

const mockGetTicketByChannel = vi.fn().mockResolvedValue(null);
vi.mock("@fluxcore/systems/tickets/persistence", () => ({
  getTicketByChannel: (...args: unknown[]) => mockGetTicketByChannel(...args),
}));

const addModule = await import("../../../src/commands/tickets/add.js");
const command = addModule.default;

function createMockInteraction({
  channelId = "channel-1",
  guildId = "guild-1" as string | null,
  targetUser = { id: "target-1" },
} = {}) {
  const mockPermissionOverwrites = { create: vi.fn() };
  return {
    options: {
      getUser: vi.fn().mockReturnValue(targetUser),
    },
    user: { id: "user-1", displayName: "TestUser" },
    guildId,
    guild: { name: "Test Guild" },
    channelId,
    channel: {
      permissionOverwrites: mockPermissionOverwrites,
    },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
    replied: false,
    deferred: false,
  };
}

describe("ticket-add command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTicketByChannel.mockResolvedValue(null);
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("ticket-add");
    expect(command.category).toBe("Tickets");
  });

  it("rejects when used outside a guild", async () => {
    const interaction = createMockInteraction({ guildId: null });
    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects when channel is not a ticket", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce(null);
    const interaction = createMockInteraction();
    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects when ticket is closed", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "closed",
      channelId: "channel-1",
    });
    const interaction = createMockInteraction();
    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("adds user to ticket on valid request", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "open",
      channelId: "channel-1",
      userId: "user-1",
    });

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.channel.permissionOverwrites.create).toHaveBeenCalledWith(
      "target-1",
      expect.objectContaining({ ViewChannel: true, SendMessages: true }),
    );
    expect(interaction.reply).toHaveBeenCalled();
  });

  it("handles permission errors gracefully", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "open",
      channelId: "channel-1",
      userId: "user-1",
    });

    const interaction = createMockInteraction();
    interaction.channel.permissionOverwrites.create.mockRejectedValueOnce(
      new Error("Missing permissions"),
    );

    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });
});
