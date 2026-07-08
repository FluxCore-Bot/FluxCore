# Stale session.guilds Cache Allows Revoked Admins — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** MEDIUM
**Goal:** Re-fetch fresh guild membership/permissions in `requireGuildAdmin` whenever the cached entry is more than 5 minutes old, so revoked Discord admins lose dashboard access within 5 minutes instead of up to 30.
**Architecture:** Lower the effective `GUILD_REFRESH_INTERVAL` for `requireGuildAdmin` by awaiting `forceRefreshSessionGuilds` (or a new `ensureFreshGuilds`) when the guard runs against a stale session, then re-checking permissions against the freshly-fetched list.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/shared/middleware.ts:60-89` (`requireGuildAdmin`) checks `session.guilds` for the requested `guildId`. The guild list is cached in `session.guilds` (loaded by `getSession` from DB) and only background-refreshed when older than `GUILD_REFRESH_INTERVAL = 30 * 60 * 1000` ms. A user whose `MANAGE_GUILD` permission was revoked in Discord (or who was kicked from the guild) keeps full dashboard write access for up to 30 minutes — long enough to ban members, change settings, or wipe configuration after their access was supposed to be terminated.

## Files
- Modify: `apps/dashboard/src/server/shared/session.ts` (export `ensureFreshGuilds`)
- Modify: `apps/dashboard/src/server/shared/middleware.ts:60-89`
- Test: `apps/dashboard/tests/server/shared/middleware.test.ts`

## Tasks

### Task 1: Add ensureFreshGuilds with 5-minute threshold

- [ ] **Step 1: Write the failing test**

Add to `apps/dashboard/tests/server/shared/session.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn().mockResolvedValue({});
vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({
    dashboardSession: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn(),
      update,
    },
  }),
}));

const fetchGuilds = vi.fn();
vi.mock("../../../src/server/shared/auth.js", () => ({ fetchGuilds }));

import {
  ensureFreshGuilds,
  __setSessionCacheForTest,
} from "../../../src/server/shared/session.js";

