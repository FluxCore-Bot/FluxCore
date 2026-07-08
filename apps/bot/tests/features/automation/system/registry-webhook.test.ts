import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  lookup: vi.fn().mockResolvedValue({ address: "93.184.216.34", family: 4 }),
}));

const { getExecutor } = await import(
  "../../../../src/features/automation/system/registry.js"
);

const baseCtx = {
  eventType: "memberJoin" as const,
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

describe("sendWebhook header allowlist", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 200 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  async function run(headers: Record<string, string>) {
    const executor = getExecutor("sendWebhook")!;
    await executor({} as never, baseCtx as never, {
      type: "sendWebhook",
      webhook: {
        url: "https://example.com/hook",
        method: "POST",
        headers,
        bodyTemplate: "{}",
      },
    } as never);
    const call = fetchSpy.mock.calls[0];
    return (call?.[1] as { headers: Record<string, string> } | undefined)
      ?.headers as Record<string, string>;
  }

  it("strips Authorization header", async () => {
    const sent = await run({ Authorization: "Bearer leaked" });
    expect(sent).toBeDefined();
    expect(Object.keys(sent).map((k) => k.toLowerCase())).not.toContain(
      "authorization",
    );
  });

  it("strips X-Api-Key header", async () => {
    const sent = await run({ "X-Api-Key": "secret" });
    expect(Object.keys(sent).map((k) => k.toLowerCase())).not.toContain(
      "x-api-key",
    );
  });

  it("strips X-Forwarded-For and X-Forwarded-Host", async () => {
    const sent = await run({
      "X-Forwarded-For": "127.0.0.1",
      "X-Forwarded-Host": "internal",
    });
    const lower = Object.keys(sent).map((k) => k.toLowerCase());
    expect(lower).not.toContain("x-forwarded-for");
    expect(lower).not.toContain("x-forwarded-host");
  });

  it("strips Cookie header", async () => {
    const sent = await run({ Cookie: "session=abc" });
    expect(Object.keys(sent).map((k) => k.toLowerCase())).not.toContain(
      "cookie",
    );
  });

  it("allows X-Idempotency-Key (allowlisted)", async () => {
    const sent = await run({ "X-Idempotency-Key": "abc-123" });
    const lower = Object.keys(sent).map((k) => k.toLowerCase());
    expect(lower).toContain("x-idempotency-key");
  });

  it("allows custom X-Fluxcore-* headers (allowlisted prefix)", async () => {
    const sent = await run({ "X-Fluxcore-Source": "rule-42" });
    const lower = Object.keys(sent).map((k) => k.toLowerCase());
    expect(lower).toContain("x-fluxcore-source");
  });

  it("always sets Content-Type: application/json", async () => {
    const sent = await run({});
    expect(sent["Content-Type"] ?? sent["content-type"]).toBe(
      "application/json",
    );
  });
});
