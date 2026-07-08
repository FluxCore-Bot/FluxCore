import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", guildId: undefined, logLevel: "info" },
}));

const warn = vi.hoisted(() => vi.fn());
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    logger: { warn, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
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
  extra: { "message.id": "m1" },
};

function mkClient(fetchSpy: ReturnType<typeof vi.fn>) {
  return {
    channels: {
      fetch: vi.fn().mockResolvedValue({
        isTextBased: () => true,
        messages: { fetch: fetchSpy },
      }),
    },
  } as never;
}

describe("addReaction emoji validation", () => {
  beforeEach(() => warn.mockClear());

  it("rejects garbage strings without fetching the message", async () => {
    const fetchSpy = vi.fn();
    const client = mkClient(fetchSpy);

    const executor = getExecutor("addReaction")!;
    await executor(client, baseCtx as never, {
      type: "addReaction",
      emoji: "not-an-emoji-at-all",
    } as never);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("invalid emoji"),
    );
  });

  it("accepts a unicode emoji", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ react: vi.fn() });
    const client = mkClient(fetchSpy);
    const executor = getExecutor("addReaction")!;
    await executor(client, baseCtx as never, {
      type: "addReaction",
      emoji: "\u{1F389}",
    } as never);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("accepts a Discord custom emoji <:name:id>", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ react: vi.fn() });
    const client = mkClient(fetchSpy);
    const executor = getExecutor("addReaction")!;
    await executor(client, baseCtx as never, {
      type: "addReaction",
      emoji: "<:partyparrot:123456789012345678>",
    } as never);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("accepts an animated custom emoji <a:name:id>", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ react: vi.fn() });
    const client = mkClient(fetchSpy);
    const executor = getExecutor("addReaction")!;
    await executor(client, baseCtx as never, {
      type: "addReaction",
      emoji: "<a:dance:123456789012345678>",
    } as never);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects bare colon shortcodes like :smile:", async () => {
    const fetchSpy = vi.fn();
    const client = mkClient(fetchSpy);
    const executor = getExecutor("addReaction")!;
    await executor(client, baseCtx as never, {
      type: "addReaction",
      emoji: ":smile:",
    } as never);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
