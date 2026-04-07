# DashboardRole Restrict Delete + Audit — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** HIGH
**Goal:** Prevent silent privilege loss when a `DashboardRole` is deleted: require all `DashboardRoleAssignment` rows for the role to be removed first (with explicit audit entries) before the role itself can be deleted, and add an audit entry for the role deletion.
**Architecture:** `packages/database/prisma/schema.prisma:564-575` declares `DashboardRoleAssignment.role @relation(... onDelete: Cascade)`. Cascade is convenient but means a single `DELETE FROM "DashboardRole" WHERE id = ?` silently revokes the role from every user with no audit trail. We will (1) change the FK to `onDelete: Restrict`, (2) add a delete-role route helper that explicitly enumerates and audit-logs each unassignment, and (3) write an integration test against the real test DB that proves the restrict semantics.
**Tech Stack:** Prisma 7, PostgreSQL 18, TypeScript, Vitest

---

## Vulnerability
`packages/database/prisma/schema.prisma:569` uses `onDelete: Cascade` on the role assignment FK. Combined with the dashboard's "delete role" endpoint (which today calls `prisma.dashboardRole.delete`), an admin can wipe out every user's permissions for a role with a single click and no audit trail in `DashboardAuditLog`. Worse, the cache invalidation path in `permissions.ts` only invalidates per-user when called explicitly — a role deletion does not enumerate affected users, so cached permission sets continue to grant access until TTL expiry (60s).

## Files
- Read: `packages/database/prisma/schema.prisma`
- Read: `apps/dashboard/src/server/shared/permissions.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260407130000_restrict_dashboard_role_delete/migration.sql`
- Modify (or create) `apps/dashboard/src/server/features/permissions/routes.ts` (delete-role handler — verify path with grep first)
- Create: `apps/dashboard/tests/server/shared/dashboard-role-delete.test.ts`

## Tasks

### Task 1: Switch FK to Restrict + add migration

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/shared/dashboard-role-delete.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getPrisma } from "@fluxcore/database";
import { setupTestDatabase, cleanTestData, teardownTestDatabase } from "../../../../packages/systems/tests/helpers/db.js";

describe("DashboardRole delete semantics", () => {
  beforeEach(async () => {
    await cleanTestData();
  });

  it("refuses to delete a role with active assignments", async () => {
    const prisma = getPrisma();
    const role = await prisma.dashboardRole.create({
      data: { guildId: "g1", name: "mods", permissions: "[\"moderation.warn\"]" },
    });
    await prisma.dashboardRoleAssignment.create({
      data: { guildId: "g1", userId: "u1", roleId: role.id, assignedBy: "admin" },
    });

    await expect(
      prisma.dashboardRole.delete({ where: { id: role.id } }),
    ).rejects.toThrow();
  });

  it("permits deletion after all assignments are removed", async () => {
    const prisma = getPrisma();
    const role = await prisma.dashboardRole.create({
      data: { guildId: "g1", name: "mods", permissions: "[]" },
    });
    await prisma.dashboardRoleAssignment.create({
      data: { guildId: "g1", userId: "u1", roleId: role.id, assignedBy: "admin" },
    });
    await prisma.dashboardRoleAssignment.deleteMany({ where: { roleId: role.id } });

    await expect(
      prisma.dashboardRole.delete({ where: { id: role.id } }),
    ).resolves.toMatchObject({ id: role.id });
  });
});
```

(If `tests/helpers/db.js` does not exist in the test runner working dir, replace with the project's existing integration setup helper — search with `grep -rn setupTestDatabase packages/systems/tests`.)

- [ ] **Step 2: Run the test and watch it fail**

```bash
docker compose run --rm dashboard pnpm test:integration apps/dashboard/tests/server/shared/dashboard-role-delete.test.ts
```

The first test will FAIL because the current `Cascade` allows the delete to succeed.

- [ ] **Step 3: Update schema and migrate**

Edit `packages/database/prisma/schema.prisma` line 569:

```prisma
  role       DashboardRole @relation(fields: [roleId], references: [id], onDelete: Restrict)
