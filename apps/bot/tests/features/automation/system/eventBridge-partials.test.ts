import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", guildId: undefined, logLevel: "info" },
}));

vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  };
});

const mockProcessEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("../../../../src/features/automation/system/executor.js", () => ({
  processEvent: (...args: unknown[]) => mockProcessEvent(...args),
}));

const mockGetRulesForEvent = vi.fn().mockReturnValue([{ id: 1 }]);
vi.mock("@fluxcore/systems/actions/cache", () => ({
  getRulesForEvent: (...args: unknown[]) => mockGetRulesForEvent(...args),
}));

const { registerActionEventListeners } = await import(
  "../../../../src/features/automation/system/eventBridge.js"
);

/** Captures the handlers registered via client.on so tests can invoke them. */
function fakeClient() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    client: { on: (name: string, fn: (...args: unknown[]) => unknown) => handlers.set(name, fn) },
    handlers,
  };
}

function partialReaction(overrides: Record<string, unknown> = {}) {
  return {
    partial: true,
    fetch: vi.fn().mockResolvedValue(undefined),
    emoji: { toString: () => "🎉", name: "tada" },
    message: {
      guildId: "g1",
      guild: { name: "G", memberCount: 5 },
      channelId: "c1",
      channel: { name: "general" },
      id: "m1",
      url: "https://discord.com/x",
    },
    ...overrides,
  };
}

/**
 * Partials are now enabled on the client, so reaction events arrive for
 * messages the bot has not cached. If the bridge does not fetch them first it
 * builds a context out of nulls — or drops the event entirely — and every
 * reaction automation on an older message stays silently broken.
 */
describe("eventBridge resolves partials before building a context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRulesForEvent.mockReturnValue([{ id: 1 }]);
  });

  it("fetches a partial reaction before processing reactionAdded", async () => {
    const { client, handlers } = fakeClient();
    registerActionEventListeners(client as never);
    const reaction = partialReaction();

    await handlers.get("messageReactionAdd")!(reaction, { id: "u1", bot: false, username: "ada" });

    expect(reaction.fetch).toHaveBeenCalled();
    expect(mockProcessEvent).toHaveBeenCalled();
  });

  it("fetches a partial user so the context carries a real username", async () => {
    const { client, handlers } = fakeClient();
    registerActionEventListeners(client as never);
    const user = { id: "u1", bot: false, partial: true, fetch: vi.fn().mockResolvedValue({ id: "u1", username: "ada", tag: "ada#1" }) };

    await handlers.get("messageReactionAdd")!(partialReaction(), user);

    expect(user.fetch).toHaveBeenCalled();
  });

  it("drops the event rather than throwing when the message is gone", async () => {
    const { client, handlers } = fakeClient();
    registerActionEventListeners(client as never);
    const reaction = partialReaction({
      fetch: vi.fn().mockRejectedValue(new Error("Unknown Message")),
    });

    await expect(
      handlers.get("messageReactionAdd")!(reaction, { id: "u1", bot: false }),
    ).resolves.not.toThrow();
    expect(mockProcessEvent).not.toHaveBeenCalled();
  });

  it("still processes reactionRemoved for a partial reaction", async () => {
    const { client, handlers } = fakeClient();
    registerActionEventListeners(client as never);
    const reaction = partialReaction();

    await handlers.get("messageReactionRemove")!(reaction, { id: "u1", bot: false });

    expect(reaction.fetch).toHaveBeenCalled();
    expect(mockProcessEvent).toHaveBeenCalled();
  });

  // A deleted message cannot be fetched back, so the bridge must not treat a
  // null author as "this is a bot, skip it" — that would drop every
  // messageDeleted event for an uncached message.
  it("processes messageDeleted for a partial message with no author", async () => {
    const { client, handlers } = fakeClient();
    registerActionEventListeners(client as never);

    await handlers.get("messageDelete")!({
      partial: true,
      guildId: "g1",
      guild: { name: "G", memberCount: 5 },
      channelId: "c1",
      channel: { name: "general" },
      id: "m1",
      author: null,
      content: null,
    });

    expect(mockProcessEvent).toHaveBeenCalled();
  });
});

describe("eventBridge threadCreated matches on the parent channel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRulesForEvent.mockReturnValue([{ id: 1 }]);
  });

  // context.channelId is the NEW thread, so "only threads under #support"
  // could never match. The parent has to travel with the context for a channel
  // filter on threadCreated to mean anything.
  it("carries the parent channel id in the event context", async () => {
    const { client, handlers } = fakeClient();
    registerActionEventListeners(client as never);

    await handlers.get("threadCreate")!({
      guildId: "g1",
      guild: { name: "G", memberCount: 5 },
      id: "t1",
      name: "help",
      ownerId: "u1",
      parentId: "parent-1",
    });

    const ctx = mockProcessEvent.mock.calls[0][1];
    expect(ctx.parentChannelId).toBe("parent-1");
  });
});
