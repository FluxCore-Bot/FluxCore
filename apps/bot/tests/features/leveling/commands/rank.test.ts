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

const mockGetUserLevel = vi.fn().mockResolvedValue(null);
const mockGetUserRank = vi.fn().mockResolvedValue(0);
const mockGetLeaderboard = vi.fn().mockResolvedValue({ entries: [], total: 0 });
vi.mock("@fluxcore/systems/leveling/persistence", () => ({
  getUserLevel: (...args: unknown[]) => mockGetUserLevel(...args),
  getUserRank: (...args: unknown[]) => mockGetUserRank(...args),
  getLeaderboard: (...args: unknown[]) => mockGetLeaderboard(...args),
}));

vi.mock("@fluxcore/systems/leveling/xp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/systems/leveling/xp")>();
  return actual;
});

vi.mock("@fluxcore/systems/leveling/constants", () => ({
  LEADERBOARD_PAGE_SIZE: 10,
}));

const rankModule = await import("../../../../src/features/leveling/commands/rank.js");
const command = rankModule.default;

function createMockInteraction({
  targetUser = null,
}: {
  targetUser?: { id: string; displayName: string; displayAvatarURL: () => string } | null;
} = {}) {
  const selfUser = {
    id: "self-123",
    displayName: "SelfUser",
    displayAvatarURL: vi.fn().mockReturnValue("https://example.com/avatar.png"),
  };
  return {
    options: {
      getUser: vi.fn().mockReturnValue(targetUser),
    },
    user: selfUser,
    guildId: "guild-789",
    guild: { name: "Test Guild" },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("rank command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserLevel.mockResolvedValue(null);
    mockGetUserRank.mockResolvedValue(0);
    mockGetLeaderboard.mockResolvedValue({ entries: [], total: 0 });
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("rank");
    expect(command.category).toBe("Leveling");
  });

  it("shows rank for self when no user specified", async () => {
    mockGetUserLevel.mockResolvedValueOnce({
      xp: 500,
      level: 3,
      messageCount: 42,
      voiceMinutes: 120,
    });
    mockGetUserRank.mockResolvedValueOnce(5);
    mockGetLeaderboard.mockResolvedValueOnce({ entries: [], total: 100 });

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockGetUserLevel).toHaveBeenCalledWith("guild-789", "self-123");
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("shows rank for specified user", async () => {
    const target = {
      id: "other-456",
      displayName: "OtherUser",
      displayAvatarURL: vi.fn().mockReturnValue("https://example.com/avatar2.png"),
    };

    mockGetUserLevel.mockResolvedValueOnce({
      xp: 1000,
      level: 5,
      messageCount: 100,
      voiceMinutes: 60,
    });
    mockGetUserRank.mockResolvedValueOnce(2);
    mockGetLeaderboard.mockResolvedValueOnce({ entries: [], total: 50 });

    const interaction = createMockInteraction({ targetUser: target });
    await command.execute(interaction as never);

    expect(mockGetUserLevel).toHaveBeenCalledWith("guild-789", "other-456");
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("shows defaults for user with no XP", async () => {
    mockGetUserLevel.mockResolvedValueOnce(null);
    mockGetUserRank.mockResolvedValueOnce(0);
    mockGetLeaderboard.mockResolvedValueOnce({ entries: [], total: 0 });

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("rejects when used outside a guild", async () => {
    const interaction = createMockInteraction();
    (interaction as Record<string, unknown>).guildId = null;

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("handles errors gracefully", async () => {
    mockGetUserLevel.mockRejectedValueOnce(new Error("DB error"));

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalled();
  });
});
