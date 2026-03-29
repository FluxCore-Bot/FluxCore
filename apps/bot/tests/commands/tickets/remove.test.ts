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

const removeModule = await import("../../../src/commands/tickets/remove.js");
const command = removeModule.default;

function createMockInteraction({
  channelId = "channel-1",
  guildId = "guild-1" as string | null,
  targetUser = { id: "target-1" },
} = {}) {
  const mockPermissionOverwrites = { delete: vi.fn() };
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

describe("ticket-remove command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTicketByChannel.mockResolvedValue(null);
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("ticket-remove");
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

  it("rejects removing the ticket creator", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "open",
      channelId: "channel-1",
      userId: "target-1",
    });

    const interaction = createMockInteraction({ targetUser: { id: "target-1" } });
    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("removes user from ticket on valid request", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "open",
      channelId: "channel-1",
      userId: "user-1",
    });

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.channel.permissionOverwrites.delete).toHaveBeenCalledWith("target-1");
    expect(interaction.reply).toHaveBeenCalled();
  });
});
