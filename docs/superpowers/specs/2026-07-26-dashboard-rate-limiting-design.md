# Tiered Rate Limiting for Heavy Dashboard Endpoints

**Date:** 2026-07-26
**Branch:** `worktree-feat+dashboard-rate-limiting`
**Status:** Approved

## Problem

The welcome image generation endpoint — the most expensive request the dashboard
serves — has no rate limit of its own. Investigating that surfaced two defects
that make the *existing* rate limiting ineffective, so fixing them is a
prerequisite rather than a side quest.

### 1. The global limit is one shared bucket in production

`apps/dashboard/src/server/index.ts` registers `@fastify/rate-limit` at
100 requests/minute with the default key generator, which uses `request.ip`.
Fastify is constructed without `trustProxy`, and production runs behind Caddy
(`docker/Caddyfile`: `reverse_proxy dashboard:3000`).

`request.ip` is therefore Caddy's container IP for **every** request. All users
share a single 100/minute budget for the entire deployment. Two consequences:

- Normal traffic self-throttles once a handful of people use the dashboard.
- One client can lock out every other user by exhausting the shared bucket.

### 2. Per-route `keyGenerator`s silently never work

Eight routes carry a per-route limit. Three of them — custom-command create,
giveaway create, and cron preview — define a key generator that reads the
session:

```ts
keyGenerator: (req) =>
  (req as { session?: { userId?: string } }).session?.userId ?? req.ip
```

`@fastify/rate-limit` runs on the `onRequest` hook, but `requireAuth` — which
assigns `request.session` — is a route-level `preHandler`. `onRequest` always
precedes `preHandler`, so `session` is invariably `undefined` and every one of
these falls through to `req.ip`, i.e. the Caddy IP from defect #1.

The `as` cast is also unnecessary: `session` is already declared on
`FastifyRequest` in `shared/middleware.ts`. The cast is what hid the bug from
the type checker.

The remaining five limited routes (both `refresh` routes and the two auth
routes) define no key generator at all, so they use the plugin's IP default —
which defect #1 has already reduced to Caddy's address. Every per-route limit in
the codebase is therefore keyed on the same single value today.

### 3. Heavy endpoints have no limit at all

| Endpoint | Cost |
| --- | --- |
| `POST /api/guilds/:guildId/welcome/image/preview` | Full canvas render; `canvas.toBuffer("image/png")` at `renderer.ts:419` is **synchronous**, so PNG encoding blocks the event loop. Also fetches the member avatar from Discord's CDN per request (`renderer.ts:141`) with no timeout. |
| `POST /api/guilds/:guildId/welcome/image/background` | Decodes up to 3 MB of base64, sniffs magic bytes, writes to disk. |

The client makes the preview problem worse: `WelcomeImageEditor.tsx:149-175`
re-fires the request on **every** settings change behind a 400 ms debounce, so
dragging a slider legitimately produces roughly 15-25 requests/minute.

## Goals

- Every rate limit is keyed to an actual client, not to the reverse proxy.
- Expensive endpoints carry limits proportional to their cost.
- Limits are defined in one place and are greppable.
- A 429 is translated and actionable in the UI.
- No new locale keys (`errors:server.rateLimited` already exists in all 48
  locales and is currently unused).

## Non-Goals

These were considered and explicitly excluded:

- **Render concurrency gate.** A rate limit bounds how often *one* user renders;
  it does not bound how many renders run *at once*. Because `toBuffer` is
  synchronous, concurrent renders still serialise and stall the event loop for
  all requests. Declined for this change; the exposure remains.
- **Redis-backed store.** The deployment runs a single dashboard instance, so
  the in-memory `LocalStore` is correct. Consequence: counters reset on restart
  or redeploy.
- **Worker-thread render pool.** Larger change, new failure surface.
- **Bot-side rate limiting.** Out of scope.

## Design

### Component 1 — `apps/dashboard/src/server/shared/rateLimit.ts` (new)

The single source of rate limiting policy. Three exports.

**`rateLimitKey(req)`** — the shared key generator.

```ts
export function rateLimitKey(req: FastifyRequest): string {
  const cookie = req.cookies?.session;
  if (cookie) {
    const unsigned = req.unsignCookie(cookie);
    if (unsigned.valid && unsigned.value) {
      return `s:${sha256(unsigned.value)}`;
    }
  }
  return `ip:${req.ip}`;
}
```

Keys on the session cookie because it is the only stable client identity
available at `onRequest`. This is safe: `@fastify/cookie` is registered before
`@fastify/rate-limit` in `index.ts`, so `req.cookies` and `req.unsignCookie` are
both populated by the time the limiter runs.

The cookie value is hashed — SHA-256, base64url-encoded, truncated to the first
22 characters (132 bits, far beyond collision concern for concurrent sessions) —
so raw session identifiers never reach store keys or the plugin's `onExceeded`
logging.

Only signature-valid cookies produce a session key; a forged or tampered cookie
falls back to IP, so an attacker cannot mint unlimited buckets by inventing
cookie values.

Trade-off: the key is per *session*, not per *user*. One person logged in from
two browsers gets two buckets. Accepted — the alternative required either a DB
lookup inside the limiter or restructuring auth into a global hook.

