import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const mockCheckPermissions = vi.fn().mockResolvedValue(true);
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
  };
});

const mockSetXp = vi.fn().mockResolvedValue({ leveledUp: false, newLevel: 5, oldLevel: 5, totalXp: 1000 });
const mockAddXp = vi.fn().mockResolvedValue({ leveledUp: false, newLevel: 5, oldLevel: 5, totalXp: 1000 });
const mockGetUserLevel = vi.fn().mockResolvedValue({ xp: 500, level: 3 });
vi.mock("@fluxcore/systems/leveling/persistence", () => ({
  setXp: (...args: unknown[]) => mockSetXp(...args),
  addXp: (...args: unknown[]) => mockAddXp(...args),
  getUserLevel: (...args: unknown[]) => mockGetUserLevel(...args),
}));

const mockCheckAndGrantRewards = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/leveling/rewards", () => ({
  checkAndGrantRewards: (...args: unknown[]) => mockCheckAndGrantRewards(...args),
}));

vi.mock("@fluxcore/systems/leveling/xp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/systems/leveling/xp")>();
  return actual;
});

const xpModule = await import("../../../../src/features/leveling/commands/xp.js");
const command = xpModule.default;

function createMockInteraction({
  subcommand = "set",
  amount = 100,
}: {
  subcommand?: string;
  amount?: number;
} = {}) {
  return {
    options: {
      getSubcommand: vi.fn().mockReturnValue(subcommand),
      getUser: vi.fn().mockReturnValue({
        id: "target-456",
        displayName: "TargetUser",
      }),
      getInteger: vi.fn((name: string) => {
        if (name === "amount") return amount;
        return null;
      }),
    },
    user: { id: "actor-123" },
    member: { permissions: { has: vi.fn().mockReturnValue(true) } },
    guildId: "guild-789",
    guild: { name: "Test Guild" },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("xp command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermissions.mockResolvedValue(true);
    mockSetXp.mockResolvedValue({ leveledUp: false, newLevel: 5, oldLevel: 5, totalXp: 1000 });
    mockAddXp.mockResolvedValue({ leveledUp: false, newLevel: 5, oldLevel: 5, totalXp: 1000 });
    mockGetUserLevel.mockResolvedValue({ xp: 500, level: 3 });
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("xp");
    expect(command.category).toBe("Leveling");
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(mockSetXp).not.toHaveBeenCalled();
  });

  it("sets XP correctly", async () => {
    mockSetXp.mockResolvedValueOnce({
      leveledUp: false,
      newLevel: 5,
      oldLevel: 5,
      totalXp: 500,
    });

    const interaction = createMockInteraction({ subcommand: "set", amount: 500 });
    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockSetXp).toHaveBeenCalledWith("guild-789", "target-456", 500);
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("adds XP correctly", async () => {
    mockAddXp.mockResolvedValueOnce({
      leveledUp: true,
      newLevel: 6,
      oldLevel: 5,
      totalXp: 1500,
    });

    const interaction = createMockInteraction({ subcommand: "add", amount: 200 });
    await command.execute(interaction as never);

    expect(mockAddXp).toHaveBeenCalledWith("guild-789", "target-456", 200);
    expect(mockCheckAndGrantRewards).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("removes XP correctly (clamps to 0)", async () => {
    mockGetUserLevel.mockResolvedValueOnce({ xp: 50, level: 0 });
    mockSetXp.mockResolvedValueOnce({
      leveledUp: false,
      newLevel: 0,
      oldLevel: 0,
      totalXp: 0,
    });

    const interaction = createMockInteraction({ subcommand: "remove", amount: 100 });
    await command.execute(interaction as never);

    // Should clamp to 0 (50 - 100 = -50, clamped to 0)
    expect(mockSetXp).toHaveBeenCalledWith("guild-789", "target-456", 0);
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("checks rewards after XP change", async () => {
    const interaction = createMockInteraction({ subcommand: "set", amount: 1000 });
    await command.execute(interaction as never);

    expect(mockCheckAndGrantRewards).toHaveBeenCalled();
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
    mockSetXp.mockRejectedValueOnce(new Error("DB error"));

    const interaction = createMockInteraction({ subcommand: "set", amount: 100 });
    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalled();
  });
});
