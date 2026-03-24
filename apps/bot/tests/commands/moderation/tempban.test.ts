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
const mockDmOnPunishment = vi.fn().mockResolvedValue(true);
vi.mock("@fluxcore/systems/moderation/dm", () => ({
  dmOnPunishment: (...args: unknown[]) => mockDmOnPunishment(...args),
}));

// Mock constants
vi.mock("@fluxcore/systems/moderation/constants", () => ({
  DURATION_PRESETS: {
    "1h": 3600,
    "6h": 21600,
    "12h": 43200,
    "1d": 86400,
    "3d": 259200,
    "7d": 604800,
    "14d": 1209600,
    "30d": 2592000,
  },
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

const tempbanModule = await import("../../../src/commands/moderation/tempban.js");
const command = tempbanModule.default;

function createMockInteraction({
  targetMember = createMockMember(),
  duration = "7d",
  reason = null,
  deleteDays = null,
}: {
  targetMember?: ReturnType<typeof createMockMember> | null;
  duration?: string;
  reason?: string | null;
  deleteDays?: number | null;
} = {}) {
  return {
    options: {
      getMember: vi.fn().mockReturnValue(targetMember),
      getString: vi.fn((name: string, _required?: boolean) => {
        if (name === "duration") return duration;
        if (name === "reason") return reason;
        return null;
      }),
      getInteger: vi.fn().mockReturnValue(deleteDays),
    },
    user: { id: "actor-123" },
    member: { roles: { highest: { position: 10 } } },
    client: { user: { id: "bot-456" } },
    guild: { name: "Test Guild" },
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

describe("tempban command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("tempban");
    expect(command.category).toBe("Moderation");
    expect(command.cooldown).toBe(5);
  });

  it("tempbans a member successfully and creates mod case", async () => {
    const target = createMockMember();
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(target.ban).toHaveBeenCalled();
    expect(mockCreateModCase).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: "guild-789",
        targetId: "target-789",
        moderatorId: "actor-123",
        action: "tempban",
        duration: 604800,
        expiresAt: expect.any(Date),
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

  it("rejects when target member not found", async () => {
    const interaction = createMockInteraction({ targetMember: null });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects when user tries to tempban themselves", async () => {
    const target = createMockMember({ id: "actor-123" });
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(target.ban).not.toHaveBeenCalled();
  });

  it("rejects invalid duration", async () => {
    const interaction = createMockInteraction({ duration: "99y" });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects when target is not bannable", async () => {
    const target = createMockMember({ bannable: false });
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects when actor role is not above target", async () => {
    mockIsAboveTarget.mockReturnValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("handles ban API failure gracefully", async () => {
    const target = createMockMember();
    target.ban = vi.fn().mockRejectedValue(new Error("API error"));
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Tempban Failed",
            }),
          }),
        ]),
      }),
    );
  });
});
