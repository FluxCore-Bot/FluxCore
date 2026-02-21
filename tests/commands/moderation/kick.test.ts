import { describe, it, expect, vi } from "vitest";

// Mock config
vi.mock("../../../src/config/index.js", () => ({
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
const mockIsAboveTarget = vi.fn().mockReturnValue(true);
vi.mock("../../../src/utils/permissions.js", () => ({
  checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
  checkBotPermissions: (...args: unknown[]) => mockCheckBotPermissions(...args),
  isAboveTarget: (...args: unknown[]) => mockIsAboveTarget(...args),
}));

const kickModule = await import("../../../src/commands/moderation/kick.js");
const command = kickModule.default;

function createMockMember({
  id = "target-789",
  kickable = true,
  displayName = "TestUser",
} = {}) {
  return {
    id,
    kickable,
    user: { displayName },
    roles: { highest: { position: 5 } },
    kick: vi.fn(),
  };
}

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
      getString: vi.fn().mockReturnValue(reason),
    },
    user: { id: "actor-123" },
    member: { roles: { highest: { position: 10 } } },
    client: { user: { id: "bot-456" } },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("kick command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("kick");
    expect(command.category).toBe("Moderation");
    expect(command.cooldown).toBe(5);
  });

  it("kicks a member successfully", async () => {
    const target = createMockMember();
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(target.kick).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("rejects self-kick", async () => {
    const target = createMockMember({ id: "actor-123" });
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(target.kick).not.toHaveBeenCalled();
  });

  it("rejects bot-kick", async () => {
    const target = createMockMember({ id: "bot-456" });
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(target.kick).not.toHaveBeenCalled();
  });

  it("rejects when target is not kickable", async () => {
    const target = createMockMember({ kickable: false });
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("handles kick API failure gracefully", async () => {
    const target = createMockMember();
    target.kick = vi.fn().mockRejectedValue(new Error("API error"));
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Kick Failed",
            }),
          }),
        ]),
      }),
    );
  });
});
