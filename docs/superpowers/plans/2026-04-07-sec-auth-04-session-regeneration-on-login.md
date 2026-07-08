# Session Fixation: No Session Regeneration on Login — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** MEDIUM
**Goal:** Delete all existing `DashboardSession` rows for a userId at login time, so re-login invalidates prior sessions and prevents indefinite parallel-session accumulation.
**Architecture:** Add `deleteSessionsForUser(userId)` to `session.ts` and invoke it inside `createSession` (or just before it in the callback). This both prevents session-fixation-style attacks (where an attacker pre-plants a session ID) and bounds DB growth.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/auth/routes.ts:73-79` calls `createSession` on every successful OAuth callback, but the existing rows for the same `userId` in `DashboardSession` are never removed. Old sessions remain valid until their TTL expires (7 days). If a user's machine was compromised and an old session cookie was exfiltrated, re-logging in does not revoke it. It also enables session-fixation: a attacker who plants their own valid `session` cookie in a victim's browser (e.g. via subdomain) is not displaced when the victim logs in.

## Files
- Modify: `apps/dashboard/src/server/shared/session.ts:47-70`
- Test: `apps/dashboard/tests/server/shared/session.test.ts`

## Tasks

### Task 1: Delete prior sessions for userId on createSession

- [ ] **Step 1: Write the failing test**

Add to `apps/dashboard/tests/server/shared/session.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
const create = vi.fn().mockResolvedValue({});

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({
    dashboardSession: {
      create,
      deleteMany,
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  }),
}));

vi.mock("../../../src/server/shared/crypto.js", () => ({
  encrypt: (s: string) => s,
  decrypt: (s: string) => s,
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { createSession } from "../../../src/server/shared/session.js";

describe("createSession session regeneration", () => {
  beforeEach(() => {
    deleteMany.mockClear();
    create.mockClear();
  });

  it("deletes existing sessions for the user before creating a new one", async () => {
    await createSession({
      userId: "user-1",
      username: "u",
      avatar: null,
      accessToken: "tok",
      guilds: [],
    });

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(create).toHaveBeenCalled();
    // delete must be called before create
    expect(deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      create.mock.invocationCallOrder[0],
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/dashboard/tests/server/shared/session.test.ts`
Expected: FAIL — `deleteMany` is never called by current `createSession`.

- [ ] **Step 3: Implement fix**

Edit `apps/dashboard/src/server/shared/session.ts` `createSession` (lines 47-70):

```typescript
export async function createSession(
  data: Omit<Session, "createdAt">,
): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL);

  const prisma = getPrisma();

  // Invalidate any prior sessions for this user (session fixation defense
  // and prevents unbounded session row growth on repeated logins).
  await prisma.dashboardSession.deleteMany({ where: { userId: data.userId } });
  // Also drop any cached entries for this user
  for (const [cacheId, entry] of sessionCache) {
    if (entry.session.userId === data.userId) {
      sessionCache.delete(cacheId);
    }
  }

  await prisma.dashboardSession.create({
    data: {
      id,
      userId: data.userId,
      username: data.username,
      avatar: data.avatar,
      accessToken: encrypt(data.accessToken),
      guilds: JSON.stringify(data.guilds),
      guildsRefreshedAt: now,
      createdAt: now,
      expiresAt,
    },
  });

  return id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/dashboard/tests/server/shared/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/session.ts apps/dashboard/tests/server/shared/session.test.ts
git commit -m "fix(security): regenerate session on login by deleting prior user sessions"
```
