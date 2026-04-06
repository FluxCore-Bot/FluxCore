import { describe, it, expect, vi } from "vitest";

// Mock config
vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

// Mock moderation persistence
const mockCreateModCase = vi.fn().mockResolvedValue({ id: 1 });
const mockGetModSettings = vi.fn().mockResolvedValue({ dmOnPunishment: false, modLogChannelId: null });
vi.mock("@fluxcore/systems/moderation/persistence", () => ({
  createModCase: (...args: unknown[]) => mockCreateModCase(...args),
  getModSettings: (...args: unknown[]) => mockGetModSettings(...args),
}));

// Mock DM helper
vi.mock("@fluxcore/systems/moderation/dm", () => ({
  dmOnPunishment: vi.fn().mockResolvedValue(true),
}));

// Mock permissions
const mockCheckPermissions = vi.fn().mockResolvedValue(true);
const mockCheckBotPermissions = vi.fn().mockResolvedValue(true);
const mockIsAboveTarget = vi.fn().mockReturnValue(true);
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    checkBotPermissions: (...args: unknown[]) => mockCheckBotPermissions(...args),
    isAboveTarget: (...args: unknown[]) => mockIsAboveTarget(...args),
  };
});

const softbanModule = await import("../../../../src/features/moderation/commands/softban.js");
const command = softbanModule.default;

function createMockInteraction({
  targetMember = createMockMember(),
  reason = null,
}: {
  targetMember?: ReturnType<typeof createMockMember> | null;
  reason?: string | null;
} = {}) {
  return {
    options: {
      getMember: vi.fn().mockReturnValue(targetMember),
      getString: vi.fn((name: string) => {
        if (name === "reason") return reason;
        return null;
      }),
    },
    user: { id: "actor-123" },
    member: { roles: { highest: { position: 10 } } },
    client: { user: { id: "bot-456" } },
    guild: { name: "Test Guild", members: { unban: vi.fn() } },
    guildId: "guild-789",
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

function createMockMember({
  id = "target-789",
  bannable = true,
  displayName = "TestUser",
} = {}) {
  return {
    id,
    bannable,
    user: { displayName, send: vi.fn() },
    roles: { highest: { position: 5 } },
    ban: vi.fn(),
  };
}

describe("softban command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("softban");
    expect(command.category).toBe("Moderation");
    expect(command.cooldown).toBe(5);
  });

  it("softbans a member successfully (ban + unban)", async () => {
    const target = createMockMember();
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(target.ban).toHaveBeenCalledWith(
      expect.objectContaining({
        deleteMessageSeconds: 7 * 86400,
      }),
    );
    expect(interaction.guild.members.unban).toHaveBeenCalledWith("target-789", "Softban");
    expect(mockCreateModCase).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "softban",
      }),
    );
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("rejects when target is not found", async () => {
    const interaction = createMockInteraction({ targetMember: null });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });
});
