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

// Mock permissions (keep real embed/logger exports)
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

const banModule = await import("../../../../src/features/moderation/commands/ban.js");
const command = banModule.default;

function createMockInteraction({
  targetMember = createMockMember(),
  reason = null,
  deleteDays = null,
}: {
  targetMember?: ReturnType<typeof createMockMember> | null;
  reason?: string | null;
  deleteDays?: number | null;
} = {}) {
  return {
    options: {
      getMember: vi.fn().mockReturnValue(targetMember),
      getString: vi.fn((name: string) => {
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

describe("ban command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("ban");
    expect(command.category).toBe("Moderation");
    expect(command.cooldown).toBe(5);
  });

  it("bans a member successfully and creates mod case", async () => {
    const target = createMockMember();
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(target.ban).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
    expect(mockCreateModCase).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: "guild-789",
        targetId: "target-789",
        moderatorId: "actor-123",
        action: "ban",
      }),
    );
  });

  it("DMs user when dmOnPunishment is enabled", async () => {
    mockGetModSettings.mockResolvedValueOnce({ dmOnPunishment: true, modLogChannelId: null });
    const target = createMockMember();
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(mockDmOnPunishment).toHaveBeenCalledWith(
      target,
      "Test Guild",
      "banned",
      "No reason provided",
    );
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("returns early when bot lacks permissions", async () => {
    mockCheckBotPermissions.mockResolvedValueOnce(false);
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

  it("rejects when user tries to ban themselves", async () => {
    const target = createMockMember({ id: "actor-123" });
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(target.ban).not.toHaveBeenCalled();
  });

  it("rejects when user tries to ban the bot", async () => {
    const target = createMockMember({ id: "bot-456" });
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(target.ban).not.toHaveBeenCalled();
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
              title: "Ban Failed",
            }),
          }),
        ]),
      }),
    );
  });
});
