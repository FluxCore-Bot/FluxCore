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

const timeoutModule = await import(
  "../../../src/commands/moderation/timeout.js"
);
const command = timeoutModule.default;

function createMockMember({
  id = "target-789",
  displayName = "TestUser",
} = {}) {
  return {
    id,
    user: { displayName },
    roles: { highest: { position: 5 } },
    timeout: vi.fn(),
  };
}

function createMockInteraction({
  targetMember = createMockMember(),
  duration = "10m",
  reason = null,
}: {
  targetMember?: ReturnType<typeof createMockMember> | null;
  duration?: string;
  reason?: string | null;
} = {}) {
  return {
    options: {
      getMember: vi.fn().mockReturnValue(targetMember),
      getString: vi.fn((name: string, _required?: boolean) => {
        if (name === "duration") return duration;
        if (name === "reason") return reason;
        return null;
      }),
    },
    user: { id: "actor-123" },
    member: { roles: { highest: { position: 10 } } },
    client: { user: { id: "bot-456" } },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("timeout command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("timeout");
    expect(command.category).toBe("Moderation");
    expect(command.cooldown).toBe(5);
  });

  it("times out a member successfully", async () => {
    const target = createMockMember();
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(target.timeout).toHaveBeenCalledWith(600_000, "No reason provided");
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("rejects self-timeout", async () => {
    const target = createMockMember({ id: "actor-123" });
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(target.timeout).not.toHaveBeenCalled();
  });

  it("rejects bot-timeout", async () => {
    const target = createMockMember({ id: "bot-456" });
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(target.timeout).not.toHaveBeenCalled();
  });

  it("rejects invalid duration", async () => {
    const interaction = createMockInteraction({ duration: "invalid" });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects duration exceeding 28 days", async () => {
    const interaction = createMockInteraction({ duration: "5w" });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("handles timeout API failure gracefully", async () => {
    const target = createMockMember();
    target.timeout = vi.fn().mockRejectedValue(new Error("API error"));
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Timeout Failed",
            }),
          }),
        ]),
      }),
    );
  });
});
