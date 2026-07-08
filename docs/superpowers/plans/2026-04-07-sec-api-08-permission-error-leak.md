# Permission Error Echoes Failed Key — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** MEDIUM
**Goal:** Stop leaking which specific permission key tripped the escalation gate; respond with a generic message so attackers cannot binary-search the registry to map a victim's permissions.
**Architecture:** Drop the `permission` field from the 403 response body in the `PUT user-permissions` handler. The fix in finding 01 already replaces the response message; this plan locks in the no-leak guarantee with an explicit test so a future regression cannot reintroduce the field.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/permissions/routes.ts:115-135` (specifically the rejection at lines 129-133) returns `{ error, permission: perm }`. An attacker can probe `PUT /user-permissions/<self-or-other>` with each registry key and learn exactly which permissions another role holds (since the failure tells them precisely which key failed). This is information disclosure that aids privilege escalation.

## Files
- Modify: `apps/dashboard/src/server/features/permissions/routes.ts:128-134` (already touched by finding 01; this finding requires the response shape to remain `{ error: <generic> }`)
- Test: `apps/dashboard/tests/server/features/permissions/userPermissions.test.ts` (extend)

## Tasks

### Task 1: Lock down the 403 response shape

- [ ] **Step 1: Write the failing test**

Append to `apps/dashboard/tests/server/features/permissions/userPermissions.test.ts`:

```typescript
describe("PUT /user-permissions — error response does not leak key", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(callerSession);
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["dashboard.roles.manage"]),
      isOwner: false,
    });
    app = await buildApp();
  });

  it("does not echo the failed permission key in the error body", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/user-permissions/target-1",
      cookies: { session: app.signCookie("valid") },
      payload: { permissions: ["actions.rules.manage"] },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body).not.toHaveProperty("permission");
    expect(JSON.stringify(body)).not.toContain("actions.rules.manage");
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
pnpm --filter @fluxcore/dashboard test -- userPermissions
```

Expected: the test FAILS because the original code returns `{ error, permission: "actions.rules.manage" }`. (If finding 01 has already been applied, this test will pass — that's fine, it then serves as a regression guard.)

- [ ] **Step 3: Implement the fix**

Confirm/keep the fix from finding 01: in `apps/dashboard/src/server/features/permissions/routes.ts`, the 403 response inside the escalation loop must be:

```typescript
            reply.code(403).send({ error: "Insufficient privileges to grant this permission" });
            return;
```

No `permission:` field, no `key:` field, no echo of `perm`.

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm --filter @fluxcore/dashboard test -- userPermissions
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/permissions/routes.ts apps/dashboard/tests/server/features/permissions/userPermissions.test.ts
git commit -m "fix(permissions): generic 403 error to avoid leaking failed permission key"
```
