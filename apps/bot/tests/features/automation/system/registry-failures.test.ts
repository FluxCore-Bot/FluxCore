import { describe, it, expect, vi } from "vitest";

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

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue({ address: "1.1.1.1", family: 4 }),
}));

const { getExecutor } = await import(
  "../../../../src/features/automation/system/registry.js"
);

const baseCtx = {
  eventType: "messageCreated" as const,
  guildId: "g1",
  userId: "u1",
  userName: "alice",
  userTag: "alice#0001",
  userMention: "<@u1>",
  channelId: "c1",
  guildName: "G",
  memberCount: 10,
  timestamp: new Date().toISOString(),
};

/**
 * Every executor used to `return` when it could not do its job — no channel
 * configured, no member to act on, an unresolvable role. processEvent has no
 * way to tell that apart from success, so it wrote `success: true` to the
 * ActionLog. A moderator whose auto-role rule never fired saw "214 executions,
 * 100% success" and had nothing to debug with.
 *
 * Every case below must reject, so the caller's existing catch logs it as a
 * failure with a readable reason.
 */
describe("action executors fail loudly rather than silently doing nothing", () => {
  function clientWithNoChannel() {
    return { channels: { fetch: vi.fn().mockResolvedValue(null) } } as never;
  }

  it("sendMessage rejects when no channel is configured", async () => {
    const run = getExecutor("sendMessage")!;
    await expect(run(clientWithNoChannel(), baseCtx, { type: "sendMessage", message: "hi" }))
      .rejects.toThrow(/channelId/i);
  });

  it("sendMessage rejects when no message is configured", async () => {
    const run = getExecutor("sendMessage")!;
    await expect(run(clientWithNoChannel(), baseCtx, { type: "sendMessage", channelId: "c1" }))
      .rejects.toThrow(/message/i);
  });

  it("sendMessage rejects when the channel cannot be resolved", async () => {
    const run = getExecutor("sendMessage")!;
    await expect(
      run(clientWithNoChannel(), baseCtx, { type: "sendMessage", channelId: "gone", message: "hi" }),
    ).rejects.toThrow(/channel/i);
  });

  it("addRole rejects when no role is configured", async () => {
    const run = getExecutor("addRole")!;
    await expect(run({} as never, baseCtx, { type: "addRole" })).rejects.toThrow(/roleId/i);
  });

  // The canonical reaction-role automation: "react to this message, get a
  // role". A reaction context carries no member, so this silently did nothing
  // and reported success for every reaction.
  it("addRole resolves the member from the guild when the context has none", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          members: { fetch: vi.fn().mockResolvedValue({ roles: { add, remove: vi.fn() } }) },
        }),
      },
    } as never;

    await getExecutor("addRole")!(client, baseCtx, { type: "addRole", roleId: "r1" });

    expect(add).toHaveBeenCalledWith("r1");
  });

  it("addRole rejects when the member cannot be resolved", async () => {
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          members: { fetch: vi.fn().mockRejectedValue(new Error("Unknown Member")) },
        }),
      },
    } as never;

    await expect(
      getExecutor("addRole")!(client, baseCtx, { type: "addRole", roleId: "r1" }),
    ).rejects.toThrow(/member/i);
  });

  it("removeRole resolves the member from the guild when the context has none", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          members: { fetch: vi.fn().mockResolvedValue({ roles: { add: vi.fn(), remove } }) },
        }),
      },
    } as never;

    await getExecutor("removeRole")!(client, baseCtx, { type: "removeRole", roleId: "r1" });

    expect(remove).toHaveBeenCalledWith("r1");
  });

  it("sendDM rejects when the DM cannot be delivered", async () => {
    const client = {
      users: { fetch: vi.fn().mockResolvedValue({ send: vi.fn().mockRejectedValue(new Error("Cannot send messages to this user")) }) },
    } as never;

    await expect(
      getExecutor("sendDM")!(client, baseCtx, { type: "sendDM", message: "hi" }),
    ).rejects.toThrow(/cannot send/i);
  });

  it("setNickname rejects when Discord refuses the change", async () => {
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          members: {
            fetch: vi.fn().mockResolvedValue({
              setNickname: vi.fn().mockRejectedValue(new Error("Missing Permissions")),
            }),
          },
        }),
      },
    } as never;

    await expect(
      getExecutor("setNickname")!(client, baseCtx, { type: "setNickname", nickname: "n" }),
    ).rejects.toThrow(/missing permissions/i);
  });

  it("addReaction rejects on an invalid emoji instead of warning and returning", async () => {
    const client = { channels: { fetch: vi.fn() } } as never;

    await expect(
      getExecutor("addReaction")!(
        client,
        { ...baseCtx, extra: { "message.id": "m1" } },
        { type: "addReaction", emoji: "not an emoji" },
      ),
    ).rejects.toThrow(/emoji/i);
  });

  it("logToChannel rejects when the channel cannot be resolved", async () => {
    const run = getExecutor("logToChannel")!;
    await expect(run(clientWithNoChannel(), baseCtx, { type: "logToChannel", channelId: "gone" }))
      .rejects.toThrow(/channel/i);
  });

  it("createThread rejects when the channel cannot be resolved", async () => {
    const run = getExecutor("createThread")!;
    await expect(
      run(clientWithNoChannel(), baseCtx, { type: "createThread", channelId: "gone", threadName: "t" }),
    ).rejects.toThrow(/channel/i);
  });
});
