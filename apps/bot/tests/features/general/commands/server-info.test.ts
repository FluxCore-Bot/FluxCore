import { describe, it, expect, vi } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const serverInfoModule = await import(
  "../../../../src/features/general/commands/server-info.js"
);
const command = serverInfoModule.default;

function createMockGuild() {
  return {
    name: "Test Server",
    memberCount: 100,
    premiumTier: 2,
    premiumSubscriptionCount: 5,
    createdTimestamp: Date.now() - 86_400_000,
    iconURL: vi.fn().mockReturnValue("https://example.com/icon.png"),
    channels: { cache: { size: 20 } },
    roles: { cache: { size: 10 } },
    fetchOwner: vi.fn().mockResolvedValue({
      user: { displayName: "OwnerUser" },
    }),
  };
}

function createMockInteraction({ hasGuild = true } = {}) {
  return {
    guild: hasGuild ? createMockGuild() : null,
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("server-info command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("server-info");
    expect(command.category).toBe("General");
    expect(command.cooldown).toBe(10);
  });

  it("shows server info when in a guild", async () => {
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Test Server",
            }),
          }),
        ]),
      }),
    );
  });

  it("rejects when used outside a guild", async () => {
    const interaction = createMockInteraction({ hasGuild: false });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });
});