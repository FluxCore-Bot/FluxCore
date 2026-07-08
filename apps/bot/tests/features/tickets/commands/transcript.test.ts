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

vi.mock("@fluxcore/systems/tickets/transcript", () => ({
  buildTranscriptHtml: vi.fn().mockReturnValue("<html>transcript</html>"),
}));

vi.mock("@fluxcore/systems/tickets/constants", () => ({
  TRANSCRIPT_FETCH_LIMIT: 100,
}));

const transcriptModule = await import("../../../../src/features/tickets/commands/transcript.js");
const command = transcriptModule.default;

function createMockInteraction({
  channelId = "channel-1",
  guildId = "guild-1" as string | null,
} = {}) {
  const messageValues = [
    {
      author: {
        displayName: "TestUser",
        username: "testuser",
        id: "user-1",
        displayAvatarURL: vi.fn().mockReturnValue("https://example.com/avatar.png"),
      },
      content: "Hello!",
      createdAt: new Date(),
      // Discord.js exposes attachments as a Collection (has .map())
      attachments: Object.assign(new Map(), { map: () => [] as string[] }),
    },
  ];

  // Discord.js fetch() returns a Collection; .reverse() returns a Collection
  // whose .map() iterates over the message values.
  const mockCollection = {
    size: messageValues.length,
    reverse: vi.fn().mockReturnThis(),
    map: <T>(fn: (value: (typeof messageValues)[number]) => T): T[] =>
      messageValues.map(fn),
  };

  return {
    options: {},
    user: { id: "user-1", displayName: "TestUser" },
    guildId,
    guild: { name: "Test Guild" },
    channelId,
    channel: {
      messages: {
        fetch: vi.fn().mockResolvedValue(mockCollection),
      },
    },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
    replied: false,
    deferred: false,
  };
}

describe("ticket-transcript command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTicketByChannel.mockResolvedValue(null);
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("ticket-transcript");
    expect(command.category).toBe("Tickets");
    expect(command.cooldown).toBe(10);
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

  it("generates transcript for valid ticket", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "open",
      channelId: "channel-1",
      userId: "user-1",
      categoryName: "support",
      createdAt: new Date(),
      closedAt: null,
      closeReason: null,
    });

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.arrayContaining([expect.anything()]),
      }),
    );
  });
});
