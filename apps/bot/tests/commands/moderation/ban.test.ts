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

const banModule = await import("../../../src/commands/moderation/ban.js");
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
    user: { displayName },
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

  it("bans a member successfully", async () => {
    const target = createMockMember();
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(target.ban).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
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
