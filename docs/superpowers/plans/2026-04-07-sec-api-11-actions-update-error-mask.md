# Actions Update Generic Catch Masks Real Errors — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** LOW
**Goal:** Distinguish "rule not found" from real backend errors in `PUT /actions/rules/:ruleId` so genuine 500s are surfaced and logged instead of silently masked as 404s.
**Architecture:** Catch the error, inspect for Prisma's `P2025` (record not found) error code — if matched, return 404. For any other error, log via the project logger and return 500. This restores observability without changing the happy path.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/actions/routes.ts:231` does `try { ... } catch { reply.code(404).send({ error: "Rule not found" }); }`. Any failure — DB connection drop, validation error inside `updateRule`, JSON parse fault — is reported as a 404. Operators lose visibility into real failures, and an attacker can trigger DB issues without ever seeing a 5xx response.

## Files
- Modify: `apps/dashboard/src/server/features/actions/routes.ts:210-234`
- Test: `apps/dashboard/tests/server/features/actions/updateRuleErrors.test.ts` (new file)

## Tasks

### Task 1: Catch P2025 specifically; log other errors as 500

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/features/actions/updateRuleErrors.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", dashboardSessionSecret: "s", logLevel: "info" },
}));

const session = {
  userId: "user-1",
  username: "u",
  guilds: [{ id: "guild-1", name: "T", permissions: BigInt(0x20).toString() }],
};
vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: vi.fn().mockResolvedValue(session),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: vi.fn().mockResolvedValue(true),
  getGuildOwnerId: vi.fn().mockResolvedValue("owner-1"),
}));
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: vi.fn().mockResolvedValue({ permissions: new Set(["*"]), isOwner: true }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockUpdateRule = vi.fn();
vi.mock("@fluxcore/systems/actions/persistence", () => ({
  notifyCacheInvalidation: vi.fn().mockResolvedValue(undefined),
  listRules: vi.fn().mockResolvedValue([]),
  getRule: vi.fn(),
  createRule: vi.fn(),
  updateRule: (...args: unknown[]) => mockUpdateRule(...args),
  deleteRule: vi.fn(),
  bulkUpdateRules: vi.fn(),
  getRuleAnalytics: vi.fn(),
  getActionLogs: vi.fn(),
  getGuildSettings: vi.fn(),
  upsertGuildSettings: vi.fn(),
}));

const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@fluxcore/utils", () => ({ logger: mockLogger }));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerActionRoutes } from "../../../../src/server/features/actions/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerActionRoutes(app);
  await app.ready();
  return app;
}

describe("PUT /actions/rules/:ruleId — error handling", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("returns 404 when Prisma throws P2025", async () => {
    const err = Object.assign(new Error("Record not found"), { code: "P2025" });
    mockUpdateRule.mockRejectedValue(err);
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/actions/rules/123",
      cookies: { session: app.signCookie("valid") },
      payload: { name: "x" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 500 and logs when an unexpected error occurs", async () => {
    mockUpdateRule.mockRejectedValue(new Error("DB connection refused"));
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/actions/rules/123",
      cookies: { session: app.signCookie("valid") },
      payload: { name: "x" },
    });
    expect(res.statusCode).toBe(500);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
pnpm --filter @fluxcore/dashboard test -- updateRuleErrors
```

Expected: the "returns 500 and logs" test FAILS — current handler returns 404 for every error.

- [ ] **Step 3: Implement the fix**

Edit `apps/dashboard/src/server/features/actions/routes.ts` — replace the `try { ... } catch { ... }` block at lines 210-233:

```typescript
      try {
        const updated = await updateRule(Number(ruleId), guildId, {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.eventType !== undefined && {
            eventType: body.eventType as ActionEventType,
          }),
          ...(body.actions !== undefined && {
            actions: body.actions.map((a) => ({
              ...a,
              type: a.type as ActionType,
            })),
          }),
          ...(body.steps && body.entryStepId
            ? { steps: body.steps as unknown as RuleStep[], entryStepId: body.entryStepId }
            : {}),
          ...(body.conditions !== undefined && { conditions: body.conditions }),
          ...(body.priority !== undefined && { priority: body.priority }),
          ...(body.enabled !== undefined && { enabled: body.enabled }),
        });
        await notifyCacheInvalidation(guildId);
        reply.send(updated);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "P2025") {
          reply.code(404).send({ error: "Rule not found" });
          return;
        }
        logger.error({ err, guildId, ruleId }, "Failed to update action rule");
        reply.code(500).send({ error: "Failed to update rule" });
      }
```

Make sure `logger` is imported at the top of the file:

```typescript
import { logger } from "@fluxcore/utils";
```

(If it's not already imported, add it; if already present, no change needed.)

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm --filter @fluxcore/dashboard test -- updateRuleErrors
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/actions/routes.ts apps/dashboard/tests/server/features/actions/updateRuleErrors.test.ts
git commit -m "fix(actions): distinguish P2025 not-found from 500 errors in rule update"
```
