# Webhook Header Denylist → Strict Allowlist — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** High
**Goal:** Replace the incomplete `BLOCKED_HEADERS` denylist in the `sendWebhook` action executor with a strict allowlist of permitted header names so guild moderators cannot smuggle credentials, auth bypass, or proxy headers into outbound webhook calls.
**Architecture:** `executors.set("sendWebhook", ...)` in `apps/bot/src/features/automation/system/registry.ts` accepts `config.webhook.headers` (a `Record<string, string>` configured per action rule via dashboard or `/actions` command) and merges them into the outgoing fetch headers. Today it filters out a small set of hop-by-hop headers via a denylist, but `authorization`, `x-api-key`, `cookie` (already blocked), and proxy/forwarding headers are not all covered, and any new sensitive header would silently pass through. Switch to an explicit allowlist of headers we know are safe to forward (caching, content negotiation, idempotency keys, custom `x-fluxcore-*` headers).
**Tech Stack:** discord.js v14, TypeScript, Prisma, Vitest

---

## Vulnerability

`apps/bot/src/features/automation/system/registry.ts` (lines 137-201) defines:

```typescript
const BLOCKED_HEADERS = new Set([
  "host", "cookie", "set-cookie", "transfer-encoding",
  "connection", "proxy-authorization", "te", "trailer",
  "upgrade",
]);
```

A guild admin (or compromised dashboard session with `ManageGuild`) can configure a `sendWebhook` action with `headers: { "Authorization": "Bearer stolen-token" }` or `"X-Forwarded-For": "127.0.0.1"` and the bot will faithfully forward them. This permits credential injection toward third-party services, reflected SSRF probes, and bypass of upstream IP-allowlist checks. Denylists are unsafe by design.

## Files

- `apps/bot/src/features/automation/system/registry.ts` (lines 137-201)
- `apps/bot/tests/features/automation/system/registry-webhook.test.ts` (new)

## Tasks

### Task 1: Replace denylist with strict allowlist

- [ ] **Step 1: Write failing test** — create `apps/bot/tests/features/automation/system/registry-webhook.test.ts`:

```typescript
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
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 204 }),
    );
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
    return call?.[1]?.headers as Record<string, string>;
  }

  it("strips Authorization header", async () => {
    const sent = await run({ Authorization: "Bearer leaked" });
    expect(sent).toBeDefined();
    expect(Object.keys(sent).map((k) => k.toLowerCase())).not.toContain("authorization");
  });

  it("strips X-Api-Key header", async () => {
    const sent = await run({ "X-Api-Key": "secret" });
    expect(Object.keys(sent).map((k) => k.toLowerCase())).not.toContain("x-api-key");
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
    expect(Object.keys(sent).map((k) => k.toLowerCase())).not.toContain("cookie");
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
    expect(sent["Content-Type"] ?? sent["content-type"]).toBe("application/json");
  });
});
```

- [ ] **Step 2: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/features/automation/system/registry-webhook.test.ts`. Expected: FAIL (Authorization, X-Api-Key, X-Forwarded-* currently pass through; allowlisted ones currently also pass which is OK, but the strip tests fail).

- [ ] **Step 3: Implement** — in `apps/bot/src/features/automation/system/registry.ts`, replace the denylist block (around lines 171-184) with a strict allowlist:

```typescript
  // Strict allowlist: only headers that are safe for the bot to forward on
  // behalf of a guild admin. Denylists are unsafe — any new sensitive
  // header (Authorization, X-Api-Key, X-Forwarded-*, Cookie, etc.) would
  // silently leak. Add to this set only after a security review.
  const ALLOWED_HEADERS = new Set([
    "accept",
    "accept-language",
    "cache-control",
    "user-agent",
    "x-idempotency-key",
    "x-request-id",
  ]);
  const ALLOWED_PREFIX = "x-fluxcore-";

  const userHeaders = config.webhook.headers ?? {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  for (const [key, value] of Object.entries(userHeaders)) {
    const lower = key.toLowerCase();
    if (lower === "content-type") continue; // we set this ourselves
    if (ALLOWED_HEADERS.has(lower) || lower.startsWith(ALLOWED_PREFIX)) {
      headers[key] = value;
    } else {
      logger.warn(
        `sendWebhook: dropped non-allowlisted header "${key}" for guild ${ctx.guildId ?? "unknown"}`,
      );
    }
  }
```

- [ ] **Step 4: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/features/automation/system/registry-webhook.test.ts && docker compose run --rm bot pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** —

```
fix(actions): replace webhook header denylist with strict allowlist

Authorization, X-Api-Key, X-Forwarded-*, and any future sensitive
header could previously be smuggled through sendWebhook because the
filter was a denylist. Switch to an explicit allowlist (Accept,
Cache-Control, User-Agent, X-Idempotency-Key, X-Request-Id, and the
X-Fluxcore-* prefix) and log+drop everything else.
```
