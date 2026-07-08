# Resource Creation Rate Limiting — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** HIGH
**Goal:** Cap how often a single session can hit expensive POST endpoints (album creation, custom command creation, giveaway creation) to prevent resource exhaustion and spam.
**Architecture:** `@fastify/rate-limit` is already registered globally. We add per-route configuration via `config.rateLimit` on the create endpoints, keyed by `request.session?.userId` (falling back to IP) so a single user cannot DOS via burst creation. Limits chosen: 10 creations / minute per user.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
The global rate limit (100/min/IP) is too coarse for write endpoints that allocate DB rows. `apps/dashboard/src/server/features/music/routes.ts:104`, `features/commands/routes.ts:31`, and `features/giveaways/routes.ts:49` accept POST without per-route throttling. A single attacker behind a NAT can saturate the global bucket for innocent users by spamming `POST /music/library`, fill the per-guild caps, and trigger expensive cache reloads on every request.

## Files
- Modify: `apps/dashboard/src/server/features/music/routes.ts:103-136`
- Modify: `apps/dashboard/src/server/features/commands/routes.ts:31-141`
- Modify: `apps/dashboard/src/server/features/giveaways/routes.ts:49-107`
- Test: `apps/dashboard/tests/server/features/music/musicRateLimit.test.ts` (new file)

## Tasks

### Task 1: Add per-route rate limits to create endpoints

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/features/music/musicRateLimit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "t",
    clientId: "c",
    dashboardSessionSecret: "s",
    logLevel: "info",
  },
}));

const session = {
  userId: "user-1",
  username: "user",
  guilds: [{ id: "guild-1", name: "T", permissions: BigInt(0x20).toString() }],
};

vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: vi.fn().mockResolvedValue(session),
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

vi.mock("@fluxcore/systems/music/library", () => ({
  getAlbums: vi.fn().mockResolvedValue([]),
  getAlbumById: vi.fn(),
  addAlbum: vi.fn().mockResolvedValue({ id: 1, name: "x" }),
  removeAlbum: vi.fn(),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  getAlbumTracks: vi.fn(),
  getAlbumCount: vi.fn().mockResolvedValue(0),
  getTrackCount: vi.fn().mockResolvedValue(0),
  getTrackById: vi.fn(),
}));
vi.mock("@fluxcore/systems/music/config", () => ({
  fetchMusicSettings: vi.fn(),
  upsertMusicSettings: vi.fn(),
}));
vi.mock("@fluxcore/systems/actions/persistence", () => ({
  notifyCacheInvalidation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import { registerMusicRoutes } from "../../../../src/server/features/music/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  await app.register(fastifyRateLimit, { global: false });
  registerMusicRoutes(app);
  await app.ready();
  return app;
}

describe("POST /api/guilds/:guildId/music/library — rate limit", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("returns 429 after exceeding 10 requests/minute", async () => {
    const cookie = { session: app.signCookie("valid") };
    let lastStatus = 0;
    for (let i = 0; i < 12; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/music/library",
        cookies: cookie,
        payload: { name: `album-${i}` },
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
pnpm --filter @fluxcore/dashboard test -- musicRateLimit
```

Expected: the loop completes with status 201 (or 400) on the 12th call — never 429 — so the test FAILS.

- [ ] **Step 3: Implement the fix**

Edit `apps/dashboard/src/server/features/music/routes.ts` — at the POST `/api/guilds/:guildId/music/library` route (line 104), add `config.rateLimit`:

```typescript
  app.post(
    "/api/guilds/:guildId/music/library",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("music.library.manage")],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          keyGenerator: (req) => req.session?.userId ?? req.ip,
        },
      },
      schema: {
```

Edit `apps/dashboard/src/server/features/commands/routes.ts` — at the POST `/api/guilds/:guildId/custom-commands` route (line 31), add the same `config.rateLimit` block right after `preHandler`.

Edit `apps/dashboard/src/server/features/giveaways/routes.ts` — at the POST `/api/guilds/:guildId/giveaways` route (line 49), add the same `config.rateLimit` block.

If `req.session` is not typed on `FastifyRequest` in this file, cast: `keyGenerator: (req) => (req as { session?: { userId?: string } }).session?.userId ?? req.ip`.

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm --filter @fluxcore/dashboard test -- musicRateLimit
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/music/routes.ts apps/dashboard/src/server/features/commands/routes.ts apps/dashboard/src/server/features/giveaways/routes.ts apps/dashboard/tests/server/features/music/musicRateLimit.test.ts
git commit -m "fix(api): add per-user rate limits to resource creation endpoints"
```
