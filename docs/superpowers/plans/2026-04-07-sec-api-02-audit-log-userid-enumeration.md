# Audit Log userId Enumeration — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** CRITICAL
**Goal:** Restrict the audit-log `userId` filter so non-owners can only query their own actions, preventing user-id enumeration and disclosure of other admins' activity.
**Architecture:** In `GET /api/guilds/:guildId/dashboard-audit`, branch on `request.resolvedPermissions.isOwner`. Owners may pass any `userId`. Non-owners get the filter forced to their own session userId regardless of what they passed (or receive 403 if they tried a different value).
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/permissions/routes.ts:301` accepts `query.userId` and applies it to the Prisma `where` clause unconditionally. Anyone with `dashboard.audit.view` can iterate user IDs and observe what every other admin did, including failed permission attempts and target IDs — useful for both reconnaissance and harassment. The audit log is meant to be visible to admins, but per-user filtering by arbitrary IDs is enumeration.

## Files
- Modify: `apps/dashboard/src/server/features/permissions/routes.ts:280-336`
- Test: `apps/dashboard/tests/server/features/permissions/auditLog.test.ts` (new file)

## Tasks

### Task 1: Restrict userId filter to own user unless owner

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/features/permissions/auditLog.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    dashboardSessionSecret: "session-secret",
    logLevel: "info",
  },
}));

const MANAGE_GUILD = BigInt(0x20);
const callerSession = {
  userId: "caller-1",
  username: "caller",
  guilds: [{ id: "guild-1", name: "Test", permissions: MANAGE_GUILD.toString() }],
};

const mockGetSession = vi.fn().mockResolvedValue(callerSession);
vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: vi.fn().mockResolvedValue(true),
  getGuildOwnerId: vi.fn().mockResolvedValue("owner-1"),
}));

const mockResolveUserPermissions = vi.fn();
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: (...args: unknown[]) => mockResolveUserPermissions(...args),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockFindMany = vi.fn().mockResolvedValue([]);
const mockCount = vi.fn().mockResolvedValue(0);
vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({
    dashboardAuditLog: { findMany: mockFindMany, count: mockCount },
    dashboardUserPermission: { findMany: vi.fn() },
  }),
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerDashboardPermissionRoutes } from "../../../../src/server/features/permissions/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerDashboardPermissionRoutes(app);
  await app.ready();
  return app;
}

describe("GET /api/guilds/:guildId/dashboard-audit — userId filter", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(callerSession);
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["dashboard.audit.view"]),
      isOwner: false,
    });
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    app = await buildApp();
  });

  it("forces userId filter to caller for non-owner", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?userId=other-user",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ guildId: "guild-1", userId: "caller-1" }),
      }),
    );
  });

  it("allows owner to filter by any userId", async () => {
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["*"]),
      isOwner: true,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?userId=other-user",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "other-user" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
pnpm --filter @fluxcore/dashboard test -- auditLog
```

Expected: "forces userId filter to caller for non-owner" FAILS — current code forwards `other-user` directly.

- [ ] **Step 3: Implement the fix**

Edit `apps/dashboard/src/server/features/permissions/routes.ts` lines 300-302 — replace the `where` construction so that non-owners are forced to their own userId:

```typescript
      const where: Record<string, unknown> = { guildId };
      const isOwner = request.resolvedPermissions?.isOwner === true;
      if (isOwner) {
        if (query.userId) where.userId = query.userId;
      } else {
        // Non-owners may only view their own audit entries
        where.userId = request.session!.userId;
      }
      if (query.action) where.action = { contains: query.action };
      if (query.targetType) where.targetType = query.targetType;
```

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm --filter @fluxcore/dashboard test -- auditLog
pnpm typecheck
```

Both tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/permissions/routes.ts apps/dashboard/tests/server/features/permissions/auditLog.test.ts
git commit -m "fix(permissions): restrict audit log userId filter to caller for non-owners"
```