```

Then generate and apply the migration:

```bash
docker compose run --rm dashboard pnpm db:migrate --name restrict_dashboard_role_delete
docker compose run --rm dashboard pnpm db:generate
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
docker compose run --rm dashboard pnpm test:integration apps/dashboard/tests/server/shared/dashboard-role-delete.test.ts
docker compose run --rm dashboard pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/ apps/dashboard/tests/server/shared/dashboard-role-delete.test.ts
git commit -m "fix(permissions): restrict DashboardRole delete when assignments exist"
```

### Task 2: Audit-logged unassign-then-delete helper + cache invalidation

- [ ] **Step 1: Write the failing test**

Append to `apps/dashboard/tests/server/shared/dashboard-role-delete.test.ts`:

```typescript
import { deleteDashboardRoleWithAudit } from "../../../src/server/shared/dashboardRoleDelete.js";

describe("deleteDashboardRoleWithAudit", () => {
  beforeEach(async () => {
    await cleanTestData();
  });

  it("unassigns members, writes audit entries, then deletes the role", async () => {
    const prisma = getPrisma();
    const role = await prisma.dashboardRole.create({
      data: { guildId: "g1", name: "mods", permissions: "[]" },
    });
    await prisma.dashboardRoleAssignment.createMany({
      data: [
        { guildId: "g1", userId: "u1", roleId: role.id, assignedBy: "a" },
        { guildId: "g1", userId: "u2", roleId: role.id, assignedBy: "a" },
      ],
    });

    await deleteDashboardRoleWithAudit({
      guildId: "g1",
      roleId: role.id,
      actorId: "admin",
      actorUsername: "admin#0",
    });

    const remaining = await prisma.dashboardRole.findUnique({ where: { id: role.id } });
    expect(remaining).toBeNull();

    const auditEntries = await prisma.dashboardAuditLog.findMany({
      where: { guildId: "g1", action: { in: ["role.unassign", "role.delete"] } },
      orderBy: { createdAt: "asc" },
    });
    expect(auditEntries.map((e) => e.action)).toEqual([
      "role.unassign",
      "role.unassign",
      "role.delete",
    ]);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
docker compose run --rm dashboard pnpm test:integration apps/dashboard/tests/server/shared/dashboard-role-delete.test.ts
```

Expect: cannot find module `dashboardRoleDelete.js`.

- [ ] **Step 3: Implement the helper**

Create `apps/dashboard/src/server/shared/dashboardRoleDelete.ts`:

```typescript
import { getPrisma } from "@fluxcore/database";
import { logger } from "@fluxcore/utils";
import {
  createDashboardAuditLog,
  invalidatePermissionCache,
} from "./permissions.js";

export interface DeleteDashboardRoleArgs {
  guildId: string;
  roleId: string;
  actorId: string;
  actorUsername: string;
}

/**
 * Safely delete a DashboardRole: enumerate assignments, write an audit
 * entry per unassignment, invalidate per-user permission caches, and
 * only then delete the role itself. The schema's onDelete: Restrict
 * guarantees that this is the ONLY safe path to remove a role.
 */
export async function deleteDashboardRoleWithAudit(
  args: DeleteDashboardRoleArgs,
): Promise<void> {
  const prisma = getPrisma();

  await prisma.$transaction(async (tx) => {
    const assignments = await tx.dashboardRoleAssignment.findMany({
      where: { guildId: args.guildId, roleId: args.roleId },
    });

    for (const a of assignments) {
      await tx.dashboardRoleAssignment.delete({ where: { id: a.id } });
      await tx.dashboardAuditLog.create({
        data: {
          guildId: args.guildId,
          userId: args.actorId,
          username: args.actorUsername,
          action: "role.unassign",
          targetType: "user",
          targetId: a.userId,
          details: JSON.stringify({ roleId: args.roleId, reason: "role-delete" }),
        },
      });
    }

    await tx.dashboardRole.delete({ where: { id: args.roleId } });
    await tx.dashboardAuditLog.create({
      data: {
        guildId: args.guildId,
        userId: args.actorId,
        username: args.actorUsername,
        action: "role.delete",
        targetType: "role",
        targetId: args.roleId,
        details: JSON.stringify({ unassignedUsers: assignments.map((a) => a.userId) }),
      },
    });
  });

  // Invalidate cached permissions for every previously-assigned user
  invalidatePermissionCache(args.guildId);
  logger.info(
    `Dashboard role ${args.roleId} deleted in guild ${args.guildId} by ${args.actorUsername}`,
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
docker compose run --rm dashboard pnpm test:integration apps/dashboard/tests/server/shared/dashboard-role-delete.test.ts
docker compose run --rm dashboard pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/dashboardRoleDelete.ts apps/dashboard/tests/server/shared/dashboard-role-delete.test.ts
git commit -m "feat(permissions): audit-logged unassign-then-delete helper for DashboardRole"
```
