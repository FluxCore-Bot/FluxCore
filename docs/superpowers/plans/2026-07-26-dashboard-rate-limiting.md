# Dashboard Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the dashboard's expensive endpoints real per-user rate limits, and fix the two defects that currently make every rate limit in the codebase key on the reverse proxy's IP address.

**Architecture:** One shared module (`server/shared/rateLimit.ts`) owns the key generator, the 429 body builder, and a table of named tiers. The key generator and body builder are set once when `@fastify/rate-limit` is registered; the plugin merges route-level config over the global options, so every route inherits them. Heavy routes opt into a tier with `config: rateLimits.heavy`.

**Tech Stack:** Fastify 5, `@fastify/rate-limit` 10.3.0, `@fastify/cookie` 11, Vitest 4, TypeScript (strict), i18next (server-side, 48 locales).

**Spec:** `docs/superpowers/specs/2026-07-26-dashboard-rate-limiting-design.md`

## Global Constraints

- **Docker-first.** Never run `pnpm` on the host. Every command in this plan is written in full — use it verbatim.
- **Strict TypeScript.** No `any`. Do not add `as` casts to silence the compiler — an unnecessary cast is what hid the original bug.
- **No new locale keys.** Reuse `errors:server.rateLimited`, which already exists in all 48 locales and is currently unused.
- **Tier values are fixed** (per session, per minute): `heavy` 40, `upload` 10, `external` 5, `create` 10, global default 300.
- **The limiter must never throw.** It runs at `onRequest`, before i18n attaches `request.t`. A throw inside it turns a 429 into a 500.
- **Never judge a test run by a piped exit code** — `pnpm ... | tail` reports tail's status, not the suite's. Run test commands unpiped.

### Running tests in this worktree

