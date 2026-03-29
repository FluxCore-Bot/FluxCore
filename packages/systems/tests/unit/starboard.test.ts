import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/database", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { DEFAULT_SETTINGS, DEFAULT_EMOJI, DEFAULT_THRESHOLD, STARBOARD_PAGE_SIZE } from "../../src/starboard/constants.js";
import type { StarboardGuildSettings } from "../../src/starboard/types.js";

describe("starboard constants", () => {
  it("has correct default emoji", () => {
    expect(DEFAULT_EMOJI).toBe("\u2B50");
  });

  it("has correct default threshold", () => {
    expect(DEFAULT_THRESHOLD).toBe(3);
  });

  it("has correct page size", () => {
    expect(STARBOARD_PAGE_SIZE).toBe(20);
  });

  it("DEFAULT_SETTINGS has expected shape", () => {
    expect(DEFAULT_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_SETTINGS.channelId).toBeNull();
    expect(DEFAULT_SETTINGS.emoji).toBe("\u2B50");
    expect(DEFAULT_SETTINGS.threshold).toBe(3);
    expect(DEFAULT_SETTINGS.selfStar).toBe(false);
    expect(DEFAULT_SETTINGS.ignoredChannels).toEqual([]);
    expect(DEFAULT_SETTINGS.nsfwHandling).toBe("ignore");
  });
});

describe("starboard types", () => {
  it("StarboardGuildSettings interface is properly typed", () => {
    const settings: StarboardGuildSettings = {
      guildId: "guild-1",
      enabled: true,
      channelId: "ch-1",
      emoji: "\u2B50",
      threshold: 5,
      selfStar: false,
      ignoredChannels: ["ch-2", "ch-3"],
      nsfwHandling: "ignore",
    };

    expect(settings.guildId).toBe("guild-1");
    expect(settings.enabled).toBe(true);
    expect(settings.channelId).toBe("ch-1");
    expect(settings.threshold).toBe(5);
    expect(settings.ignoredChannels).toHaveLength(2);
  });

  it("StarboardGuildSettings allows null channelId", () => {
    const settings: StarboardGuildSettings = {
      guildId: "guild-1",
      enabled: false,
      channelId: null,
      emoji: "\u2B50",
      threshold: 3,
      selfStar: false,
      ignoredChannels: [],
      nsfwHandling: "separate",
    };

    expect(settings.channelId).toBeNull();
    expect(settings.nsfwHandling).toBe("separate");
  });
});

