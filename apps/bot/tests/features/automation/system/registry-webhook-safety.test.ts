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

const lookup = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup }));

const { getExecutor } = await import(
  "../../../../src/features/automation/system/registry.js"
);

const ctx = {
  eventType: "memberJoin" as const,
  guildId: "g1",
  guildName: "G",
  userId: "u1",
  userName: "alice",
  memberCount: 1,
  timestamp: new Date().toISOString(),
};

function cfg(url: string) {
  return { type: "sendWebhook", webhook: { url } };
}

/** A Response-alike carrying a body of `size` bytes, streamed in 1 KiB chunks. */
function streamingResponse(size: number, status = 200) {
  let sent = 0;
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    body: {
      getReader() {
        return {
          async read() {
            if (sent >= size) return { done: true, value: undefined };
            const chunk = Math.min(1024, size - sent);
            sent += chunk;
            return { done: false, value: new Uint8Array(chunk) };
          },
          cancel: vi.fn(),
          releaseLock() {},
        };
      },
    },
    text: async () => "x".repeat(size),
  };
}

describe("sendWebhook safety", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    lookup.mockResolvedValue({ address: "1.1.1.1", family: 4 });
  });

  it("rejects a missing URL rather than returning silently", async () => {
    await expect(
      getExecutor("sendWebhook")!({} as never, ctx, { type: "sendWebhook" }),
    ).rejects.toThrow(/url/i);
  });

  it("rejects plain HTTP", async () => {
    await expect(
      getExecutor("sendWebhook")!({} as never, ctx, cfg("http://example.com/h")),
    ).rejects.toThrow(/https/i);
  });

  it("rejects a private host", async () => {
    lookup.mockResolvedValue({ address: "10.0.0.5", family: 4 });
    await expect(
      getExecutor("sendWebhook")!({} as never, ctx, cfg("https://internal.example/h")),
    ).rejects.toThrow(/private|internal/i);
  });

  // The private-IP check ran once, against the ORIGINAL hostname. A public
  // host answering 302 -> http://169.254.169.254/ walked straight past it into
  // the cloud metadata service.
  it("re-validates the target of a redirect", async () => {
    lookup.mockImplementation(async (host: string) =>
      host === "evil.example" ? { address: "1.1.1.1", family: 4 } : { address: "169.254.169.254", family: 4 },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 302,
        ok: false,
        headers: { get: (h: string) => (h.toLowerCase() === "location" ? "https://metadata.internal/latest" : null) },
        body: null,
        text: async () => "",
      }),
    );

    await expect(
      getExecutor("sendWebhook")!({} as never, ctx, cfg("https://evil.example/h")),
    ).rejects.toThrow(/private|internal|redirect/i);
  });

  it("does not follow redirects endlessly", async () => {
    const f = vi.fn().mockResolvedValue({
      status: 302,
      ok: false,
      headers: { get: (h: string) => (h.toLowerCase() === "location" ? "https://example.com/loop" : null) },
      body: null,
      text: async () => "",
    });
    vi.stubGlobal("fetch", f);

    await expect(
      getExecutor("sendWebhook")!({} as never, ctx, cfg("https://example.com/h")),
    ).rejects.toThrow(/redirect/i);
    expect(f.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("rejects a non-2xx response so the failure is logged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamingResponse(10, 500)));

    await expect(
      getExecutor("sendWebhook")!({} as never, ctx, cfg("https://example.com/h")),
    ).rejects.toThrow(/500/);
  });

  it("stops reading a response body that exceeds the cap", async () => {
    const reader = { calls: 0 };
    const oversize = streamingResponse(5_000_000);
    const originalGetReader = oversize.body!.getReader.bind(oversize.body);
    oversize.body!.getReader = () => {
      reader.calls++;
      return originalGetReader();
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(oversize));

    // Must complete rather than buffering 5 MB into memory.
    await getExecutor("sendWebhook")!({} as never, ctx, cfg("https://example.com/h"));
    expect(reader.calls).toBe(1);
  });

  it("sends successfully on a 2xx", async () => {
    const f = vi.fn().mockResolvedValue(streamingResponse(10));
    vi.stubGlobal("fetch", f);

    await getExecutor("sendWebhook")!({} as never, ctx, cfg("https://example.com/h"));

    expect(f).toHaveBeenCalledOnce();
  });
});