The worktree has its own compose project, its own postgres volume, and a `.env.dev` symlink. Deps are already installed and migrations already applied. Use this exact command (the `no-db-port` override is required whenever the main repo's stack is running and holding `127.0.0.1:5432`):

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test
```

To run a single test file, append `-- <path>` — for example `... test -- tests/server/shared/rateLimit.test.ts`.

**Baseline at branch point (`d2e4759`):** 1104 tests / 138 files passing, 0 failures.

---

## File Structure

**Create**

| File | Responsibility |
| --- | --- |
| `apps/dashboard/src/server/shared/rateLimit.ts` | The only place rate limiting policy is defined: key generator, 429 body builder, tier table, global options |
| `apps/dashboard/tests/server/shared/rateLimit.test.ts` | Unit tests for the module in isolation |
| `apps/dashboard/tests/server/features/welcome/imageRateLimit.test.ts` | End-to-end tier behaviour on the two heavy welcome routes |

**Modify**

| File | Change |
| --- | --- |
| `apps/dashboard/src/server/index.ts` | `trustProxy: 1`; register the plugin with `globalRateLimitOptions` |
| `apps/dashboard/src/server/features/welcome/routes.ts` | `heavy` + `upload` tiers; route-level `bodyLimit` |
| `apps/dashboard/src/server/features/discord/routes.ts` | `external` tier |
| `apps/dashboard/src/server/features/guilds/routes.ts` | `external` tier |
| `apps/dashboard/src/server/features/scheduled/routes.ts` | `heavy` tier; delete dead `keyGenerator` |
| `apps/dashboard/src/server/features/commands/routes.ts` | `create` tier; delete dead `keyGenerator` |
| `apps/dashboard/src/server/features/giveaways/routes.ts` | `create` tier; delete dead `keyGenerator` |
| `apps/dashboard/src/client/shared/lib/client.ts` | `ApiError` gains `errorKey` + `retryAfter` |
| `apps/dashboard/src/client/features/welcome/hooks/useWelcome.ts` | 429 branch in the raw-`fetch` preview hook |
| `apps/dashboard/src/client/features/welcome/components/WelcomeImageEditor.tsx` | Distinct toast for 429 |
| `apps/dashboard/tests/server/features/scheduled/cronPreview.test.ts` | Update for the new tier |

**Commits:** six, one per task. This refines the spec's four-commit sketch — the spec folded all tier application into one commit, but welcome and non-welcome routes are independently reviewable.

---

### Task 1: The rate limiting module

This is the whole policy surface. Everything else consumes it.

**Files:**
- Create: `apps/dashboard/src/server/shared/rateLimit.ts`
- Test: `apps/dashboard/tests/server/shared/rateLimit.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `rateLimitKey(request: FastifyRequest): string` — `s:<22-char-base64url>` for a validly signed session cookie, else `ip:<address>`
  - `rateLimitErrorResponse(request: FastifyRequest, context: { after: string }): object` — the 429 body
  - `RATE_LIMITED_ERROR_KEY: "errors:server.rateLimited"`
  - `rateLimits` — `{ heavy, upload, external, create }`, each `{ rateLimit: { max, timeWindow } }`, shaped for a route's `config`
  - `globalRateLimitOptions` — `{ max: 300, timeWindow: "1 minute", keyGenerator, errorResponseBuilder }`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/shared/rateLimit.test.ts`.

`@fluxcore/i18n/server` is mocked so the tests are deterministic and don't depend on locale files being built on disk. `buildApp` mounts a probe route that returns the generated key, so `rateLimitKey` is exercised against a real `FastifyRequest` with real cookie signing rather than a hand-rolled fake.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", dashboardSessionSecret: "s", logLevel: "info" },
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockGetTranslation, mockDetectLanguage } = vi.hoisted(() => ({
  mockGetTranslation: vi.fn(),
  mockDetectLanguage: vi.fn((header?: string) => (header ? header.split(",")[0] : "en")),
}));
vi.mock("@fluxcore/i18n/server", () => ({
  getTranslation: mockGetTranslation,
  detectLanguage: mockDetectLanguage,
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import {
  rateLimitKey,
  rateLimitErrorResponse,
  rateLimits,
  globalRateLimitOptions,
  RATE_LIMITED_ERROR_KEY,
} from "../../../src/server/shared/rateLimit.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  app.get("/probe", async (request) => ({ key: rateLimitKey(request) }));
  await app.ready();
  return app;
}

async function keyFor(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookies?: Record<string, string>,
): Promise<string> {
  const res = await app.inject({ method: "GET", url: "/probe", cookies });
  return res.json().key as string;
}

describe("rateLimitKey", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("derives a session key from a validly signed cookie", async () => {
    const key = await keyFor(app, { session: app.signCookie("session-abc") });
    expect(key).toMatch(/^s:[A-Za-z0-9_-]{22}$/);
  });

  it("returns the same key across requests with the same session", async () => {
    const cookie = { session: app.signCookie("session-abc") };
    expect(await keyFor(app, cookie)).toBe(await keyFor(app, cookie));
  });

  it("returns different keys for different sessions", async () => {
    const a = await keyFor(app, { session: app.signCookie("session-abc") });
    const b = await keyFor(app, { session: app.signCookie("session-xyz") });
    expect(a).not.toBe(b);
  });

  it("never exposes the raw session value in the key", async () => {
    const key = await keyFor(app, { session: app.signCookie("super-secret-session") });
    expect(key).not.toContain("super-secret-session");
  });

  it("falls back to the IP key when the cookie signature is invalid", async () => {
    const key = await keyFor(app, { session: "forged-value-not-signed" });
    expect(key).toMatch(/^ip:/);
  });

  it("falls back to the IP key when no cookie is present", async () => {
    expect(await keyFor(app)).toMatch(/^ip:/);
  });
});

describe("rateLimitErrorResponse", () => {
  beforeEach(() => vi.clearAllMocks());

  function fakeRequest(acceptLanguage?: string) {
    return { headers: { "accept-language": acceptLanguage } } as never;
  }

  it("returns a 429 body carrying the translation key and retry hint", () => {
    mockGetTranslation.mockReturnValue(() => "Trop de requetes.");
    const body = rateLimitErrorResponse(fakeRequest("fr"), { after: "30 seconds" });
    expect(body).toEqual({
      statusCode: 429,
      error: "Trop de requetes.",
      errorKey: RATE_LIMITED_ERROR_KEY,
      retryAfter: "30 seconds",
    });
  });

  it("translates using the Accept-Language header", () => {
    mockGetTranslation.mockReturnValue(() => "translated");
    rateLimitErrorResponse(fakeRequest("de-DE,de;q=0.9"), { after: "1 minute" });
    expect(mockDetectLanguage).toHaveBeenCalledWith("de-DE,de;q=0.9");
    expect(mockGetTranslation).toHaveBeenCalledWith("de-DE");
  });

  it("falls back to English when i18n is not initialized", () => {
    mockGetTranslation.mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'getFixedT')");
    });
    const body = rateLimitErrorResponse(fakeRequest("en"), { after: "1 minute" }) as {
      error: string;
    };
    expect(body.error).toBe("Too many requests. Please try again later.");
  });

  it("falls back to English when the key resolves to itself (namespace not loaded)", () => {
    mockGetTranslation.mockReturnValue(() => RATE_LIMITED_ERROR_KEY);
    const body = rateLimitErrorResponse(fakeRequest("en"), { after: "1 minute" }) as {
      error: string;
    };
    expect(body.error).toBe("Too many requests. Please try again later.");
  });
});

describe("rateLimits tiers", () => {
  it("defines the agreed ceilings", () => {
    expect(rateLimits.heavy.rateLimit.max).toBe(40);
    expect(rateLimits.upload.rateLimit.max).toBe(10);
    expect(rateLimits.external.rateLimit.max).toBe(5);
    expect(rateLimits.create.rateLimit.max).toBe(10);
  });

  it("uses a one minute window for every tier", () => {
    for (const tier of Object.values(rateLimits)) {
      expect(tier.rateLimit.timeWindow).toBe("1 minute");
    }
  });
});

describe("globalRateLimitOptions", () => {
  it("defaults to 300 per minute and wires the shared key and error builder", () => {
    expect(globalRateLimitOptions.max).toBe(300);
    expect(globalRateLimitOptions.timeWindow).toBe("1 minute");
    expect(globalRateLimitOptions.keyGenerator).toBe(rateLimitKey);
    expect(globalRateLimitOptions.errorResponseBuilder).toBe(rateLimitErrorResponse);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/server/shared/rateLimit.test.ts
```

Expected: FAIL — cannot resolve `../../../src/server/shared/rateLimit.js`.

- [ ] **Step 3: Write the implementation**

Create `apps/dashboard/src/server/shared/rateLimit.ts`:

```typescript
import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { getTranslation, detectLanguage } from "@fluxcore/i18n/server";

/**
 * The i18n key for the 429 message. Already present in all 48 locales.
 */
export const RATE_LIMITED_ERROR_KEY = "errors:server.rateLimited";

/**
 * English text of RATE_LIMITED_ERROR_KEY, used when i18n cannot answer.
 */
const RATE_LIMITED_FALLBACK = "Too many requests. Please try again later.";

/**
 * Only the field this module reads. Declaring it locally rather than importing
 * the plugin's context type keeps the signature independent of the plugin's
 * type-export shape; it stays assignable because a wider parameter type is
 * accepted contravariantly.
 */
interface RateLimitContext {
  after: string;
}

/**
 * Identify the client a rate limit bucket belongs to.
 *
 * Keyed on the session cookie because that is the only stable client identity
 * available at `onRequest`, which is when the limiter runs — `request.session`
 * is not populated until `requireAuth`, a route-level `preHandler`. Reading it
 * here would silently yield `undefined` for every request.
 *
 * Safe to call at `onRequest`: `@fastify/cookie` is registered before
 * `@fastify/rate-limit`, so `cookies` and `unsignCookie` are already available.
 *
 * Only signature-valid cookies produce a session key, so a client cannot mint
 * unlimited buckets by inventing cookie values. The value is hashed so raw
 * session ids never reach store keys or the plugin's `onExceeded` logging.
 */
export function rateLimitKey(request: FastifyRequest): string {
  const cookie = request.cookies?.session;
  if (cookie) {
    const unsigned = request.unsignCookie(cookie);
    if (unsigned.valid && unsigned.value) {
      const digest = createHash("sha256").update(unsigned.value).digest("base64url");
      return `s:${digest.slice(0, 22)}`;
    }
  }
  return `ip:${request.ip}`;
}

/**
 * Build the 429 body.
 *
 * Resolves its own translator instead of using `request.t`: i18n attaches `t`
 * in a `preHandler` while this runs at `onRequest`, so `request.t` is undefined
 * here and calling it would throw — turning a 429 into a 500. Translation
 * failures degrade to English rather than propagating, so the limiter can never
 * be the thing that breaks a request.
 */
export function rateLimitErrorResponse(
  request: FastifyRequest,
  context: RateLimitContext,
): object {
  let message = RATE_LIMITED_FALLBACK;
  try {
    const t = getTranslation(detectLanguage(request.headers["accept-language"]));
    const translated = t(RATE_LIMITED_ERROR_KEY);
    // i18next echoes the key back when the namespace is not loaded.
    if (translated && translated !== RATE_LIMITED_ERROR_KEY) {
      message = translated;
    }
  } catch {
    // i18n not initialized yet (early startup, tests) — keep the fallback.
  }

  return {
    statusCode: 429,
    error: message,
    errorKey: RATE_LIMITED_ERROR_KEY,
    retryAfter: context.after,
  };
}

/**
 * Named tiers for expensive routes. Spread into a route's `config`:
 *
 *     app.post("/path", { config: rateLimits.heavy, ... })
 *
 * Values are per session, per minute. `heavy` sits above the ~25/min a slider
 * drag in the image editor produces, so ordinary editing never trips it.
 *
 * Routes without a tier fall back to `globalRateLimitOptions`. Every tier
 * inherits the shared key generator and error builder via the plugin's
 * route/global config merge.
 */
export const rateLimits = {
  /** CPU- or network-expensive rendering and preview work. */
  heavy: { rateLimit: { max: 40, timeWindow: "1 minute" } },
  /** Large request bodies written to storage. */
  upload: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  /** Cache-busting fanout to the Discord API. */
  external: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  /** Resource creation. */
  create: { rateLimit: { max: 10, timeWindow: "1 minute" } },
} as const;

/**
 * Options for the single global plugin registration. Setting the key generator
 * and error builder here is enough for every route: the plugin merges route
 * config over these globals, so routes that do not override them inherit them.
 */
export const globalRateLimitOptions = {
  max: 300,
  timeWindow: "1 minute",
  keyGenerator: rateLimitKey,
  errorResponseBuilder: rateLimitErrorResponse,
};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/server/shared/rateLimit.test.ts
```

Expected: PASS — 13 tests.

- [ ] **Step 5: Typecheck**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm --no-deps bot \
  pnpm turbo run typecheck --filter=@fluxcore/dashboard
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/server/shared/rateLimit.ts \
        apps/dashboard/tests/server/shared/rateLimit.test.ts
git commit -m "feat(dashboard): add a shared rate limiting policy module"
```

---

### Task 2: Wire the module into the app

Without this task the module is dead code and the shared-bucket defect is still live.

**Files:**
- Modify: `apps/dashboard/src/server/index.ts:58` (Fastify constructor) and `:66-69` (plugin registration)

**Interfaces:**
- Consumes: `globalRateLimitOptions` from Task 1.
- Produces: nothing new. After this, every route's limit is keyed per session and every 429 body is the shared shape.

`index.ts` is excluded from coverage (`vitest.config.ts`) and `createApp` opens a real DB connection, so it has no direct unit test. Task 1 covers the options object it passes, and Tasks 3-4 cover the behaviour end to end. Verification here is typecheck plus the full suite.

- [ ] **Step 1: Add the import**

In `apps/dashboard/src/server/index.ts`, alongside the other `./shared/` imports:

```typescript
import { globalRateLimitOptions } from "./shared/rateLimit.js";
```

- [ ] **Step 2: Trust exactly one proxy hop**

Replace:

```typescript
  const app = Fastify({ logger: false });
```

with:

```typescript
  // Production terminates TLS at Caddy (docker/Caddyfile: reverse_proxy
  // dashboard:3000), so request.ip is Caddy's container address unless we trust
  // the forwarded header. Without this every client shares one rate limit
  // bucket. A fixed hop count rather than `true`: `true` trusts the whole
  // X-Forwarded-For chain, letting a client spoof its own address. Raise this
  // if another proxy (a CDN, say) is ever put in front of Caddy.
  const app = Fastify({ logger: false, trustProxy: 1 });
```

- [ ] **Step 3: Register the plugin with the shared options**

Replace:

```typescript
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });
```

with:

```typescript
  await app.register(fastifyRateLimit, globalRateLimitOptions);
