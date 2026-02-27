import { describe, it, expect, vi } from "vitest";
import { Collection } from "discord.js";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const userInfoModule = await import(
  "../../../src/commands/general/user-info.js"
);
const command = userInfoModule.default;

function createMockUser({
  id = "user-123",
  displayName = "TestUser",
  bot = false,
} = {}) {
  return {
    id,
    displayName,
    bot,
    createdTimestamp: Date.now() - 86_400_000,
    displayAvatarURL: vi.fn().mockReturnValue("https://example.com/avatar.png"),
  };
}

function createMockMember(roles: Array<{ id: string; position: number; toString: () => string }> = []) {
  const rolesCache = new Collection<string, unknown>();
  for (const role of roles) {
    rolesCache.set(role.id, role);
  }
  return {
    joinedTimestamp: Date.now() - 3_600_000,
    roles: { cache: rolesCache },
  };
}

function createMockInteraction({
  targetUser = null as ReturnType<typeof createMockUser> | null,
  hasGuild = true,
  memberFetchResult = createMockMember(),
}: {
  targetUser?: ReturnType<typeof createMockUser> | null;
  hasGuild?: boolean;
  memberFetchResult?: ReturnType<typeof createMockMember> | null;
} = {}) {
  const selfUser = createMockUser();
  return {
    user: selfUser,
    guild: hasGuild
      ? {
          id: "guild-123",
          members: {
            fetch: vi.fn().mockResolvedValue(memberFetchResult),
          },
        }
      : null,
    options: {
      getUser: vi.fn().mockReturnValue(targetUser),
    },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("user-info command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("user-info");
    expect(command.category).toBe("General");
    expect(command.cooldown).toBe(5);
  });

  it("shows info for the invoking user when no target specified", async () => {
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("shows info for a specific target user", async () => {
    const target = createMockUser({ id: "target-456", displayName: "TargetUser" });
    const interaction = createMockInteraction({ targetUser: target });

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "TargetUser",
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

  it("handles member fetch failure gracefully", async () => {
    const interaction = createMockInteraction({ memberFetchResult: null });
    interaction.guild!.members.fetch = vi.fn().mockRejectedValue(new Error("Not found"));

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalled();
  });
});