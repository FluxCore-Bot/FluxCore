import { describe, it, expect, vi } from "vitest";
import { ChannelType, PermissionsBitField, PermissionFlagsBits } from "discord.js";

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

const embedModule = await import(
  "../../../../src/features/utility/commands/embed-builder.js"
);
const command = embedModule.default;

function createMockChannel({
  hasPerms = true,
} = {}) {
  return {
    type: ChannelType.GuildText,
    send: vi.fn(),
    toString: () => "#test-channel",
    permissionsFor: vi.fn().mockReturnValue({
      has: vi.fn().mockReturnValue(hasPerms),
    }),
  };
}

function createMockInteraction({
  title = "Test Title",
  description = "Test description",
  color = null as string | null,
  channel = null as ReturnType<typeof createMockChannel> | null,
}: {
  title?: string;
  description?: string;
  color?: string | null;
  channel?: ReturnType<typeof createMockChannel> | null;
} = {}) {
  const defaultChannel = createMockChannel();
  return {
    user: { displayName: "TestUser" },
    channel: defaultChannel,
    guild: {
      members: {
        me: {
          permissions: new PermissionsBitField([PermissionFlagsBits.Administrator]),
        },
      },
    },
    options: {
      getString: vi.fn((name: string, _required?: boolean) => {
        if (name === "title") return title;
        if (name === "description") return description;
        if (name === "color") return color;
        return null;
      }),
      getChannel: vi.fn().mockReturnValue(channel),
    },
    reply: vi.fn(),
  };
}

describe("embed-builder command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("embed");
    expect(command.category).toBe("Utility");
    expect(command.cooldown).toBe(10);
  });

  it("sends an embed to the current channel", async () => {
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.channel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
      }),
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("sends an embed to a target channel", async () => {
    const targetChannel = createMockChannel();
    const interaction = createMockInteraction({ channel: targetChannel });

    await command.execute(interaction as never);

    expect(targetChannel.send).toHaveBeenCalled();
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.channel.send).not.toHaveBeenCalled();
  });

  it("returns early when bot lacks permissions", async () => {
    mockCheckBotPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.channel.send).not.toHaveBeenCalled();
  });

  it("rejects when bot cant send in target channel", async () => {
    const targetChannel = createMockChannel({ hasPerms: false });
    const interaction = createMockInteraction({ channel: targetChannel });

    await command.execute(interaction as never);

    expect(targetChannel.send).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });
});
