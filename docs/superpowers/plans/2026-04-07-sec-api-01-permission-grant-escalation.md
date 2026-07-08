# Permission Grant Escalation Flaw — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** CRITICAL
**Goal:** Prevent privilege escalation through user permission overrides by enforcing a strict tier check, blocking self-grant, and rejecting any attempt to grant a permission the caller does not strictly out-rank.
**Architecture:** Replace the current "if I can match it I can grant it" check in `PUT /api/guilds/:guildId/user-permissions/:userId` with three explicit gates: (1) reject when `session.userId === target userId`, (2) require non-owner callers to hold strictly more keys than the resulting set (i.e. they must be a strict superset that excludes any wildcard the caller does not literally hold), and (3) explicitly forbid granting `*` or any module-level wildcard unless the caller is the guild owner.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/permissions/routes.ts:109-135` validates each requested permission against `matchPermission(userPerms, perm)`. Because `matchPermission` treats `dashboard.*` as matching `dashboard.roles.manage`, a non-owner who holds `dashboard.roles.manage` can grant *themselves* `dashboard.roles.manage` (self-grant is not blocked) and, more dangerously, a holder of any wildcard like `actions.*` can grant `actions.rules.execute` to a user who previously had nothing — there is no check that the new permission set is *less* than the caller's. Combined with the missing self-grant block, an attacker who compromises any non-owner admin account can chain grants until they reach `*`.

## Files
- Modify: `apps/dashboard/src/server/features/permissions/routes.ts:103-167`
- Test: `apps/dashboard/tests/server/features/permissions/userPermissions.test.ts` (new file)

## Tasks

### Task 1: Block self-grant and wildcard escalation

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/features/permissions/userPermissions.test.ts`:

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

const mockGetGuildOwnerId = vi.fn().mockResolvedValue("owner-1");
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: vi.fn().mockResolvedValue(true),
  getGuildOwnerId: (...args: unknown[]) => mockGetGuildOwnerId(...args),
}));

const mockResolveUserPermissions = vi.fn();
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: (...args: unknown[]) => mockResolveUserPermissions(...args),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = {
  dashboardUserPermission: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  dashboardAuditLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

vi.mock("@fluxcore/database", () => ({ getPrisma: () => mockPrisma }));
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

describe("PUT /api/guilds/:guildId/user-permissions/:userId — escalation guards", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(callerSession);
    mockGetGuildOwnerId.mockResolvedValue("owner-1");
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["dashboard.roles.manage"]),
      isOwner: false,
    });
    app = await buildApp();
  });

  it("rejects self-grant with 403", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/user-permissions/caller-1",
      cookies: { session: app.signCookie("valid") },
      payload: { permissions: ["dashboard.roles.view"] },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/self/i);
  });

  it("rejects non-owner attempting to grant a wildcard they do not literally hold", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/user-permissions/target-1",
      cookies: { session: app.signCookie("valid") },
      payload: { permissions: ["dashboard.*"] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects non-owner attempting to grant the global wildcard", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/user-permissions/target-1",
      cookies: { session: app.signCookie("valid") },
      payload: { permissions: ["*"] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects when caller does not literally hold the requested key", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/user-permissions/target-1",
      cookies: { session: app.signCookie("valid") },
      payload: { permissions: ["actions.rules.manage"] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows owner to grant any permission, including self", async () => {
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["*"]),
      isOwner: true,
    });
    mockGetSession.mockResolvedValue({ ...callerSession, userId: "owner-1" });
    mockGetGuildOwnerId.mockResolvedValue("owner-1");
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/user-permissions/target-1",
      cookies: { session: app.signCookie("valid") },
      payload: { permissions: ["actions.rules.manage"] },
    });
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
pnpm --filter @fluxcore/dashboard test -- userPermissions
```

Expected: tests "rejects self-grant", "rejects non-owner attempting to grant a wildcard", "rejects non-owner attempting to grant the global wildcard" all FAIL (current code returns 200 because `matchPermission` accepts wildcards and self-grant is not blocked).

- [ ] **Step 3: Implement the fix**

Edit `apps/dashboard/src/server/features/permissions/routes.ts` — replace the body of the `PUT /api/guilds/:guildId/user-permissions/:userId` handler starting at line 103, swapping the existing escalation block (lines 124-136) with strict checks:

```typescript
    async (request, reply) => {
      const { guildId, userId } = request.params as { guildId: string; userId: string };
      const { permissions } = request.body as { permissions: string[] };
      const session = request.session!;
      const prisma = getPrisma();

      // Cannot modify owner permissions
      const ownerId = await getGuildOwnerId(guildId);
      if (ownerId === userId) {
        reply.code(400).send({ error: "Cannot modify guild owner permissions" });
        return;
      }

      // Block self-grant: a user must never grant or modify their own permission set
      if (session.userId === userId) {
        reply.code(403).send({ error: "Cannot modify your own permissions" });
        return;
      }

      // Validate keys
      for (const perm of permissions) {
        if (!isValidPermKey(perm)) {
          reply.code(400).send({ error: `Invalid permission key: ${perm}` });
          return;
        }
      }

      // Strict escalation gate: non-owners must literally hold every key they grant.
      // Wildcards (`*`, `module.*`, `module.feature.*`) may only be granted by the
      // guild owner — match-by-wildcard is not enough.
      if (!request.resolvedPermissions?.isOwner) {
        const literalCallerPerms = request.resolvedPermissions!.permissions;
        for (const perm of permissions) {
          if (perm === "*" || perm.includes("*")) {
            reply.code(403).send({ error: "Insufficient privileges to grant this permission" });
            return;
          }
          if (!literalCallerPerms.has(perm)) {
            reply.code(403).send({ error: "Insufficient privileges to grant this permission" });
            return;
          }
        }
      }

      // Replace all user permissions in a transaction
      await prisma.$transaction(async (tx) => {
        await tx.dashboardUserPermission.deleteMany({ where: { guildId, userId } });
        if (permissions.length > 0) {
          await tx.dashboardUserPermission.createMany({
            data: permissions.map((perm) => ({
              guildId,
              userId,
              permission: perm,
              grantedBy: session.userId,
            })),
          });
        }
      });

      invalidatePermissionCache(guildId, userId);

      await createDashboardAuditLog({
        guildId,
        userId: session.userId,
        username: session.username,
        action: "dashboard.permissions.update",
        targetType: "user",
        targetId: userId,
        details: { permissions },
      });

      reply.send({ success: true, permissions });
    },
```

Note: also remove the `import { matchPermission } from "@fluxcore/types"` if it becomes unused.

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm --filter @fluxcore/dashboard test -- userPermissions
pnpm typecheck
```

All five tests should now pass.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/permissions/routes.ts apps/dashboard/tests/server/features/permissions/userPermissions.test.ts
git commit -m "fix(permissions): block self-grant and wildcard escalation in user-permissions PUT"
```