**`rateLimitErrorResponse(req, ctx)`** — the shared 429 body builder.

```ts
export function rateLimitErrorResponse(req, ctx) {
  const t = getTranslation(detectLanguage(req.headers["accept-language"]));
  return {
    statusCode: 429,
    error: t("errors:server.rateLimited"),
    errorKey: "errors:server.rateLimited",
    retryAfter: ctx.after,
  };
}
```

It **must not** use `request.t`. The i18n plugin attaches `t` in a `preHandler`
(`shared/i18n.ts:30`) while the limiter runs at `onRequest`, so `request.t` is
`undefined` there and calling it would throw a `TypeError` inside the limiter —
turning a 429 into a 500. Resolving its own translator from `Accept-Language`
removes the ordering dependency entirely.

The `{ error, errorKey }` shape matches the convention already used by
`requireAuth` and the other middleware.

**`rateLimits`** — the tier table.

```ts
export const rateLimits = {
  heavy:    { rateLimit: { max: 40, timeWindow: "1 minute" } },
  upload:   { rateLimit: { max: 10, timeWindow: "1 minute" } },
  external: { rateLimit: { max: 5,  timeWindow: "1 minute" } },
  create:   { rateLimit: { max: 10, timeWindow: "1 minute" } },
} as const;
```

Values are per session per minute. `heavy` is set at 40 specifically to sit
above the ~25/minute a slider drag produces, so ordinary editing never trips it.

### Component 2 — `apps/dashboard/src/server/index.ts` (modified)

```ts
const app = Fastify({ logger: false, trustProxy: 1 });

await app.register(fastifyRateLimit, {
  max: 300,
  timeWindow: "1 minute",
  keyGenerator: rateLimitKey,
  errorResponseBuilder: rateLimitErrorResponse,
});
```

`trustProxy: 1` trusts exactly one hop, matching `Caddy → dashboard:3000`.
`trustProxy: true` would trust the entire `X-Forwarded-For` chain and let a
client spoof its own IP by supplying the header; a fixed hop count cannot be
spoofed this way. If a CDN is ever placed in front of Caddy this becomes `2`.

The global default rises from 100 to 300 because it is now a genuine per-session
budget rather than one deployment-wide bucket. A dashboard page load issues
several API calls, so 100/minute per session would be too tight.

Setting `keyGenerator` and `errorResponseBuilder` once at registration is
sufficient for every route. The plugin merges route configuration over the
global parameters (`mergeParams(globalParams, routeOptions.config.rateLimit)` in
its `onRoute` hook), so any route that does not override these inherits them.
This is what lets the three dead per-route `keyGenerator`s simply be deleted
rather than repaired.

Each route carrying a `config.rateLimit` also gets its own child store, so tiers
do not share counters across routes.

### Component 3 — Tier assignment

| Route | Tier | Current | Rationale |
| --- | --- | --- | --- |
| `POST /api/guilds/:guildId/welcome/image/preview` | `heavy` | none | Canvas render, sync PNG encode, CDN avatar fetch |
| `POST /api/guilds/:guildId/welcome/image/background` | `upload` | none | 3 MB decode + magic-byte sniff + disk write |
| `DELETE /api/guilds/:guildId/welcome/image/background` | `upload` | none | Disk mutation; pairs with upload |
| `POST /api/guilds/:guildId/refresh` | `external` | 3/min, IP default | Busts the 60 s Discord cache |
| `POST /api/guilds/refresh` | `external` | 20/min, IP default | Discord OAuth guild-list fanout |
| `GET /api/guilds/:guildId/scheduled-messages/preview-cron` | `heavy` | 5/10 s, dead key | Fires on typing |
| `POST /api/guilds/:guildId/custom-commands` | `create` | 10/min, dead key | Value unchanged |
| `POST /api/guilds/:guildId/giveaways` | `create` | 10/min, dead key | Value unchanged |
| `GET /auth/login`, `GET /auth/callback` | unchanged | 10/min, IP default | No session yet; auto IP fallback |

`GET /api/guilds/:guildId/channels` and `.../roles` stay on the global tier —
`shared/discordApi.ts` already caches them for 60 s, so they are not the
external-cost path. The cache-busting `refresh` routes are.

Two deliberate behaviour changes:

- `preview-cron` moves from 5-per-10-seconds to 40-per-minute. This drops burst
  protection in favour of one consistent tier; over a full minute it is more
  permissive (30 → 40).
- The two `refresh` routes converge on 5/minute (from 3 and 20). Both are
  cache-busting Discord fanout and warrant the same ceiling.

Auth routes keep 10/minute. They need no special key handling: no session cookie
exists at login, so `rateLimitKey` returns the IP fallback — which is now the
real client IP rather than Caddy's.

### Component 4 — Client 429 handling

`ApiError` (`client/shared/lib/client.ts`) gains two optional fields:

```ts
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errorKey?: string,
    public retryAfter?: number,
  ) { ... }
}
```

`apiFetch` populates them from the response body's `errorKey` and the
`Retry-After` header.

