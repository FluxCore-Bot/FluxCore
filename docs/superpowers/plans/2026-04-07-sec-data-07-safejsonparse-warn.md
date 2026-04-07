# safeJsonParse Silent Fallback Warning — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** LOW
**Goal:** Make `safeJsonParse` in `packages/systems/src/actions/persistence.ts` log a warning (with identifying context) whenever it falls back, so corrupt rule rows surface in the logs instead of silently degrading to empty defaults.
**Architecture:** `persistence.ts:13-18` defines a generic `safeJsonParse<T>(json, fallback)` used by `parseActionsColumn` and `rowToRule`. When a row's `actions`/`conditions` column contains invalid JSON, callers silently get `[]` / `{}` and the rule no-ops. We will (a) extend the helper to accept an optional `context` label, (b) call `logger.warn` on parse failure with the context, and (c) thread sensible context strings through every call site so logs are actionable.
**Tech Stack:** Prisma 7, PostgreSQL 18, TypeScript, Vitest

---

## Vulnerability
`packages/systems/src/actions/persistence.ts:13-18` swallows `JSON.parse` errors and returns the fallback. If a malformed row sneaks into the DB (manual edit, failed migration, partial write from a crashed worker), the affected rule will silently behave as if it had no actions/conditions. There is no telemetry to detect this — the rule appears in the dashboard, looks enabled, and produces zero events. Adding a `logger.warn(...)` with the row id and column name turns a silent class of bug into a loud, actionable one.

## Files
- Read: `packages/systems/src/actions/persistence.ts`
- Modify: `packages/systems/src/actions/persistence.ts`
- Create: `packages/systems/tests/unit/persistence-safejsonparse.test.ts`

## Tasks

### Task 1: Add context-aware fallback logging

- [ ] **Step 1: Write the failing test**

Create `packages/systems/tests/unit/persistence-safejsonparse.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const warnMock = vi.fn();

vi.mock("@fluxcore/utils", () => ({
  logger: { info: vi.fn(), warn: warnMock, error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({}),
}));

import { rowToRule } from "../../src/actions/persistence.js";

describe("rowToRule fallback logging", () => {
  beforeEach(() => warnMock.mockReset());

  it("logs a warning when actions JSON is malformed", () => {
    rowToRule({
      id: 42,
      guildId: "g1",
      name: "broken",
      enabled: true,
      eventType: "memberJoin",
      actions: "{not-json",
      conditions: "{}",
      priority: 0,
      createdBy: "u1",
    });
    expect(warnMock).toHaveBeenCalledTimes(1);
    const msg = warnMock.mock.calls[0][0] as string;
    expect(msg).toContain("ActionRule");
    expect(msg).toContain("id=42");
    expect(msg).toContain("actions");
  });

  it("logs a warning when conditions JSON is malformed", () => {
    rowToRule({
      id: 7,
      guildId: "g1",
      name: "broken",
      enabled: true,
      eventType: "memberJoin",
      actions: "[]",
      conditions: "{bad",
      priority: 0,
      createdBy: "u1",
    });
    expect(warnMock).toHaveBeenCalledTimes(1);
    expect(warnMock.mock.calls[0][0]).toContain("conditions");
  });

  it("does NOT warn on valid JSON", () => {
    rowToRule({
      id: 1,
      guildId: "g1",
      name: "ok",
      enabled: true,
      eventType: "memberJoin",
      actions: "[]",
      conditions: "{}",
      priority: 0,
      createdBy: "u1",
    });
    expect(warnMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
docker compose run --rm bot pnpm --filter @fluxcore/systems test packages/systems/tests/unit/persistence-safejsonparse.test.ts
```

Expect: `expected "spy" to be called`. The current code does not call `logger.warn`.

- [ ] **Step 3: Implement the warning + thread context**

Edit `packages/systems/src/actions/persistence.ts`. Replace `safeJsonParse`:

```typescript
function safeJsonParse<T>(
  json: string,
  fallback: T,
  context?: string,
): T {
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    if (context) {
      logger.warn(
        `safeJsonParse fallback for ${context}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return fallback;
  }
}
```

Then update `parseActionsColumn` and `rowToRule` to thread context:

```typescript
function parseActionsColumn(
  raw: string,
  context?: string,
): {
  actions: ActionConfig[];
  steps?: RuleStep[];
  entryStepId?: string;
} {
  const parsed = safeJsonParse<ActionConfig[] | StepsPayload>(raw, [], context);
  // ... unchanged ...
}

export function rowToRule(row: { /* ...unchanged signature... */ }): ActionRule {
  const ctxBase = `ActionRule id=${row.id} guildId=${row.guildId}`;
  const { actions, steps, entryStepId } = parseActionsColumn(
    row.actions,
    `${ctxBase} column=actions`,
  );
  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
    enabled: row.enabled,
    eventType: row.eventType as ActionEventType,
    actions,
    ...(steps ? { steps, entryStepId } : {}),
    conditions: safeJsonParse<ActionConditions>(
      row.conditions,
      {},
      `${ctxBase} column=conditions`,
    ),
    priority: row.priority,
    createdBy: row.createdBy,
  };
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
docker compose run --rm bot pnpm --filter @fluxcore/systems test packages/systems/tests/unit/persistence-safejsonparse.test.ts
docker compose run --rm bot pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/systems/src/actions/persistence.ts packages/systems/tests/unit/persistence-safejsonparse.test.ts
git commit -m "fix(actions): warn on safeJsonParse fallback with row context"
```
