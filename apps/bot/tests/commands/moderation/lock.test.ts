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

const lockModule = await import("../../../src/commands/moderation/lock.js");
const command = lockModule.default;

function createMockChannel() {
  return {
    id: "channel-123",
    permissionOverwrites: {
      edit: vi.fn(),
    },
  };
}

function createMockInteraction({
  channel = createMockChannel(),
  targetChannel = null,
  reason = null,
}: {
  channel?: ReturnType<typeof createMockChannel> | null;
  targetChannel?: ReturnType<typeof createMockChannel> | null;
  reason?: string | null;
} = {}) {
  return {
    options: {
      getChannel: vi.fn().mockReturnValue(targetChannel),
      getString: vi.fn((name: string) => {
        if (name === "reason") return reason;
        return null;
      }),
    },
    channel,
    guild: { roles: { everyone: { id: "everyone-role" } } },
    guildId: "guild-789",
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("lock command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("lock");
    expect(command.category).toBe("Moderation");
  });

  it("locks the current channel successfully", async () => {
    const channel = createMockChannel();
    const interaction = createMockInteraction({ channel });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(channel.permissionOverwrites.edit).toHaveBeenCalledWith(
      { id: "everyone-role" },
      { SendMessages: false },
    );
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("handles lock failure gracefully", async () => {
    const channel = createMockChannel();
    channel.permissionOverwrites.edit = vi.fn().mockRejectedValue(new Error("API error"));
    const interaction = createMockInteraction({ channel });

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Lock Failed",
            }),
          }),
        ]),
      }),
    );
  });
});
