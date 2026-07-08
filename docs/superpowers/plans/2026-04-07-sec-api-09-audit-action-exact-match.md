# Audit Action Filter Exact-Match — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** MEDIUM
**Goal:** Replace the substring `contains` filter on the audit log `action` field with an exact match against an allowlist, so attackers cannot enumerate or partially match arbitrary action strings.
**Architecture:** Build an `ALLOWED_AUDIT_ACTIONS` constant covering every action string emitted by the dashboard (`dashboard.permissions.update`, `dashboard.permissions.clear`, `dashboard.settings.update`, `dashboard.role.create`, `dashboard.role.update`, `dashboard.role.delete`, `dashboard.role.assign`, `dashboard.role.unassign`). When `query.action` is supplied, validate membership in the allowlist and use `where.action = query.action` instead of `{ contains }`.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/permissions/routes.ts:302` does `where.action = { contains: query.action }`. Substring matching exposes information (an attacker can search for partial strings to discover undocumented action types) and allows confusion in the UI. Exact-match against an allowlist is both more correct and prevents partial-match enumeration.

## Files
- Modify: `apps/dashboard/src/server/features/permissions/routes.ts:280-336`
- Test: `apps/dashboard/tests/server/features/permissions/auditLog.test.ts` (extend)

## Tasks

### Task 1: Replace `contains` with exact-match allowlist

- [ ] **Step 1: Write the failing test**

Append to `apps/dashboard/tests/server/features/permissions/auditLog.test.ts`:

```typescript
describe("GET /dashboard-audit — action filter is exact-match", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["*"]),
      isOwner: true,
    });
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    app = await buildApp();
  });

  it("uses exact match (not contains) when action is allowlisted", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?action=dashboard.permissions.update",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: "dashboard.permissions.update" }),
      }),
    );
  });

  it("returns 400 when action is not in the allowlist", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?action=permissions",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
pnpm --filter @fluxcore/dashboard test -- auditLog
```

Expected: both tests FAIL — current code uses `{ contains: "permissions" }` and never returns 400.

- [ ] **Step 3: Implement the fix**

Edit `apps/dashboard/src/server/features/permissions/routes.ts`. At the bottom of the file, add the allowlist:

```typescript
const ALLOWED_AUDIT_ACTIONS = new Set([
  "dashboard.permissions.update",
  "dashboard.permissions.clear",
  "dashboard.settings.update",
  "dashboard.role.create",
  "dashboard.role.update",
  "dashboard.role.delete",
  "dashboard.role.assign",
  "dashboard.role.unassign",
]);
```

Then in the GET handler (around line 302) replace:

```typescript
      if (query.action) where.action = { contains: query.action };
```

with:

```typescript
      if (query.action) {
        if (!ALLOWED_AUDIT_ACTIONS.has(query.action)) {
          reply.code(400).send({ error: "Unknown action filter" });
          return;
        }
        where.action = query.action;
      }
```

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm --filter @fluxcore/dashboard test -- auditLog
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/permissions/routes.ts apps/dashboard/tests/server/features/permissions/auditLog.test.ts
git commit -m "fix(permissions): enforce exact-match allowlist on audit action filter"
```
