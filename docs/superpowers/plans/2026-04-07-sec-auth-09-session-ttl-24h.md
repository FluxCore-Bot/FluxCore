# Session TTL Reduced to 24h with Sliding Renewal — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** LOW
**Goal:** Reduce `SESSION_TTL` from 7 days to 24 hours, while keeping the existing sliding-renewal behavior so active users are not logged out mid-session.
**Architecture:** Lower `SESSION_TTL` and the cookie `maxAge` consistently in `session.ts` and `routes.ts`. Existing `touchSession` already extends expiry past the 50% threshold; the renewal cadence will simply shift to ~12h for active users. Inactive users will be forced to re-auth after 24h.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/shared/session.ts:34` sets `SESSION_TTL = 7 * 24 * 60 * 60 * 1000` (7 days), and `apps/dashboard/src/server/features/auth/routes.ts:89` sets cookie `maxAge: 604800`. A 7-day window for an admin dashboard with full server-management privileges is excessive — a stolen laptop or persisted browser profile remains authorized far longer than necessary.

## Files
- Modify: `apps/dashboard/src/server/shared/session.ts:34`, `:143-150`
- Modify: `apps/dashboard/src/server/features/auth/routes.ts:89`
- Test: `apps/dashboard/tests/server/shared/session.test.ts`

## Tasks

### Task 1: Lower SESSION_TTL and cookie maxAge to 24 hours

- [ ] **Step 1: Write the failing test**

Add to `apps/dashboard/tests/server/shared/session.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";

describe("session TTL configuration", () => {
  const here = dirname(fileURLToPath(import.meta.url));

  it("session.ts SESSION_TTL is 24 hours", () => {
    const src = readFileSync(
      resolve(here, "../../../src/server/shared/session.ts"),
      "utf8",
    );
    const match = /const\s+SESSION_TTL\s*=\s*([^;]+);/.exec(src);
    expect(match, "SESSION_TTL not found").toBeTruthy();
    // 24 * 60 * 60 * 1000 = 86_400_000
    // eslint-disable-next-line no-eval
    const value = eval(match![1]) as number;
    expect(value).toBe(24 * 60 * 60 * 1000);
  });

  it("session.ts touchSession cookie maxAge is 86400", () => {
    const src = readFileSync(
      resolve(here, "../../../src/server/shared/session.ts"),
      "utf8",
    );
    expect(src).toMatch(/maxAge:\s*86400\b/);
    expect(src).not.toMatch(/maxAge:\s*604800\b/);
  });

  it("auth routes.ts session cookie maxAge is 86400", () => {
    const src = readFileSync(
      resolve(here, "../../../src/server/features/auth/routes.ts"),
      "utf8",
    );
    // The session cookie (not oauth_state) should be 24h
    const sessionBlock = /setCookie\("session"[\s\S]*?\}\)/.exec(src);
    expect(sessionBlock, "session setCookie block not found").toBeTruthy();
    expect(sessionBlock![0]).toMatch(/maxAge:\s*86400\b/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/dashboard/tests/server/shared/session.test.ts`
Expected: FAIL — current values are 7 * 24 * 60 * 60 * 1000 and 604800.

- [ ] **Step 3: Implement fix**

Edit `apps/dashboard/src/server/shared/session.ts`:

```typescript
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours (sliding-renewed for active users)
```

And the cookie refresh inside `touchSession` (lines 143-150):

```typescript
  reply.setCookie("session", id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    signed: true,
    maxAge: 86400, // 24 hours
  });
```

Edit `apps/dashboard/src/server/features/auth/routes.ts` line 89:

```typescript
        .setCookie("session", sessionId, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          signed: true,
          maxAge: 86400, // 24 hours
        })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/dashboard/tests/server/shared/session.test.ts`
Expected: PASS.

Also run a smoke check on the broader dashboard tests to ensure no test hard-coded 604800:
Run: `pnpm --filter @fluxcore/dashboard test`
Expected: PASS (any test referencing 604800 must be updated).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/session.ts apps/dashboard/src/server/features/auth/routes.ts apps/dashboard/tests/server/shared/session.test.ts
git commit -m "fix(security): reduce dashboard session TTL to 24h with sliding renewal"
```
