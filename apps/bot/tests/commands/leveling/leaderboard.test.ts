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
  return actual;
});

const mockGetLeaderboard = vi.fn().mockResolvedValue({ entries: [], total: 0 });
vi.mock("@fluxcore/systems/leveling/persistence", () => ({
  getLeaderboard: (...args: unknown[]) => mockGetLeaderboard(...args),
}));

vi.mock("@fluxcore/systems/leveling/constants", () => ({
  LEADERBOARD_PAGE_SIZE: 10,
}));

const leaderboardModule = await import("../../../src/commands/leveling/leaderboard.js");
const command = leaderboardModule.default;

function createMockInteraction({ page = null }: { page?: number | null } = {}) {
  return {
    options: {
      getInteger: vi.fn((name: string) => {
        if (name === "page") return page;
        return null;
      }),
    },
    user: { id: "user-123" },
    guildId: "guild-789",
    guild: { name: "Test Guild" },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("leaderboard command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLeaderboard.mockResolvedValue({ entries: [], total: 0 });
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("leaderboard");
    expect(command.category).toBe("Leveling");
  });

  it("shows empty state when no one has XP", async () => {
    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("shows leaderboard with entries", async () => {
    mockGetLeaderboard.mockResolvedValueOnce({
      entries: [
        { userId: "user-1", level: 10, xp: 5000 },
        { userId: "user-2", level: 8, xp: 3000 },
        { userId: "user-3", level: 5, xp: 1500 },
      ],
      total: 3,
    });

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(mockGetLeaderboard).toHaveBeenCalledWith("guild-789", 1, 10);
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("uses the specified page number", async () => {
    mockGetLeaderboard.mockResolvedValueOnce({
      entries: [{ userId: "user-11", level: 2, xp: 300 }],
      total: 15,
    });

    const interaction = createMockInteraction({ page: 2 });
    await command.execute(interaction as never);

    expect(mockGetLeaderboard).toHaveBeenCalledWith("guild-789", 2, 10);
  });

  it("defaults to page 1 when no page specified", async () => {
    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(mockGetLeaderboard).toHaveBeenCalledWith("guild-789", 1, 10);
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
    mockGetLeaderboard.mockRejectedValueOnce(new Error("DB error"));

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalled();
  });
});
