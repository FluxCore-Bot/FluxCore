import { describe, it, expect, vi } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const avatarModule = await import("../../../src/commands/utility/avatar.js");
const command = avatarModule.default;

function createMockUser({
  displayName = "TestUser",
  avatarUrl = "https://cdn.discordapp.com/avatars/123/abc.png?size=4096",
} = {}) {
  return {
    displayName,
    displayAvatarURL: vi.fn().mockReturnValue(avatarUrl),
  };
}

function createMockInteraction({
  targetUser = null as ReturnType<typeof createMockUser> | null,
} = {}) {
  return {
    user: createMockUser(),
    options: {
      getUser: vi.fn().mockReturnValue(targetUser),
    },
    reply: vi.fn(),
  };
}

describe("avatar command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("avatar");
    expect(command.category).toBe("Utility");
    expect(command.cooldown).toBe(5);
  });

  it("shows own avatar when no target specified", async () => {
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "TestUser",
            }),
          }),
        ]),
      }),
    );
  });

  it("shows target user avatar when specified", async () => {
    const target = createMockUser({ displayName: "OtherUser" });
    const interaction = createMockInteraction({ targetUser: target });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "OtherUser",
            }),
          }),
        ]),
      }),
    );
  });
});