```

- [ ] **Step 4: Typecheck**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm --no-deps bot \
  pnpm turbo run typecheck --filter=@fluxcore/dashboard
```

Expected: no errors.

- [ ] **Step 5: Run the full dashboard suite for regressions**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test
```

Expected: PASS — 459 tests, same as baseline.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/server/index.ts
git commit -m "fix(dashboard): trust one proxy hop and key rate limits per session"
```

---

### Task 3: Tier the welcome image routes

The endpoints this whole change exists for.

**Files:**
- Modify: `apps/dashboard/src/server/features/welcome/routes.ts:187` (preview), `:247` (upload), `:324` (delete)
- Test: `apps/dashboard/tests/server/features/welcome/imageRateLimit.test.ts`

**Interfaces:**
- Consumes: `rateLimits` and `globalRateLimitOptions` from Task 1.
- Produces: nothing new.

The test asserts on `errorKey` rather than the message, so it does not depend on locale files being present. It registers the plugin with `globalRateLimitOptions` to mirror `index.ts`, so the key generator under test is the real one.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/features/welcome/imageRateLimit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", dashboardSessionSecret: "s", logLevel: "info" },
}));

vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: vi.fn().mockResolvedValue({
    // Must be a numeric snowflake: with a null avatar the preview route
    // computes a default via BigInt(session.userId), which throws on a
    // non-numeric id and turns the response into a 500.
    userId: "123456789012345678",
    username: "u",
    avatar: "abc123",
    guilds: [{ id: "guild-1", name: "T", permissions: BigInt(0x20).toString() }],
  }),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: vi.fn().mockResolvedValue(true),
  getGuildOwnerId: vi.fn().mockResolvedValue("owner-1"),
}));
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: vi.fn().mockResolvedValue({ permissions: new Set(["*"]), isOwner: true }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@fluxcore/systems/welcome/image", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@fluxcore/systems/welcome/image");
  return {
    ...actual,
    createStorageAdapter: () => ({
      upload: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }),
    MAX_BACKGROUND_SIZE: 5 * 1024 * 1024,
    ALLOWED_BACKGROUND_TYPES: ["image/png", "image/jpeg", "image/webp"],
    PRESET_BACKGROUNDS: [],
    DEFAULT_WELCOME_IMAGE_SETTINGS: {},
    DEFAULT_FAREWELL_IMAGE_SETTINGS: {},
    welcomeImageSettingsSchema: { safeParse: () => ({ success: true, data: {} }) },
    // Rendering is irrelevant here and slow — return a stub buffer.
    generateWelcomeImage: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    getAllTemplates: () => [],
    getAvailableFonts: () => [],
  };
});
vi.mock("@fluxcore/systems/welcome/config", () => ({
  getWelcomeConfig: vi.fn(),
  upsertWelcomeConfig: vi.fn(),
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import { registerWelcomeRoutes } from "../../../../src/server/features/welcome/routes.js";
import { globalRateLimitOptions } from "../../../../src/server/shared/rateLimit.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  // Mirror index.ts so the real key generator and error builder are exercised.
  await app.register(fastifyRateLimit, globalRateLimitOptions);
  registerWelcomeRoutes(app);
  await app.ready();
  return app;
}

// detectImageType needs >= 12 bytes and matching PNG magic bytes.
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG = Buffer.concat([PNG_HEADER, Buffer.alloc(16)]).toString("base64");

function previewRequest(app: Awaited<ReturnType<typeof buildApp>>, session: string) {
  return app.inject({
    method: "POST",
    url: "/api/guilds/guild-1/welcome/image/preview",
    cookies: { session: app.signCookie(session) },
    payload: { settings: {}, type: "welcome" },
  });
}

function uploadRequest(app: Awaited<ReturnType<typeof buildApp>>, session: string) {
  return app.inject({
    method: "POST",
    url: "/api/guilds/guild-1/welcome/image/background",
    cookies: { session: app.signCookie(session) },
    payload: { data: PNG, contentType: "image/png" },
  });
}

describe("welcome image endpoints — rate limiting", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("allows 40 previews then rejects the 41st", async () => {
    for (let i = 0; i < 40; i++) {
      const res = await previewRequest(app, "session-a");
      expect(res.statusCode).toBe(200);
    }
    const blocked = await previewRequest(app, "session-a");
    expect(blocked.statusCode).toBe(429);
  });

  it("returns the shared error key and a Retry-After header on 429", async () => {
    for (let i = 0; i < 40; i++) await previewRequest(app, "session-a");
    const blocked = await previewRequest(app, "session-a");

    expect(blocked.json().errorKey).toBe("errors:server.rateLimited");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("gives separate sessions separate buckets", async () => {
    // Regression test for the shared-bucket defect: before per-session keying,
    // one client exhausting the limit blocked everyone else.
    for (let i = 0; i < 40; i++) await previewRequest(app, "session-a");
    expect((await previewRequest(app, "session-a")).statusCode).toBe(429);

    const otherUser = await previewRequest(app, "session-b");
    expect(otherUser.statusCode).toBe(200);
  });

  it("allows 10 background uploads then rejects the 11th", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await uploadRequest(app, "session-c");
      expect(res.statusCode).toBe(200);
    }
    const blocked = await uploadRequest(app, "session-c");
    expect(blocked.statusCode).toBe(429);
  });

  it("counts uploads separately from previews", async () => {
    // Distinct routes get distinct child stores, so exhausting one must not
    // consume the other's budget.
    for (let i = 0; i < 10; i++) await uploadRequest(app, "session-d");
    expect((await uploadRequest(app, "session-d")).statusCode).toBe(429);

    expect((await previewRequest(app, "session-d")).statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/server/features/welcome/imageRateLimit.test.ts
```

Expected: FAIL — the 41st preview returns 200, because the route has no tier and the global 300/min has not been reached.

- [ ] **Step 3: Add the import to the welcome routes**

In `apps/dashboard/src/server/features/welcome/routes.ts`, after the `middleware.js` import:

```typescript
import { rateLimits } from "../../shared/rateLimit.js";
```

- [ ] **Step 4: Apply the `heavy` tier to the preview route**

At `apps/dashboard/src/server/features/welcome/routes.ts:187`, in the preview route's options object, add `config` immediately after `preHandler`:

```typescript
  app.post(
    "/api/guilds/:guildId/welcome/image/preview",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.config.view")],
      // Full canvas render with a synchronous PNG encode plus a Discord CDN
      // avatar fetch. The editor re-fires this on every settings change behind
      // a 400ms debounce, so the ceiling sits above a slider drag's ~25/min.
      config: rateLimits.heavy,
      schema: withDocs(
```

- [ ] **Step 5: Apply the `upload` tier to the background upload route**

At `apps/dashboard/src/server/features/welcome/routes.ts:247`:

```typescript
  app.post(
    "/api/guilds/:guildId/welcome/image/background",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.config.manage")],
      // Decodes up to 3MB of base64 and writes it to storage.
      config: rateLimits.upload,
      schema: withDocs(
```

- [ ] **Step 6: Apply the `upload` tier to the background delete route**

At `apps/dashboard/src/server/features/welcome/routes.ts:324`:

```typescript
  app.delete(
    "/api/guilds/:guildId/welcome/image/background",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.config.manage")],
      // Storage mutation; pairs with the upload route.
      config: rateLimits.upload,
      schema: withDocs(
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/server/features/welcome/imageRateLimit.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 8: Run the other welcome tests for regressions**

The existing `imageUpload.test.ts` and `imagePreviewHeaders.test.ts` build an app *without* the rate limit plugin. Routes carrying a `config.rateLimit` still work when the plugin is absent — the config is inert — so these should be unaffected. Confirm it:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/server/features/welcome
```

Expected: PASS — all welcome test files.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/src/server/features/welcome/routes.ts \
        apps/dashboard/tests/server/features/welcome/imageRateLimit.test.ts
git commit -m "feat(welcome): rate limit image preview, upload and delete"
```

---

### Task 4: Tier the remaining expensive routes

Retires the last ad-hoc configs, including the three dead `keyGenerator`s.

**Files:**
- Modify: `apps/dashboard/src/server/features/discord/routes.ts:125`
- Modify: `apps/dashboard/src/server/features/guilds/routes.ts:83`
- Modify: `apps/dashboard/src/server/features/scheduled/routes.ts:273-280`
- Modify: `apps/dashboard/src/server/features/commands/routes.ts:57-65`
- Modify: `apps/dashboard/src/server/features/giveaways/routes.ts:57-65`
- Modify: `apps/dashboard/tests/server/features/scheduled/cronPreview.test.ts:75-87`

**Interfaces:**
- Consumes: `rateLimits` from Task 1.
- Produces: nothing new.

After this task no `keyGenerator` remains anywhere under `features/` — all keying comes from the global option.

- [ ] **Step 1: Update the cron preview test to the new tier**

In `apps/dashboard/tests/server/features/scheduled/cronPreview.test.ts`, `buildApp` registers `fastifyRateLimit` with `{ global: false }`, which means route configs still apply but there is no global default. Keep that, and replace the first test (lines 75-87) with:

```typescript
  it("returns 429 after exceeding 40 requests per minute", async () => {
    const cookie = { session: app.signCookie("valid") };
    const url = "/api/guilds/guild-1/scheduled-messages/preview-cron?cronExpr=*+*+*+*+*";

    // Assert the allowed requests succeed, not just that the last one fails —
    // the old 5-per-10s limit would also leave a 429 at the end, so a
    // last-status-only check would pass against the unchanged route.
    for (let i = 0; i < 40; i++) {
      const res = await app.inject({ method: "GET", url, cookies: cookie });
      expect(res.statusCode).toBe(200);
    }

    const blocked = await app.inject({ method: "GET", url, cookies: cookie });
    expect(blocked.statusCode).toBe(429);
  });
```

- [ ] **Step 2: Run it to verify it fails**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/server/features/scheduled/cronPreview.test.ts
```

Expected: FAIL at the 6th iteration — `expected 429 to be 200`, because the route still allows only 5 per 10 seconds.

- [ ] **Step 3: Retier the cron preview route**

In `apps/dashboard/src/server/features/scheduled/routes.ts`, add the import next to the other `../../shared/` imports:

```typescript
import { rateLimits } from "../../shared/rateLimit.js";
```

Then replace the config block at lines 273-280:

```typescript
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "10 seconds",
          keyGenerator: (req) =>
            (req as { session?: { userId?: string } }).session?.userId ?? req.ip,
        },
      },
```

with:

```typescript
      // Fires on every keystroke in the cron field.
      config: rateLimits.heavy,
```

- [ ] **Step 4: Run the cron test to verify it passes**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/server/features/scheduled/cronPreview.test.ts
```

Expected: PASS — 2 tests.

- [ ] **Step 5: Retier the two refresh routes**

In `apps/dashboard/src/server/features/discord/routes.ts`, add the import next to the other `../../shared/` imports:

```typescript
import { rateLimits } from "../../shared/rateLimit.js";
```

Replace line 125:

```typescript
      config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
```

with:

```typescript
      // Busts the 60s Discord API cache in shared/discordApi.ts.
      config: rateLimits.external,
```

In `apps/dashboard/src/server/features/guilds/routes.ts`, add the same import, then replace line 83:

```typescript
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
```

with:

```typescript
      // Re-fetches the user's guild list from the Discord OAuth API.
      config: rateLimits.external,
```

- [ ] **Step 6: Retier the two create routes**

In `apps/dashboard/src/server/features/commands/routes.ts`, add the import, then replace the config block at lines 57-65:

```typescript
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          keyGenerator: (req) =>
            (req as { session?: { userId?: string } }).session?.userId ?? req.ip,
        },
      },
```

with:

```typescript
      config: rateLimits.create,
```

Apply the identical change in `apps/dashboard/src/server/features/giveaways/routes.ts` at lines 57-65 (same import, same replacement — the two blocks are character-identical).

- [ ] **Step 7: Verify no dead key generators remain**

```bash
grep -rn "keyGenerator" apps/dashboard/src/server/features/
```

Expected: no output.

- [ ] **Step 8: Typecheck and run the full dashboard suite**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm --no-deps bot \
  pnpm turbo run typecheck --filter=@fluxcore/dashboard
```

Expected: no errors. Then:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/src/server/features/discord/routes.ts \
        apps/dashboard/src/server/features/guilds/routes.ts \
        apps/dashboard/src/server/features/scheduled/routes.ts \
        apps/dashboard/src/server/features/commands/routes.ts \
        apps/dashboard/src/server/features/giveaways/routes.ts \
        apps/dashboard/tests/server/features/scheduled/cronPreview.test.ts
git commit -m "feat(dashboard): tier the remaining rate-limited routes"
```

---

### Task 5: Surface 429s in the image editor

Without this the editor shows "preview failed" for a rate limit, which reads as a bug.

**Files:**
- Modify: `apps/dashboard/src/client/shared/lib/client.ts:1-9` (ApiError), `:70-83` (error path)
- Modify: `apps/dashboard/src/client/features/welcome/hooks/useWelcome.ts:154-171`
- Modify: `apps/dashboard/src/client/features/welcome/components/WelcomeImageEditor.tsx:165-170`

**Interfaces:**
- Consumes: the 429 body shape from Task 1 — `{ statusCode, error, errorKey, retryAfter }`.
- Produces: `ApiError` with `status: number`, `message: string`, `errorKey?: string`, `retryAfter?: number`.

- [ ] **Step 1: Extend ApiError**

In `apps/dashboard/src/client/shared/lib/client.ts`, replace the class declaration:

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
```

with:

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** i18n key for the message, so the client can translate in the user's own language. */
    public errorKey?: string,
    /** Seconds to wait before retrying, from the Retry-After header. */
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
```

- [ ] **Step 2: Populate the new fields in apiFetch**

In the same file, replace the error branch:

```typescript
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data as { error?: string }).error || "Request failed",
    );
  }
```

with:

```typescript
  if (!res.ok) {
    const body = data as { error?: string; errorKey?: string };
    const retryAfter = Number(res.headers.get("retry-after"));
    throw new ApiError(
      res.status,
      body.error || "Request failed",
      body.errorKey,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    );
  }
```

- [ ] **Step 3: Throw a typed error from the preview hook**

`useWelcomeImagePreview` uses raw `fetch` to read a blob, so it bypasses `apiFetch` and needs its own branch. In `apps/dashboard/src/client/features/welcome/hooks/useWelcome.ts`, replace:

```typescript
      if (!res.ok) throw new Error("welcome.imageEditor.toast.previewFailed");
```

with:

```typescript
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string; errorKey?: string }
          | null;
        const retryAfter = Number(res.headers.get("retry-after"));
        throw new ApiError(
          res.status,
          body?.error || "welcome.imageEditor.toast.previewFailed",
          body?.errorKey,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
        );
      }
```

Extend the existing client-lib import at `useWelcome.ts:2` rather than adding a second one:

```typescript
import { apiFetch, getCsrfToken, ApiError } from "../../../shared/lib/client";
```

- [ ] **Step 4: Show a distinct toast for 429**

In `apps/dashboard/src/client/features/welcome/components/WelcomeImageEditor.tsx`, replace the preview mutation's error handler:

```typescript
          onError: () => {
            setIsPending(false);
            setPreviewError(true);
            toast.error(t("imageEditor.toast.previewFailed"));
          },
```

with:

```typescript
          onError: (error) => {
            setIsPending(false);
            setPreviewError(true);
            // A rate limit is not a failed render — say so, or it reads as a bug.
            const key =
              error instanceof ApiError && error.status === 429
                ? error.errorKey ?? "errors:server.rateLimited"
                : "imageEditor.toast.previewFailed";
            toast.error(t(key));
          },
```

This file has no client-lib import yet. Add one alongside the other `../../../shared/` imports (near `useAuth` at line 41):

```typescript
import { ApiError } from "../../../shared/lib/client";
```

- [ ] **Step 5: Typecheck**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm --no-deps bot \
  pnpm turbo run typecheck --filter=@fluxcore/dashboard
```

Expected: no errors. If `t(key)` complains that a dynamic string is not a known key, cast the argument at the call site with `t(key as never)` — the keys are validated by the two literals above it.

- [ ] **Step 6: Run the full dashboard suite**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/client/shared/lib/client.ts \
        apps/dashboard/src/client/features/welcome/hooks/useWelcome.ts \
        apps/dashboard/src/client/features/welcome/components/WelcomeImageEditor.tsx
git commit -m "feat(welcome): surface rate-limit errors in the image editor"
```

---

### Task 6: Fix the background upload body limit

A pre-existing bug, in the blast radius of Task 3. Background upload currently fails for any file over roughly 750 KB, so the `upload` tier added in Task 3 guards an endpoint that does not work for realistic inputs.

`MAX_BACKGROUND_SIZE` is 3 MB but Fastify's default `bodyLimit` is 1 MB and is never overridden. A 3 MB image base64-encodes to about 4 MB, so Fastify returns 413 before the handler's own size check — and its own check is the one that returns the specific, friendly error.

**Files:**
- Modify: `apps/dashboard/src/server/features/welcome/routes.ts:247`
- Test: `apps/dashboard/tests/server/features/welcome/imageUpload.test.ts`

**Interfaces:**
- Consumes: `MAX_BACKGROUND_SIZE` from `@fluxcore/systems/welcome/image` (already imported in the routes file).
- Produces: nothing new.

Note: `imageUpload.test.ts` mocks `MAX_BACKGROUND_SIZE` as 5 MB, so the new test must size its payload against the real 3 MB constant to be meaningful. Put the test in a new `describe` block in that same file and derive sizes from the mocked value so the two stay consistent.

- [ ] **Step 1: Write the failing test**

Append to `apps/dashboard/tests/server/features/welcome/imageUpload.test.ts`:

```typescript
describe("POST /api/guilds/:guildId/welcome/image/background — body limit", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("accepts a 2MB image rather than rejecting it at the transport layer", async () => {
    // Well under the mocked 5MB MAX_BACKGROUND_SIZE, but its base64 form is
    // ~2.7MB — over Fastify's 1MB default bodyLimit, which would 413 before
    // the handler ever runs.
    const twoMb = Buffer.concat([PNG_HEADER, Buffer.alloc(2 * 1024 * 1024)]);
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/welcome/image/background",
      cookies: { session: app.signCookie("valid") },
      payload: { data: twoMb.toString("base64"), contentType: "image/png" },
    });

    expect(res.statusCode).toBe(200);
  });

  it("still rejects a payload beyond the configured maximum", async () => {
    // Above the mocked 5MB MAX_BACKGROUND_SIZE — must be refused, either by the
    // handler's own check (400) or by the transport limit (413).
    const tooBig = Buffer.concat([PNG_HEADER, Buffer.alloc(6 * 1024 * 1024)]);
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/welcome/image/background",
      cookies: { session: app.signCookie("valid") },
      payload: { data: tooBig.toString("base64"), contentType: "image/png" },
    });

    expect([400, 413]).toContain(res.statusCode);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/server/features/welcome/imageUpload.test.ts
```

Expected: FAIL — the 2 MB case returns 413, not 200.

- [ ] **Step 3: Add the derived limit constant**

In `apps/dashboard/src/server/features/welcome/routes.ts`, below the `const storage = createStorageAdapter();` line:

```typescript
/**
 * Fastify's default bodyLimit is 1MB, which rejects a legitimate
 * MAX_BACKGROUND_SIZE upload with a bare 413 before the handler's own size
 * check — and that check is what returns the specific, friendly error naming
 * the real limit. Derived rather than hardcoded so it cannot drift from
 * MAX_BACKGROUND_SIZE. Base64 inflates by 4/3; 8KB covers the JSON envelope.
 */
const BACKGROUND_BODY_LIMIT = Math.ceil((MAX_BACKGROUND_SIZE * 4) / 3) + 8 * 1024;
```

- [ ] **Step 4: Apply it to the upload route**

At the background upload route (the same options object that got `config: rateLimits.upload` in Task 3), add `bodyLimit` as a sibling of `config` and `preHandler`:

```typescript
  app.post(
    "/api/guilds/:guildId/welcome/image/background",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.config.manage")],
      // Decodes up to 3MB of base64 and writes it to storage.
      config: rateLimits.upload,
      bodyLimit: BACKGROUND_BODY_LIMIT,
      schema: withDocs(
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/server/features/welcome/imageUpload.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 6: Run the whole suite**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm turbo run test
```

Expected: PASS — 1104 baseline tests plus the ones added here, 0 failures.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/server/features/welcome/routes.ts \
        apps/dashboard/tests/server/features/welcome/imageUpload.test.ts
git commit -m "fix(welcome): raise the body limit for background uploads"
```

---

## Verification

After Task 6, confirm the whole change:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm --no-deps bot \
  pnpm turbo run typecheck
```

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot run --rm bot \
  pnpm turbo run test
```

```bash
grep -rn "keyGenerator" apps/dashboard/src/server/features/   # expect no output
grep -rn "rateLimit:" apps/dashboard/src/server/features/     # expect only auth/routes.ts
```

`auth/routes.ts` keeps its inline `{ max: 10, timeWindow: "1 minute" }` — it is not an expensive endpoint and its 10/min value is unchanged. It now benefits from correct keying for free, via the global key generator.

## Known Gaps After This Plan

- **Render concurrency is still unbounded.** `canvas.toBuffer` is synchronous, so concurrent previews from *different* users still serialise on the event loop. Rate limiting bounds per-user frequency, not simultaneity. Declined during design; recorded in the spec's Non-Goals.
- **Counters reset on restart.** In-memory store, single instance.
- **The CDN avatar fetch has no timeout** (`renderer.ts:141`), so a slow Discord response still holds a request open.
