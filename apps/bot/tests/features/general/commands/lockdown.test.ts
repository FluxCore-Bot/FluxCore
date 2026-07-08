import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config
vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

// Mock permissions
const mockCheckPermissions = vi.fn().mockResolvedValue(true);
const mockCheckBotPermissions = vi.fn().mockResolvedValue(true);
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    checkBotPermissions: (...args: unknown[]) => mockCheckBotPermissions(...args),
  };
});

const mockIsLockdownActive = vi.fn().mockReturnValue(false);
vi.mock("@fluxcore/systems/antiraid/tracker", () => ({
  isLockdownActive: (...args: unknown[]) => mockIsLockdownActive(...args),
}));

const mockLockdownGuild = vi.fn().mockResolvedValue(5);
const mockLiftLockdown = vi.fn().mockResolvedValue(5);
vi.mock("@fluxcore/systems/antiraid/actions", () => ({
  lockdownGuild: (...args: unknown[]) => mockLockdownGuild(...args),
  liftLockdown: (...args: unknown[]) => mockLiftLockdown(...args),
}));

const mockCreateRaidEvent = vi.fn().mockResolvedValue({});
vi.mock("@fluxcore/systems/antiraid/persistence", () => ({
  createRaidEvent: (...args: unknown[]) => mockCreateRaidEvent(...args),
}));

const lockdownModule = await import("../../../../src/features/general/commands/lockdown.js");
const command = lockdownModule.default;

function createMockInteraction({
  subcommand = "activate",
  reason = null,
}: {
  subcommand?: string;
  reason?: string | null;
} = {}) {
  return {
    options: {
      getSubcommand: vi.fn().mockReturnValue(subcommand),
      getString: vi.fn((name: string) => {
        if (name === "reason") return reason;
        return null;
      }),
    },
    guild: {
      id: "guild-789",
      channels: { cache: new Map() },
      roles: { everyone: { id: "everyone-role" } },
    },
    guildId: "guild-789",
    user: { id: "user-123" },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("lockdown command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("lockdown");
    expect(command.category).toBe("Admin");
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("activates lockdown successfully", async () => {
    mockIsLockdownActive.mockReturnValueOnce(false);
    const interaction = createMockInteraction({ subcommand: "activate", reason: "Test raid" });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockLockdownGuild).toHaveBeenCalledWith(interaction.guild, "Test raid");
    expect(mockCreateRaidEvent).toHaveBeenCalledWith(
      "guild-789",
      "lockdown",
      expect.objectContaining({ action: "activate" }),
    );
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("rejects activate when already locked down", async () => {
    mockIsLockdownActive.mockReturnValueOnce(true);
    const interaction = createMockInteraction({ subcommand: "activate" });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(mockLockdownGuild).not.toHaveBeenCalled();
  });

  it("lifts lockdown successfully", async () => {
    mockIsLockdownActive.mockReturnValueOnce(true);
    const interaction = createMockInteraction({ subcommand: "lift" });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockLiftLockdown).toHaveBeenCalledWith(interaction.guild);
    expect(mockCreateRaidEvent).toHaveBeenCalledWith(
      "guild-789",
      "lockdown",
      expect.objectContaining({ action: "lift" }),
    );
  });

  it("rejects lift when not locked down", async () => {
    mockIsLockdownActive.mockReturnValueOnce(false);
    const interaction = createMockInteraction({ subcommand: "lift" });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(mockLiftLockdown).not.toHaveBeenCalled();
  });

  it("uses default reason when none provided", async () => {
    mockIsLockdownActive.mockReturnValueOnce(false);
    const interaction = createMockInteraction({ subcommand: "activate" });

    await command.execute(interaction as never);

    expect(mockLockdownGuild).toHaveBeenCalledWith(interaction.guild, "Manual lockdown");
  });
});