describe("starboard handler", () => {
  // Mock all dependencies before importing handler
  const mockGetStarboardSettings = vi.fn();
  const mockGetStarboardEntry = vi.fn();
  const mockUpsertStarboardEntry = vi.fn();
  const mockDeleteStarboardEntry = vi.fn();

  vi.mock("../../src/starboard/config.js", () => ({
    getStarboardSettings: (...args: unknown[]) => mockGetStarboardSettings(...args),
  }));

  vi.mock("../../src/starboard/persistence.js", () => ({
    getStarboardEntry: (...args: unknown[]) => mockGetStarboardEntry(...args),
    upsertStarboardEntry: (...args: unknown[]) => mockUpsertStarboardEntry(...args),
    deleteStarboardEntry: (...args: unknown[]) => mockDeleteStarboardEntry(...args),
  }));

  // Import after mocks
  const handlerModule = await import("../../src/starboard/handler.js");
  const { handleStarboardReaction } = handlerModule;

  function createMockReaction({
    emojiName = "\u2B50",
    emojiId = null as string | null,
    count = 3,
    guildId = "guild-1",
    channelId = "ch-1",
    messageId = "msg-1",
    authorId = "author-1",
    authorBot = false,
    isPartial = false,
    isNsfw = false,
    cachedUsers = [] as string[],
  } = {}) {
    const usersCache = new Map<string, boolean>();
    for (const uid of cachedUsers) {
      usersCache.set(uid, true);
    }

    return {
      partial: isPartial,
      fetch: vi.fn().mockResolvedValue(undefined),
      emoji: { name: emojiName, id: emojiId },
      count,
      users: {
        cache: {
          has: (id: string) => usersCache.has(id),
        },
        fetch: vi.fn().mockResolvedValue(usersCache),
      },
      message: {
        partial: false,
        fetch: vi.fn(),
        id: messageId,
        channelId,
        guildId,
        content: "Hello world!",
        createdAt: new Date(),
        author: {
          id: authorId,
          bot: authorBot,
          tag: "TestUser#0001",
          displayAvatarURL: () => "https://cdn.example.com/avatar.png",
        },
        guild: {
          id: guildId,
          channels: {
            fetch: vi.fn(),
          },
        },
        channel: {
          nsfw: isNsfw,
        },
        attachments: new Map(),
        embeds: [],
      },
    };
  }

  function createMockUser({ bot = false, id = "user-1" } = {}) {
    return { bot, id };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStarboardSettings.mockResolvedValue({
      guildId: "guild-1",
      enabled: true,
      channelId: "starboard-ch",
      emoji: "\u2B50",
      threshold: 3,
      selfStar: false,
      ignoredChannels: [],
      nsfwHandling: "ignore",
    });
    mockGetStarboardEntry.mockResolvedValue(null);
    mockUpsertStarboardEntry.mockResolvedValue({});
    mockDeleteStarboardEntry.mockResolvedValue(undefined);
  });

  it("ignores reactions from bots", async () => {
    const reaction = createMockReaction();
    const user = createMockUser({ bot: true });

    await handleStarboardReaction(reaction as never, user as never);

    expect(mockGetStarboardSettings).not.toHaveBeenCalled();
  });

  it("ignores reactions when starboard is disabled", async () => {
    mockGetStarboardSettings.mockResolvedValueOnce({
      enabled: false,
      channelId: "starboard-ch",
      emoji: "\u2B50",
      threshold: 3,
    });

    const reaction = createMockReaction();
    const user = createMockUser();

    await handleStarboardReaction(reaction as never, user as never);

    expect(mockGetStarboardEntry).not.toHaveBeenCalled();
  });

  it("ignores reactions when no starboard channel configured", async () => {
    mockGetStarboardSettings.mockResolvedValueOnce({
      enabled: true,
      channelId: null,
      emoji: "\u2B50",
      threshold: 3,
    });

    const reaction = createMockReaction();
    const user = createMockUser();

    await handleStarboardReaction(reaction as never, user as never);

    expect(mockGetStarboardEntry).not.toHaveBeenCalled();
  });

  it("ignores non-matching emoji", async () => {
    const reaction = createMockReaction({ emojiName: "\uD83D\uDC4D" });
    const user = createMockUser();

    await handleStarboardReaction(reaction as never, user as never);

    expect(mockGetStarboardEntry).not.toHaveBeenCalled();
  });

  it("ignores bot messages", async () => {
    const reaction = createMockReaction({ authorBot: true });
    const user = createMockUser();

    await handleStarboardReaction(reaction as never, user as never);

    expect(mockGetStarboardEntry).not.toHaveBeenCalled();
  });

  it("ignores messages in ignored channels", async () => {
    mockGetStarboardSettings.mockResolvedValueOnce({
      enabled: true,
      channelId: "starboard-ch",
      emoji: "\u2B50",
      threshold: 3,
      selfStar: false,
      ignoredChannels: ["ch-1"],
      nsfwHandling: "ignore",
    });

    const reaction = createMockReaction({ channelId: "ch-1" });
    const user = createMockUser();

    await handleStarboardReaction(reaction as never, user as never);

    expect(mockGetStarboardEntry).not.toHaveBeenCalled();
  });

  it("ignores NSFW channels when nsfwHandling is ignore", async () => {
    const reaction = createMockReaction({ isNsfw: true });
    const user = createMockUser();

    await handleStarboardReaction(reaction as never, user as never);

    expect(mockGetStarboardEntry).not.toHaveBeenCalled();
  });

  it("ignores reactions without a guild", async () => {
    const reaction = createMockReaction();
    (reaction.message as Record<string, unknown>).guild = null;
    const user = createMockUser();

    await handleStarboardReaction(reaction as never, user as never);

    expect(mockGetStarboardSettings).not.toHaveBeenCalled();
  });

  it("creates starboard entry when threshold is met", async () => {
    const mockSend = vi.fn().mockResolvedValue({ id: "star-msg-1" });
    const mockChannelFetch = vi.fn().mockResolvedValue({
      isTextBased: () => true,
      send: mockSend,
    });

    const reaction = createMockReaction({ count: 3 });
    (reaction.message.guild as Record<string, unknown>).channels = { fetch: mockChannelFetch };
    const user = createMockUser();

    await handleStarboardReaction(reaction as never, user as never);

    expect(mockUpsertStarboardEntry).toHaveBeenCalledWith(
      "guild-1",
      "msg-1",
      expect.objectContaining({
        originalChannelId: "ch-1",
        authorId: "author-1",
        starCount: 3,
        starboardMessageId: "star-msg-1",
      }),
    );
  });

  it("deletes entry when star count drops below threshold", async () => {
    mockGetStarboardEntry.mockResolvedValueOnce({
      id: 1,
      guildId: "guild-1",
      originalMessageId: "msg-1",
      starboardMessageId: "star-msg-1",
      starCount: 3,
    });

    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockMsgFetch = vi.fn().mockResolvedValue({ delete: mockDelete });
    const mockChannelFetch = vi.fn().mockResolvedValue({
      isTextBased: () => true,
      messages: { fetch: mockMsgFetch },
    });

    const reaction = createMockReaction({ count: 2 });
    (reaction.message.guild as Record<string, unknown>).channels = { fetch: mockChannelFetch };
    const user = createMockUser();

    await handleStarboardReaction(reaction as never, user as never);

    expect(mockDeleteStarboardEntry).toHaveBeenCalledWith("guild-1", "msg-1");
  });
});
