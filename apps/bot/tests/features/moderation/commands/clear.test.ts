import { describe, it, expect, vi } from "vitest";
import { ChannelType, Collection } from "discord.js";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const mockCheckPermissions = vi.fn().mockResolvedValue(true);
const mockCheckBotPermissions = vi.fn().mockResolvedValue(true);
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    checkBotPermissions: (...args: unknown[]) =>
      mockCheckBotPermissions(...args),
  };
});

const clearModule = await import("../../../../src/features/moderation/commands/clear.js");
const command = clearModule.default;

function createMockMessage(authorId = "user-123") {
  return { author: { id: authorId } };
}

function createMockInteraction({
  amount = 5,
  targetUser = null as { id: string; displayName: string } | null,
  channelType = ChannelType.GuildText as number,
  hasChannel = true,
  deletedCount = 5,
}: {
  amount?: number;
  targetUser?: { id: string; displayName: string } | null;
  channelType?: number;
  hasChannel?: boolean;
  deletedCount?: number;
} = {}) {
  const messages = new Collection<string, unknown>();
  for (let i = 0; i < amount; i++) {
    messages.set(`msg-${i}`, createMockMessage(targetUser?.id ?? `user-${i}`));
  }

  const deleted = new Collection<string, unknown>();
  for (let i = 0; i < deletedCount; i++) {
    deleted.set(`msg-${i}`, messages.get(`msg-${i}`));
  }

  return {
    channel: hasChannel
      ? {
          type: channelType,
          messages: {
            fetch: vi.fn().mockResolvedValue(messages),
          },
          bulkDelete: vi.fn().mockResolvedValue(deleted),
        }
      : null,
    options: {
      getInteger: vi.fn().mockReturnValue(amount),
      getUser: vi.fn().mockReturnValue(targetUser),
    },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("clear command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("clear");
    expect(command.category).toBe("Moderation");
    expect(command.cooldown).toBe(10);
  });

  it("clears messages successfully", async () => {
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(interaction.channel!.bulkDelete).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Messages Cleared",
            }),
          }),
        ]),
      }),
    );
  });

  it("filters by user when target user provided", async () => {
    const targetUser = { id: "target-456", displayName: "TargetUser" };
    const interaction = createMockInteraction({ targetUser });

    await command.execute(interaction as never);

    expect(interaction.channel!.messages.fetch).toHaveBeenCalled();
    expect(interaction.channel!.bulkDelete).toHaveBeenCalled();
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

  it("rejects when used outside a text channel", async () => {
    const interaction = createMockInteraction({
      channelType: ChannelType.GuildVoice,
    });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects when channel is null", async () => {
    const interaction = createMockInteraction({ hasChannel: false });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });
});
