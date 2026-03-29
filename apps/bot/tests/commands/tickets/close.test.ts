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
const mockCloseTicket = vi.fn().mockResolvedValue({});
vi.mock("@fluxcore/systems/tickets/persistence", () => ({
  getTicketByChannel: (...args: unknown[]) => mockGetTicketByChannel(...args),
  closeTicket: (...args: unknown[]) => mockCloseTicket(...args),
}));

const mockGetTicketSettings = vi.fn().mockResolvedValue({
  guildId: "guild-1",
  staffRoleIds: [],
  transcriptChannelId: null,
  maxOpenPerUser: 3,
  autoCloseHours: 0,
  namingFormat: "ticket-{number}",
  ticketCounter: 0,
});
vi.mock("@fluxcore/systems/tickets/config", () => ({
  getTicketSettings: (...args: unknown[]) => mockGetTicketSettings(...args),
}));

vi.mock("@fluxcore/systems/tickets/transcript", () => ({
  buildTranscriptHtml: vi.fn().mockReturnValue("<html></html>"),
}));

vi.mock("@fluxcore/systems/tickets/constants", () => ({
  TRANSCRIPT_FETCH_LIMIT: 100,
}));

const closeModule = await import("../../../src/commands/tickets/close.js");
const command = closeModule.default;

function createMockInteraction({
  channelId = "channel-1",
  guildId = "guild-1" as string | null,
  reason = null as string | null,
} = {}) {
  return {
    options: {
      getString: vi.fn().mockReturnValue(reason),
    },
    user: { id: "user-1", displayName: "TestUser" },
    guildId,
    guild: {
      name: "Test Guild",
      channels: { cache: { get: vi.fn().mockReturnValue(null) } },
    },
    channelId,
    channel: {
      messages: { fetch: vi.fn().mockResolvedValue(new Map()) },
      delete: vi.fn(),
    },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
    replied: false,
    deferred: false,
  };
}

describe("ticket-close command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTicketByChannel.mockResolvedValue(null);
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("ticket-close");
    expect(command.category).toBe("Tickets");
  });

  it("rejects when used outside a guild", async () => {
    const interaction = createMockInteraction({ guildId: null });
    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("rejects when channel is not a ticket", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce(null);
    const interaction = createMockInteraction();
    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects when ticket is already closed", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "closed",
      channelId: "channel-1",
      userId: "user-1",
    });
    const interaction = createMockInteraction();
    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("closes ticket on valid request", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "open",
      channelId: "channel-1",
      userId: "user-1",
    });
    mockCloseTicket.mockResolvedValueOnce({
      id: 1,
      status: "closed",
    });

    const interaction = createMockInteraction({ reason: "resolved" });
    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockCloseTicket).toHaveBeenCalledWith(1, "resolved", undefined);
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("handles errors gracefully", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "open",
      channelId: "channel-1",
      userId: "user-1",
    });
    mockCloseTicket.mockRejectedValueOnce(new Error("DB error"));

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalled();
  });
});
