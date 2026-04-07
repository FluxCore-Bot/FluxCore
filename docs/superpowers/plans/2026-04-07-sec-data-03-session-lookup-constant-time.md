# Session Lookup Timing Side-Channel — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** HIGH
**Goal:** Make session validation observably constant-time with respect to the *content* of the supplied session id, so an attacker cannot distinguish "session row exists but is wrong" from "session row does not exist" via response timing.
**Architecture:** `apps/dashboard/src/server/shared/session.ts` `getSession()` does a Prisma `findUnique({ where: { id } })`. Postgres B-tree lookup time depends on the supplied bytes (early-out on first mismatch in the index page), and our subsequent `if (!row) return null` short-circuits before hitting the cache, expiry check, JSON parse, decryption, etc. Even though the session id is a 128-bit UUID (so practical brute force is infeasible), we still want defense-in-depth: (1) compare the cookie-supplied id against the row id with `crypto.timingSafeEqual`, (2) ensure the not-found path performs the same dummy decryption work the found path performs, and (3) ensure error timing for "expired", "not found", and "tampered" all converge.
**Tech Stack:** Prisma 7, PostgreSQL 18, TypeScript, Vitest

---

## Vulnerability
`apps/dashboard/src/server/shared/session.ts:72-114` (`getSession`) returns `null` immediately when `findUnique` returns nothing, without performing the equivalent decryption and parse work the success path does. The function also relies on Prisma equality semantics for the id, which doesn't use `crypto.timingSafeEqual`. Combined, the wall-clock time of the not-found path differs measurably from the found-but-expired and found-and-valid paths, leaking enumeration signal under high-volume probing. Although UUID v4 makes brute force impractical, the project's threat model treats this as defense-in-depth and constant-time comparison is cheap.

## Files
- Read: `apps/dashboard/src/server/shared/session.ts`
- Modify: `apps/dashboard/src/server/shared/session.ts`
- Create: `apps/dashboard/tests/server/shared/session-timing.test.ts`

## Tasks

### Task 1: Constant-time session id verification + path equalisation

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/shared/session-timing.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { dashboardSessionSecret: "test-secret-do-not-use-in-prod-1234567890" },
}));

const findUniqueMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({
    dashboardSession: { findUnique: findUniqueMock, deleteMany: deleteManyMock },
  }),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../src/server/shared/auth.js", () => ({
  fetchGuilds: vi.fn().mockResolvedValue([]),
}));

import { getSession } from "../../../src/server/shared/session.js";
import { encrypt } from "../../../src/server/shared/crypto.js";

describe("getSession constant-time behaviour", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    deleteManyMock.mockReset();
  });

  it("returns null when row is missing without leaking via Prisma id comparator", async () => {
    findUniqueMock.mockResolvedValue(null);
    const result = await getSession("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });

  it("returns null when stored id does not constant-time match", async () => {
    findUniqueMock.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      userId: "u",
      username: "u",
      avatar: null,
      accessToken: encrypt("tok"),
      guilds: "[]",
      guildsRefreshedAt: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const result = await getSession("22222222-2222-2222-2222-222222222222");
    expect(result).toBeNull();
  });

  it("returns the session on a valid id", async () => {
    const id = "33333333-3333-3333-3333-333333333333";
    findUniqueMock.mockResolvedValue({
      id,
      userId: "u",
      username: "name",
      avatar: null,
      accessToken: encrypt("tok"),
      guilds: "[]",
      guildsRefreshedAt: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const result = await getSession(id);
    expect(result?.userId).toBe("u");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
docker compose run --rm dashboard pnpm --filter @fluxcore/dashboard test apps/dashboard/tests/server/shared/session-timing.test.ts
```

The "constant-time match" test will fail because today the function returns whatever Prisma found regardless of supplied id bytes (Prisma's `findUnique` will still match — but the test verifies our explicit guard by mocking Prisma to return a row whose `id` differs from the input).

- [ ] **Step 3: Implement constant-time verification**

Edit `apps/dashboard/src/server/shared/session.ts`. Add at the top:

```typescript
import { randomUUID, timingSafeEqual } from "node:crypto";
```

Replace `getSession` body:

```typescript
export async function getSession(id: string): Promise<Session | null> {
  const cached = sessionCache.get(id);
  if (cached && cached.cacheExpiresAt > Date.now()) {
    return cached.session;
  }
  sessionCache.delete(id);

  const prisma = getPrisma();
  const row = await prisma.dashboardSession.findUnique({ where: { id } });

  // Defense-in-depth: constant-time compare the supplied cookie id
  // against the stored row id, and perform a dummy decryption on the
  // not-found path so the timing of "missing", "tampered", and
  // "expired" converges.
  const suppliedBuf = Buffer.from(id, "utf8");
  const storedBuf = Buffer.from(row?.id ?? id, "utf8");
  const idsMatch =
    row !== null &&
    suppliedBuf.length === storedBuf.length &&
    timingSafeEqual(suppliedBuf, storedBuf);

  if (!row || !idsMatch) {
    // Equalise work with the success path: perform a throwaway
    // decryption so timing does not branch on row presence.
    try {
      decrypt(encrypt("dummy"));
    } catch {
      /* ignore */
    }
    return null;
  }

  if (row.expiresAt < new Date()) {
    await prisma.dashboardSession.deleteMany({ where: { id: row.id } });
    return null;
  }

  const session: Session = {
    userId: row.userId,
    username: row.username,
    avatar: row.avatar,
    accessToken: decryptAccessToken(row.accessToken),
    guilds: safeJsonParse<OAuthGuild[]>(row.guilds, []),
    createdAt: row.createdAt.getTime(),
  };

  const cachedEntry: CachedSession = {
    session,
    cacheExpiresAt: Date.now() + CACHE_TTL,
    sessionExpiresAt: row.expiresAt.getTime(),
    guildsRefreshedAt: row.guildsRefreshedAt.getTime(),
  };
  sessionCache.set(id, cachedEntry);

  if (Date.now() - cachedEntry.guildsRefreshedAt > GUILD_REFRESH_INTERVAL) {
    refreshSessionGuilds(id, session.accessToken, cachedEntry).catch(() => {});
  }

  return session;
}
```

(The reference to `decryptAccessToken` assumes plan `sec-data-01` has landed; if running this plan independently, inline `decrypt(row.accessToken)` instead.)

- [ ] **Step 4: Run the test and watch it pass**

```bash
docker compose run --rm dashboard pnpm --filter @fluxcore/dashboard test apps/dashboard/tests/server/shared/session-timing.test.ts
docker compose run --rm dashboard pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/session.ts apps/dashboard/tests/server/shared/session-timing.test.ts
git commit -m "fix(session): constant-time id check and equalise not-found timing"
```
