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

const purgeModule = await import("../../../src/commands/moderation/purge.js");
const command = purgeModule.default;

function createMockMessage({
  id = "msg-1",
  authorId = "user-1",
  isBot = false,
  content = "Hello",
  attachmentCount = 0,
  embedCount = 0,
} = {}) {
  return {
    id,
    author: { id: authorId, bot: isBot },
    content,
    attachments: { size: attachmentCount },
    embeds: Array(embedCount).fill({}),
    createdTimestamp: Date.now(),
  };
}

function createMockInteraction({
  amount = 10,
  user = null,
  bots = null,
  contains = null,
  has = null,
}: {
  amount?: number;
  user?: { id: string } | null;
  bots?: boolean | null;
  contains?: string | null;
  has?: string | null;
} = {}) {
  const messages = Array.from({ length: 15 }, (_, i) =>
    createMockMessage({ id: `msg-${i}`, authorId: `user-${i % 3}` }),
  );

  const channel = {
    messages: {
      fetch: vi.fn().mockResolvedValue(new Map(messages.map((m) => [m.id, m]))),
    },
    bulkDelete: vi.fn().mockResolvedValue(new Map(messages.slice(0, amount).map((m) => [m.id, m]))),
  };

  return {
    options: {
      getInteger: vi.fn((_name: string, _required?: boolean) => amount),
      getUser: vi.fn().mockReturnValue(user),
      getBoolean: vi.fn().mockReturnValue(bots),
      getString: vi.fn((name: string) => {
        if (name === "contains") return contains;
        if (name === "has") return has;
        return null;
      }),
    },
    channel,
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("purge command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("purge");
    expect(command.category).toBe("Moderation");
  });

  it("purges messages successfully", async () => {
    const interaction = createMockInteraction({ amount: 10 });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(interaction.channel.messages.fetch).toHaveBeenCalled();
    expect(interaction.channel.bulkDelete).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("handles empty result when no messages match filters", async () => {
    const interaction = createMockInteraction({ user: { id: "nonexistent-user" } });
    // Override fetch to return messages that won't match the user filter
    const messages = Array.from({ length: 5 }, (_, i) =>
      createMockMessage({ id: `msg-${i}`, authorId: "other-user" }),
    );
    interaction.channel.messages.fetch = vi.fn().mockResolvedValue(
      new Map(messages.map((m) => [m.id, m])),
    );

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalled();
  });
});
