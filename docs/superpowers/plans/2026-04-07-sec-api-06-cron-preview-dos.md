# Cron Preview DoS — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** HIGH
**Goal:** Prevent denial-of-service against the cron-preview endpoint by adding a tight per-user rate limit and capping wall-clock time spent computing the next 5 runs.
**Architecture:** Add `config.rateLimit` (5 requests / 10s per session) to the GET `/scheduled-messages/preview-cron` route, and wrap the 5-iteration `getNextCronRun` loop with a 250 ms wall-clock budget. If the budget is exceeded, return 400 ("cron expression too slow to evaluate") instead of looping forever.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/scheduled/routes.ts:222-250` calls `getNextCronRun` five times per request with no rate limit. A pathological-but-valid cron expression (very narrow constraint, e.g. `0 0 29 2 1` style) can take seconds per evaluation. Combined with the lack of per-route throttling, an attacker can pin a Node worker on the dashboard process.

## Files
- Modify: `apps/dashboard/src/server/features/scheduled/routes.ts:220-251`
- Test: `apps/dashboard/tests/server/features/scheduled/cronPreview.test.ts` (new file)

## Tasks

### Task 1: Rate-limit and time-bound cron preview

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/features/scheduled/cronPreview.test.ts`:

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

let slowMode = false;
vi.mock("@fluxcore/systems/scheduledMessages/cron", () => ({
  validateCronExpression: () => null,
  getNextCronRun: () => {
    if (slowMode) {
      const start = Date.now();
      while (Date.now() - start < 100) { /* spin */ }
    }
    return new Date();
  },
}));
vi.mock("@fluxcore/systems/scheduledMessages/persistence", () => ({
  getScheduledMessages: vi.fn(),
  getScheduledMessageById: vi.fn(),
  createScheduledMessage: vi.fn(),
  updateScheduledMessage: vi.fn(),
  deleteScheduledMessage: vi.fn(),
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import { registerScheduledMessageRoutes } from "../../../../src/server/features/scheduled/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  await app.register(fastifyRateLimit, { global: false });
  registerScheduledMessageRoutes(app);
  await app.ready();
  return app;
}

describe("GET /scheduled-messages/preview-cron — DoS guards", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    slowMode = false;
    app = await buildApp();
  });

  it("returns 429 after exceeding 5 requests per 10 seconds", async () => {
    const cookie = { session: app.signCookie("valid") };
    let lastStatus = 0;
    for (let i = 0; i < 7; i++) {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/scheduled-messages/preview-cron?cronExpr=*+*+*+*+*",
        cookies: cookie,
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
  });

  it("returns 400 when cron evaluation exceeds time budget", async () => {
    slowMode = true;
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/scheduled-messages/preview-cron?cronExpr=*+*+*+*+*",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/slow|budget|timeout/i);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
pnpm --filter @fluxcore/dashboard test -- cronPreview
```

Expected: both tests FAIL — current code never returns 429 or a time-budget 400.

- [ ] **Step 3: Implement the fix**

Edit `apps/dashboard/src/server/features/scheduled/routes.ts` — replace the GET `/preview-cron` route definition (lines 220-251):

```typescript
  // GET preview next run time for a cron expression
  app.get(
    "/api/guilds/:guildId/scheduled-messages/preview-cron",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("scheduled.messages.view")],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "10 seconds",
          keyGenerator: (req) =>
            (req as { session?: { userId?: string } }).session?.userId ?? req.ip,
        },
      },
    },
    async (request, reply) => {
      const query = request.query as { cronExpr?: string; timezone?: string };
      if (!query.cronExpr) {
        reply.code(400).send({ error: "cronExpr query parameter is required" });
        return;
      }

      const cronError = validateCronExpression(query.cronExpr);
      if (cronError) {
        reply.code(400).send({ error: `Invalid cron expression: ${cronError}` });
        return;
      }

      const timezone = query.timezone ?? "UTC";
      const budgetMs = 250;
      const start = Date.now();

      try {
        const nextRun = getNextCronRun(query.cronExpr, timezone);
        if (Date.now() - start > budgetMs) {
          reply.code(400).send({ error: "Cron expression too slow to evaluate (budget exceeded)" });
          return;
        }
        const nextRuns: string[] = [nextRun.toISOString()];
        let lastRun = nextRun;
        for (let i = 0; i < 4; i++) {
          if (Date.now() - start > budgetMs) {
            reply.code(400).send({ error: "Cron expression too slow to evaluate (budget exceeded)" });
            return;
          }
          const next = getNextCronRun(query.cronExpr, timezone, lastRun);
          nextRuns.push(next.toISOString());
          lastRun = next;
        }
        reply.send({ nextRuns });
      } catch (err) {
        reply.code(400).send({ error: "Failed to evaluate cron expression" });
      }
    },
  );
```

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm --filter @fluxcore/dashboard test -- cronPreview
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/scheduled/routes.ts apps/dashboard/tests/server/features/scheduled/cronPreview.test.ts
git commit -m "fix(scheduled): rate-limit and time-bound cron preview to prevent DoS"
```
