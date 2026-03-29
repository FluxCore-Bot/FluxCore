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
  };
});

const mockGetSuggestionSettings = vi.fn();
const mockCreateSuggestion = vi.fn();
const mockUpdateSuggestionMessageId = vi.fn();

vi.mock("@fluxcore/systems/suggestions/config", () => ({
  getSuggestionSettings: (...args: unknown[]) => mockGetSuggestionSettings(...args),
}));

vi.mock("@fluxcore/systems/suggestions/persistence", () => ({
  createSuggestion: (...args: unknown[]) => mockCreateSuggestion(...args),
  updateSuggestionMessageId: (...args: unknown[]) => mockUpdateSuggestionMessageId(...args),
}));

vi.mock("@fluxcore/systems/suggestions/constants", () => ({
  STATUS_COLORS: { pending: 0xffa500, approved: 0x57f287, denied: 0xed4245, implemented: 0x5865f2 },
  MAX_SUGGESTION_LENGTH: 2000,
}));

const suggestModule = await import("../../../src/commands/suggestions/suggest.js");
const command = suggestModule.default;

function createMockInteraction({
  guildId = "guild-123",
  text = "Add a music channel",
}: {
  guildId?: string | null;
  text?: string;
} = {}) {
  const mockReact = vi.fn();
  const mockStartThread = vi.fn();
  const mockSend = vi.fn().mockResolvedValue({
    id: "msg-456",
    react: mockReact,
    startThread: mockStartThread,
  });

  const mockChannel = {
    id: "channel-789",
    type: 0, // GuildText
    send: mockSend,
  };

  return {
    options: {
      getString: vi.fn().mockReturnValue(text),
    },
    user: {
      id: "user-111",
      displayName: "TestUser",
      displayAvatarURL: vi.fn().mockReturnValue("https://example.com/avatar.png"),
    },
    guildId,
    guild: {
      channels: {
        cache: {
          get: vi.fn().mockReturnValue(mockChannel),
        },
      },
    },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
    _mockChannel: mockChannel,
    _mockSend: mockSend,
    _mockReact: mockReact,
    _mockStartThread: mockStartThread,
  };
}

describe("suggest command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSuggestionSettings.mockResolvedValue({
      guildId: "guild-123",
      enabled: true,
      channelId: "channel-789",
      reviewChannelId: null,
      dmOnStatusChange: true,
      autoThread: false,
      anonymousMode: false,
    });
    mockCreateSuggestion.mockResolvedValue({
      id: 42,
      guildId: "guild-123",
      userId: "user-111",
      content: "Add a music channel",
      status: "pending",
      createdAt: new Date(),
    });
    mockUpdateSuggestionMessageId.mockResolvedValue(undefined);
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("suggest");
    expect(command.category).toBe("Suggestions");
  });

  it("rejects when used outside a guild", async () => {
    const interaction = createMockInteraction({ guildId: null });
    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("rejects when suggestions are disabled", async () => {
    mockGetSuggestionSettings.mockResolvedValueOnce({
      guildId: "guild-123",
      enabled: false,
      channelId: "channel-789",
    });

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects when no channel is configured", async () => {
    mockGetSuggestionSettings.mockResolvedValueOnce({
      guildId: "guild-123",
      enabled: true,
      channelId: null,
    });

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("creates suggestion and posts embed on happy path", async () => {
    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(mockCreateSuggestion).toHaveBeenCalledWith("guild-123", "user-111", "Add a music channel");
    expect(interaction._mockSend).toHaveBeenCalled();
    expect(interaction._mockReact).toHaveBeenCalledTimes(2);
    expect(mockUpdateSuggestionMessageId).toHaveBeenCalledWith(42, "msg-456");
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("creates thread when autoThread is enabled", async () => {
    mockGetSuggestionSettings.mockResolvedValueOnce({
      guildId: "guild-123",
      enabled: true,
      channelId: "channel-789",
      reviewChannelId: null,
      dmOnStatusChange: true,
      autoThread: true,
      anonymousMode: false,
    });

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction._mockStartThread).toHaveBeenCalledWith({
      name: "Discussion: Suggestion #42",
    });
  });

  it("handles errors gracefully", async () => {
    mockCreateSuggestion.mockRejectedValueOnce(new Error("DB error"));

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalled();
  });
});