describe("ensureFreshGuilds", () => {
  beforeEach(() => {
    update.mockClear();
    fetchGuilds.mockClear();
  });

  it("re-fetches when cached entry is older than 5 minutes", async () => {
    const sixMinAgo = Date.now() - 6 * 60 * 1000;
    const session = {
      userId: "u",
      username: "u",
      avatar: null,
      accessToken: "tok",
      guilds: [],
      createdAt: Date.now(),
    };
    __setSessionCacheForTest("sid", {
      session,
      cacheExpiresAt: Date.now() + 30_000,
      sessionExpiresAt: Date.now() + 1_000_000,
      guildsRefreshedAt: sixMinAgo,
    });
    fetchGuilds.mockResolvedValueOnce([
      { id: "g1", name: "g", icon: null, permissions: "32" },
    ]);

    const result = await ensureFreshGuilds("sid");
    expect(fetchGuilds).toHaveBeenCalledOnce();
    expect(result[0]?.id).toBe("g1");
  });

  it("does not re-fetch when cached entry is fresh", async () => {
    __setSessionCacheForTest("sid2", {
      session: {
        userId: "u",
        username: "u",
        avatar: null,
        accessToken: "tok",
        guilds: [{ id: "g0", name: "g", icon: null, permissions: "32" }],
        createdAt: Date.now(),
      },
      cacheExpiresAt: Date.now() + 30_000,
      sessionExpiresAt: Date.now() + 1_000_000,
      guildsRefreshedAt: Date.now() - 1_000,
    });

    await ensureFreshGuilds("sid2");
    expect(fetchGuilds).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/dashboard/tests/server/shared/session.test.ts`
Expected: FAIL — `ensureFreshGuilds` and `__setSessionCacheForTest` do not exist.

- [ ] **Step 3: Implement fix**

In `apps/dashboard/src/server/shared/session.ts`, add near the bottom:

```typescript
const FRESH_GUILD_THRESHOLD = 5 * 60 * 1000; // 5 minutes

/**
 * Ensure session.guilds is no older than FRESH_GUILD_THRESHOLD.
 * Used by requireGuildAdmin to fail closed for revoked admins quickly.
 */
export async function ensureFreshGuilds(
  id: string,
): Promise<OAuthGuild[] | null> {
  const cached = sessionCache.get(id);
  if (!cached) {
    const session = await getSession(id);
    if (!session) return null;
    const reloaded = sessionCache.get(id);
    if (!reloaded) return session.guilds;
    if (Date.now() - reloaded.guildsRefreshedAt <= FRESH_GUILD_THRESHOLD) {
      return reloaded.session.guilds;
    }
    return refreshSessionGuilds(id, session.accessToken, reloaded);
  }
  if (Date.now() - cached.guildsRefreshedAt <= FRESH_GUILD_THRESHOLD) {
    return cached.session.guilds;
  }
  return refreshSessionGuilds(id, cached.session.accessToken, cached);
}

// Test-only hook
export function __setSessionCacheForTest(
  id: string,
  entry: CachedSession,
): void {
  sessionCache.set(id, entry);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/dashboard/tests/server/shared/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/session.ts apps/dashboard/tests/server/shared/session.test.ts
git commit -m "feat(session): add ensureFreshGuilds with 5-minute staleness threshold"
```

### Task 2: Use ensureFreshGuilds in requireGuildAdmin

- [ ] **Step 1: Write the failing test**

Add to `apps/dashboard/tests/server/shared/middleware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const ensureFreshGuilds = vi.fn();
const isBotInGuild = vi.fn().mockResolvedValue(true);
const resolveUserPermissions = vi.fn().mockResolvedValue({});

vi.mock("../../../src/server/shared/session.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../../src/server/shared/session.js")
  >("../../../src/server/shared/session.js");
  return { ...actual, ensureFreshGuilds };
});
vi.mock("../../../src/server/shared/discordApi.js", () => ({ isBotInGuild }));
vi.mock("../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions,
  hasPermission: () => true,
}));

import { requireGuildAdmin } from "../../../src/server/shared/middleware.js";

function makeReply() {
  const reply: any = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply;
}

describe("requireGuildAdmin freshness", () => {
  beforeEach(() => {
    ensureFreshGuilds.mockReset();
  });

  it("denies access when fresh guilds no longer include the requested guild", async () => {
    ensureFreshGuilds.mockResolvedValueOnce([]); // user no longer admin
    const reply = makeReply();
    const request: any = {
      params: { guildId: "g1" },
      session: {
        userId: "u",
        guilds: [{ id: "g1", name: "g", icon: null, permissions: "32" }],
      },
      sessionId: "sid",
      t: (k: string) => k,
    };

    await requireGuildAdmin(request, reply);
    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it("allows access when fresh guilds still grant MANAGE_GUILD", async () => {
    ensureFreshGuilds.mockResolvedValueOnce([
      { id: "g1", name: "g", icon: null, permissions: "32" },
    ]);
    const reply = makeReply();
    const request: any = {
      params: { guildId: "g1" },
      session: {
        userId: "u",
        guilds: [],
      },
      sessionId: "sid",
      t: (k: string) => k,
    };

    await requireGuildAdmin(request, reply);
    expect(reply.code).not.toHaveBeenCalledWith(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/dashboard/tests/server/shared/middleware.test.ts`
Expected: FAIL — current code uses stale `session.guilds`.

- [ ] **Step 3: Implement fix**

Edit `apps/dashboard/src/server/shared/middleware.ts`:

```typescript
import type { FastifyRequest, FastifyReply } from "fastify";
import {
  getSession,
  touchSession,
  ensureFreshGuilds,
  type Session,
} from "./session.js";
import { isBotInGuild } from "./discordApi.js";
import {
  resolveUserPermissions,
  hasPermission,
  type ResolvedPermissions,
} from "./permissions.js";

const MANAGE_GUILD = BigInt(0x20);

// ... requireAuth unchanged ...

export async function requireGuildAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { guildId } = request.params as { guildId: string };
  const session = request.session!;
  const sessionId = request.sessionId!;

  // Re-validate guild membership against fresh Discord data (max 5 min stale)
  let guilds = session.guilds;
  try {
    const fresh = await ensureFreshGuilds(sessionId);
    if (fresh) {
      guilds = fresh;
      session.guilds = fresh;
    }
  } catch {
    // If Discord is unreachable, fall back to cached guilds — this is the
    // existing behavior. We still re-check permissions below.
  }

  const userGuild = guilds.find((g) => g.id === guildId);
  if (!userGuild || !(BigInt(userGuild.permissions) & MANAGE_GUILD)) {
    reply.code(403).send({
      error: request.t("errors:permissions.noGuildPermission"),
      errorKey: "errors:permissions.noGuildPermission",
    });
    return;
  }

  if (!(await isBotInGuild(guildId))) {
    reply.code(403).send({
      error: request.t("errors:permissions.botNotInGuild"),
      errorKey: "errors:permissions.botNotInGuild",
    });
    return;
  }

  request.resolvedPermissions = await resolveUserPermissions(
    session.userId,
    guildId,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/dashboard/tests/server/shared/middleware.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/middleware.ts apps/dashboard/tests/server/shared/middleware.test.ts
git commit -m "fix(security): refresh guild membership in requireGuildAdmin"
```