`useWelcomeImagePreview` bypasses `apiFetch` (it uses raw `fetch` to read a blob
response), so it needs its own 429 branch that throws an `ApiError` carrying the
same fields.

`WelcomeImageEditor`'s `onError` distinguishes 429 from other failures and shows
the translated `errors:server.rateLimited` instead of the generic
`imageEditor.toast.previewFailed`.

No retry or backoff logic — the user re-triggers by changing a setting.

**No new locale keys.** Translating server-side via `Accept-Language` and
client-side via `errorKey` both resolve to the existing
`errors:server.rateLimited`, which is already present in all 48 locales.

### Component 5 — Upload body limit fix (separate commit)

`MAX_BACKGROUND_SIZE` is 3 MB (`welcome/image/constants.ts:110`), but Fastify's
default `bodyLimit` is 1 MB and is not overridden anywhere. A 3 MB image
base64-encodes to roughly 4 MB, so Fastify rejects the request with 413 before
the handler's own size check ever executes. Background upload is currently
broken for any file over roughly 750 KB.

Fix: set a route-level `bodyLimit` on the background upload route sized for
base64 expansion, so the handler's own check — which returns the friendly,
specific error naming the real limit — is what actually rejects oversized files.

The value is derived, not hardcoded, so it cannot drift from
`MAX_BACKGROUND_SIZE`:

```ts
// base64 inflates by 4/3; +8 KB covers the JSON envelope and content-type field
const BACKGROUND_BODY_LIMIT = Math.ceil(MAX_BACKGROUND_SIZE * 4 / 3) + 8 * 1024;
// 3 MB -> 4,202,496 bytes
```

A request above this still gets Fastify's 413, which is correct — it is beyond
anything the handler would accept. The point is that legitimate files up to the
documented 3 MB now reach the handler.

This is a pre-existing bug, not a regression from this work, and it lands in its
own commit. It is included because this change adds an `upload` rate-limit tier
to an endpoint that does not currently work for realistic inputs.

## Testing

Per the project's mandatory-tests rule.

**`apps/dashboard/tests/server/shared/rateLimit.test.ts`**

- A valid signed session cookie yields a stable, hashed key across requests.
- A tampered/invalid-signature cookie falls back to the IP key.
- No cookie falls back to the IP key.
- The hashed key does not contain the raw session value.
- `rateLimitErrorResponse` returns `{ statusCode: 429, error, errorKey, retryAfter }`.
- The message is translated according to `Accept-Language`.
- It does not throw when `request.t` is undefined (the `onRequest` ordering regression).

**`apps/dashboard/tests/server/features/welcome/imageRateLimit.test.ts`**

- The 41st preview within the window returns 429 with a `Retry-After` header.
- The 11th background upload within the window returns 429.
- **Two different session cookies get independent buckets** — the direct
  regression test for the shared-bucket defect.
- A 429 body carries `errorKey: "errors:server.rateLimited"`.

**`apps/dashboard/tests/server/features/scheduled/cronPreview.test.ts`** — update;
it registers `fastifyRateLimit` itself and asserts the old 5/10 s behaviour.

Existing route tests that call limited endpoints repeatedly may need distinct
session cookies per case to avoid cross-test bucket bleed.

## Risks

| Risk | Mitigation |
| --- | --- |
| `trustProxy: 1` is wrong if the hop count changes | Documented against the Caddyfile; a wrong value degrades to the current shared-bucket behaviour rather than failing open |
| Counters reset on restart | Accepted; single instance, in-memory store |
| Tests share buckets and become order-dependent | Each test case uses its own session cookie |
| Two browsers = two buckets | Accepted trade-off of cookie keying |

## Files Touched

### New

- `apps/dashboard/src/server/shared/rateLimit.ts`
- `apps/dashboard/tests/server/shared/rateLimit.test.ts`
- `apps/dashboard/tests/server/features/welcome/imageRateLimit.test.ts`

### Modified

- `apps/dashboard/src/server/index.ts` — `trustProxy`, global limiter options
- `apps/dashboard/src/server/features/welcome/routes.ts` — tiers + `bodyLimit`
- `apps/dashboard/src/server/features/discord/routes.ts` — `external` tier
- `apps/dashboard/src/server/features/guilds/routes.ts` — `external` tier
- `apps/dashboard/src/server/features/scheduled/routes.ts` — `heavy` tier
- `apps/dashboard/src/server/features/commands/routes.ts` — `create` tier
- `apps/dashboard/src/server/features/giveaways/routes.ts` — `create` tier
- `apps/dashboard/src/client/shared/lib/client.ts` — `ApiError` fields
- `apps/dashboard/src/client/features/welcome/hooks/useWelcome.ts` — 429 branch
- `apps/dashboard/src/client/features/welcome/components/WelcomeImageEditor.tsx` — 429 toast
- `apps/dashboard/tests/server/features/scheduled/cronPreview.test.ts` — update

## Commit Plan

1. `fix(dashboard): trust one proxy hop and key rate limits per session`
2. `feat(dashboard): add tiered rate limits for heavy endpoints`
3. `feat(dashboard): surface rate-limit errors in the image editor`
4. `fix(welcome): raise the body limit for background uploads`
