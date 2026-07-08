# Action Executor Per-Event-Type Rate Limit — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** LOW
**Goal:** Replace the single per-guild rate-limit bucket in the action executor with a per-(guild, eventType) bucket so a noisy event class (e.g. `messageCreate`) cannot starve quieter, higher-value events (e.g. `memberJoin`).
**Architecture:** `apps/bot/src/features/automation/system/executor.ts:15-37` keeps `guildExecutionCounts: Map<guildId, { count, resetAt }>` capped at 60 executions/min/guild. Today a single high-volume event type can fill the bucket and cause `processEvent` to drop unrelated events for the rest of the window. We will key the map on `${guildId}:${eventType}` and surface the active eventType into `checkRateLimit`. The 60/min cap stays per bucket.
**Tech Stack:** Prisma 7, PostgreSQL 18, TypeScript, Vitest

---

## Vulnerability
`apps/bot/src/features/automation/system/executor.ts:15-37` shares one 60-execution/minute bucket across all event types in a guild. If `messageCreate` rules fire 60 times in 30 seconds, every `memberJoin` / `voiceStateUpdate` / `roleCreate` event for the next 30 seconds is silently dropped, regardless of how critical it is. This is both a fairness issue (the warn-on-spam rule starves the welcome rule) and a soft-DoS vector (a single chatty channel can effectively disable moderation for the rest of the window).

## Files
- Read: `apps/bot/src/features/automation/system/executor.ts`
- Modify: `apps/bot/src/features/automation/system/executor.ts`
- Create: `apps/bot/tests/features/automation/system/executor-rate-limit.test.ts`

## Tasks

### Task 1: Per-(guild, eventType) bucket

- [ ] **Step 1: Write the failing test**

Create `apps/bot/tests/features/automation/system/executor-rate-limit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/utils", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const getRulesForEventMock = vi.fn();
const getGuildSettingsOrDefaultMock = vi.fn(() => ({ globalEnabled: true }));
const logExecutionMock = vi.fn().mockResolvedValue(undefined);
const executorMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@fluxcore/systems/actions/cache", () => ({
  getRulesForEvent: getRulesForEventMock,
}));

vi.mock("@fluxcore/systems/actions/config", () => ({
  getGuildSettingsOrDefault: getGuildSettingsOrDefaultMock,
}));

vi.mock("@fluxcore/systems/actions/persistence", () => ({
  logExecution: logExecutionMock,
}));

vi.mock("../../../../src/features/automation/system/registry.js", () => ({
  getExecutor: () => executorMock,
}));

import { processEvent } from "../../../../src/features/automation/system/executor.js";
import type { Client } from "discord.js";

const fakeClient = {} as Client;

function makeRule(eventType: string) {
  return {
    id: 1,
    guildId: "g1",
    name: `r-${eventType}`,
    enabled: true,
    eventType,
    actions: [{ type: "addRole", roleId: "r" }],
    conditions: {},
    priority: 0,
    createdBy: "u",
  };
}

describe("processEvent rate limiting", () => {
  beforeEach(() => {
    executorMock.mockClear();
    getRulesForEventMock.mockReset();
  });

  it("does not let one event type starve another", async () => {
    getRulesForEventMock.mockImplementation((_g: string, ev: string) => [makeRule(ev)]);

    // Burn through the messageCreate budget
    for (let i = 0; i < 80; i++) {
      await processEvent(fakeClient, {
        guildId: "g1",
        eventType: "messageCreate",
        channelId: "c1",
      } as never);
    }

    const messageCreateExecCount = executorMock.mock.calls.length;
    expect(messageCreateExecCount).toBeLessThanOrEqual(60);

    // Now memberJoin must still be allowed
    executorMock.mockClear();
    await processEvent(fakeClient, {
      guildId: "g1",
      eventType: "memberJoin",
    } as never);

    expect(executorMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
docker compose run --rm bot pnpm --filter @fluxcore/bot test apps/bot/tests/features/automation/system/executor-rate-limit.test.ts
```

The final assertion fails because the shared bucket is exhausted by `messageCreate`.

- [ ] **Step 3: Implement per-event-type buckets**

Edit `apps/bot/src/features/automation/system/executor.ts`. Replace the rate-limit block:

```typescript
// --- Per-(guild, eventType) rate limiting ---
//
// Each event type gets its own 60/min bucket so a noisy event class
// (e.g. messageCreate) cannot starve quieter ones (e.g. memberJoin).

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_EXECUTIONS = 60;

const eventBuckets = new Map<string, { count: number; resetAt: number }>();

function bucketKey(guildId: string, eventType: string): string {
  return `${guildId}\u0000${eventType}`;
}

function checkRateLimit(guildId: string, eventType: string): boolean {
  const key = bucketKey(guildId, eventType);
  const now = Date.now();
  let entry = eventBuckets.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    eventBuckets.set(key, entry);
  }

  if (entry.count >= RATE_LIMIT_MAX_EXECUTIONS) {
    return false;
  }

  entry.count++;
  return true;
}
```

Then update both call sites in `executeSteps` and `processEvent` from `checkRateLimit(context.guildId)` to `checkRateLimit(context.guildId, context.eventType)`.

- [ ] **Step 4: Run the test and watch it pass**

```bash
docker compose run --rm bot pnpm --filter @fluxcore/bot test apps/bot/tests/features/automation/system/executor-rate-limit.test.ts
docker compose run --rm bot pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/bot/src/features/automation/system/executor.ts apps/bot/tests/features/automation/system/executor-rate-limit.test.ts
git commit -m "fix(automation): per-event-type rate limit buckets to prevent starvation"
```
