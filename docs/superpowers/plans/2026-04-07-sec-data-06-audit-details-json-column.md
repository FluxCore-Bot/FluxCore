# Dashboard Audit Details JSON Column — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** MEDIUM
**Goal:** Replace the `DashboardAuditLog.details String @default("{}")` field with a real `Json` column so audit details are stored typed, queryable, and free of double-encoding bugs.
**Architecture:** Today `apps/dashboard/src/server/shared/permissions.ts:185` does `details: JSON.stringify(entry.details ?? {})`, which (a) stores escaped JSON inside a `String`, (b) prevents Postgres-side JSONB queries (e.g. searching for an audit entry by `targetType.before`), and (c) silently masks malformed payloads. Migrating to Prisma's `Json` type maps to PostgreSQL `jsonb`, allowing GIN indexes, structured filters, and direct round-tripping with no manual stringify.
**Tech Stack:** Prisma 7, PostgreSQL 18, TypeScript, Vitest

---

## Vulnerability
`packages/database/prisma/schema.prisma:597` declares `details String @default("{}")` and `apps/dashboard/src/server/shared/permissions.ts:185` writes `JSON.stringify(entry.details ?? {})`. Any read site that forgets to `JSON.parse` returns the raw escaped string. Beyond the data-quality issue, this prevents querying audit logs by their structured fields (we cannot ask "find all role.update entries where details.before.permissions contained X"), undermining the audit log's purpose.

## Files
- Read: `packages/database/prisma/schema.prisma`
- Read: `apps/dashboard/src/server/shared/permissions.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `apps/dashboard/src/server/shared/permissions.ts`
- Create: `packages/database/prisma/migrations/20260407140000_dashboard_audit_details_jsonb/migration.sql`
- Create: `apps/dashboard/tests/server/shared/audit-log-json.test.ts`

## Tasks

### Task 1: Migrate column + write helper

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/shared/audit-log-json.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getPrisma } from "@fluxcore/database";
import { createDashboardAuditLog } from "../../../src/server/shared/permissions.js";

describe("createDashboardAuditLog (JSONB)", () => {
  beforeEach(async () => {
    await getPrisma().dashboardAuditLog.deleteMany({});
  });

  it("stores details as a structured object, not a string", async () => {
    await createDashboardAuditLog({
      guildId: "g1",
      userId: "u1",
      username: "user#0",
      action: "role.update",
      targetType: "role",
      targetId: "role-1",
      details: { before: { permissions: ["a"] }, after: { permissions: ["a", "b"] } },
    });

    const row = await getPrisma().dashboardAuditLog.findFirst({
      where: { guildId: "g1" },
    });
    expect(row).not.toBeNull();
    // After migration, details is an object — NOT a JSON string
    expect(typeof row!.details).toBe("object");
    expect((row!.details as { before: { permissions: string[] } }).before.permissions).toEqual(["a"]);
  });

  it("supports JSONB filtering", async () => {
    await createDashboardAuditLog({
      guildId: "g2",
      userId: "u",
      username: "u",
      action: "role.update",
      details: { reason: "promotion" },
    });

    const rows = await getPrisma().$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "DashboardAuditLog"
      WHERE "guildId" = 'g2' AND details->>'reason' = 'promotion'
    `;
    expect(rows.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
docker compose run --rm dashboard pnpm test:integration apps/dashboard/tests/server/shared/audit-log-json.test.ts
```

The first assertion fails because `details` is currently `string`. The JSONB query also fails because `details` is `text`.

- [ ] **Step 3: Update schema, helper, and migrate**

Edit `packages/database/prisma/schema.prisma` line 597:

```prisma
  details    Json     @default("{}")
```

Edit `apps/dashboard/src/server/shared/permissions.ts:185`. Replace the `details: JSON.stringify(entry.details ?? {})` line with:

```typescript
        details: (entry.details ?? {}) as object,
```

Generate a migration. Because Prisma's auto-generated migration would `DROP` and re-add the column (losing data), write the SQL by hand. Run:

```bash
docker compose run --rm dashboard pnpm db:migrate --create-only --name dashboard_audit_details_jsonb
```

Then edit the generated `migration.sql` to:

```sql
-- Convert DashboardAuditLog.details from text to jsonb, parsing existing rows.
ALTER TABLE "DashboardAuditLog"
  ALTER COLUMN "details" DROP DEFAULT,
  ALTER COLUMN "details" TYPE jsonb USING (
    CASE
      WHEN "details" IS NULL OR "details" = '' THEN '{}'::jsonb
      ELSE "details"::jsonb
    END
  ),
  ALTER COLUMN "details" SET DEFAULT '{}'::jsonb;
```

Then apply:

```bash
docker compose run --rm dashboard pnpm db:migrate
docker compose run --rm dashboard pnpm db:generate
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
docker compose run --rm dashboard pnpm test:integration apps/dashboard/tests/server/shared/audit-log-json.test.ts
docker compose run --rm dashboard pnpm typecheck
```

If `pnpm typecheck` flags any read site that previously did `JSON.parse(row.details)`, fix it to use the value directly. Search:

```bash
docker compose run --rm dashboard sh -lc 'grep -rn "dashboardAuditLog" apps/dashboard/src packages | grep -i details'
```

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma apps/dashboard/src/server/shared/permissions.ts packages/database/prisma/migrations/ apps/dashboard/tests/server/shared/audit-log-json.test.ts
git commit -m "fix(audit): store DashboardAuditLog.details as jsonb instead of stringified JSON"
```
