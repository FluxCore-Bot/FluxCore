# Audit Log Date Validation — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** HIGH
**Goal:** Reject malformed `from`/`to` query parameters with HTTP 400 instead of silently passing `Invalid Date` to Prisma.
**Architecture:** Parse each date with `new Date(...)`, then check `Number.isFinite(d.getTime())`. If parsing fails, return 400 with a clear error before constructing the `where` clause.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/permissions/routes.ts:304-308` does `new Date(query.from)` without validation. Invalid input (e.g. `from=lol`) yields `Invalid Date`, which Prisma may either error on or silently produce empty results — making the audit log filter unreliable and easy to abuse to confuse incident responders.

## Files
- Modify: `apps/dashboard/src/server/features/permissions/routes.ts:304-308`
- Test: `apps/dashboard/tests/server/features/permissions/auditLog.test.ts` (extend existing or add a new file `auditLogDates.test.ts`)

## Tasks

### Task 1: Validate from/to and 400 on bad input

- [ ] **Step 1: Write the failing test**

Append to `apps/dashboard/tests/server/features/permissions/auditLog.test.ts` (created in finding 02 — if not yet present, use the same scaffolding/mocks):

```typescript
describe("GET /api/guilds/:guildId/dashboard-audit — date validation", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(callerSession);
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["*"]),
      isOwner: true,
    });
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    app = await buildApp();
  });

  it("returns 400 when from is not a valid date", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?from=not-a-date",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/from/i);
  });

  it("returns 400 when to is not a valid date", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?to=garbage",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/to/i);
  });

  it("accepts valid ISO dates", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?from=2026-01-01T00:00:00Z&to=2026-04-01T00:00:00Z",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
pnpm --filter @fluxcore/dashboard test -- auditLog
```

Expected: the two 400 cases FAIL (current handler accepts and produces an empty/200 response).

- [ ] **Step 3: Implement the fix**

Edit `apps/dashboard/src/server/features/permissions/routes.ts` lines 304-309 — replace the date block:

```typescript
      if (query.from || query.to) {
        const createdAt: Record<string, Date> = {};
        if (query.from) {
          const d = new Date(query.from);
          if (!Number.isFinite(d.getTime())) {
            reply.code(400).send({ error: "Invalid 'from' date" });
            return;
          }
          createdAt.gte = d;
        }
        if (query.to) {
          const d = new Date(query.to);
          if (!Number.isFinite(d.getTime())) {
            reply.code(400).send({ error: "Invalid 'to' date" });
            return;
          }
          createdAt.lte = d;
        }
        where.createdAt = createdAt;
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
git commit -m "fix(permissions): validate from/to dates in audit log query"
```
