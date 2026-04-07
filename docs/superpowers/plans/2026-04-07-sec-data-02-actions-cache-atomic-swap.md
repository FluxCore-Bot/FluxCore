# Actions Cache Reload Atomic Swap — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** HIGH
**Goal:** Eliminate the empty-cache window in `reloadGuild()` so that events arriving during a guild reload always see either the previous rule set or the new one — never an empty set.
**Architecture:** `packages/systems/src/actions/cache.ts` keeps a `guildId -> eventType -> ActionRule[]` Map. The current `reloadGuild` loads new rules then calls `invalidateGuild(guildId)` (deleting the old map) and rebuilds in-place via `addToInternalCache`. Between the `delete` and the loop's first `set`, `getRulesForEvent` returns `[]`. The fix: build a fresh `Map<eventType, ActionRule[]>` locally, then atomically swap it into `ruleCache.set(guildId, newMap)`. Map writes are synchronous in Node so the swap is observably atomic with respect to other JS turns.
**Tech Stack:** Prisma 7, PostgreSQL 18, TypeScript, Vitest

---

## Vulnerability
`packages/systems/src/actions/cacheSync.ts:65-72` (the `reloadGuild` it imports from `cache.ts:65-72`) does:

```ts
const rules = await getRulesByGuild(guildId);
invalidateGuild(guildId);            // <-- deletes the old map
for (const rule of rules) {
  addToInternalCache(rule);          // <-- rebuilds slot by slot
}
```

If an event handler synchronously calls `getRulesForEvent(guildId, ev)` after `invalidateGuild` but before its event slot has been re-added, it sees `[]` and silently no-ops. Although JS is single-threaded, microtask boundaries inside `addToInternalCache` (none today, but trivial to introduce) and the more important risk — the comment promises "minimize the window" but the window is non-zero — make this a race that should be eliminated by construction.

## Files
- Read: `packages/systems/src/actions/cache.ts`
- Read: `packages/systems/src/actions/cacheSync.ts`
- Read: `packages/systems/src/actions/persistence.ts`
- Modify: `packages/systems/src/actions/cache.ts`
- Create: `packages/systems/tests/unit/actions-cache-atomic.test.ts`

## Tasks

### Task 1: Replace in-place rebuild with build-then-swap

- [ ] **Step 1: Write the failing test**

Create `packages/systems/tests/unit/actions-cache-atomic.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const getRulesByGuildMock = vi.fn();

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({}),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../src/actions/persistence.js", () => ({
  getRulesByGuild: getRulesByGuildMock,
  rowToRule: (r: unknown) => r,
}));

import {
  reloadGuild,
  getRulesForEvent,
  addRuleToCache,
} from "../../src/actions/cache.js";
import type { ActionRule } from "../../src/actions/types.js";

function rule(id: number, eventType: string): ActionRule {
  return {
    id,
    guildId: "g1",
    name: `r${id}`,
    enabled: true,
    eventType: eventType as ActionRule["eventType"],
    actions: [],
    conditions: {},
    priority: 0,
    createdBy: "u1",
  };
}

describe("reloadGuild atomicity", () => {
  beforeEach(() => {
    getRulesByGuildMock.mockReset();
  });

  it("never exposes an empty rule set during reload", async () => {
    // Seed the cache with an existing rule
    addRuleToCache(rule(1, "memberJoin"));
    expect(getRulesForEvent("g1", "memberJoin")).toHaveLength(1);

    // Make getRulesByGuild observe the cache mid-reload
    const observed: number[] = [];
    getRulesByGuildMock.mockImplementation(async () => {
      // Simulate an event firing while the new rules are being fetched
      observed.push(getRulesForEvent("g1", "memberJoin").length);
      return [rule(2, "memberJoin"), rule(3, "memberJoin")];
    });

    await reloadGuild("g1");

    // During the fetch, the old rules MUST still be visible
    expect(observed).toEqual([1]);
    // After reload completes, the new rules are visible
    expect(getRulesForEvent("g1", "memberJoin")).toHaveLength(2);
  });

  it("swaps the entire eventType map in one assignment", async () => {
    addRuleToCache(rule(10, "messageDelete"));
    getRulesByGuildMock.mockResolvedValue([rule(11, "messageEdit")]);

    await reloadGuild("g1");

    // Old eventType bucket must be replaced, not merged
    expect(getRulesForEvent("g1", "messageDelete")).toHaveLength(0);
    expect(getRulesForEvent("g1", "messageEdit")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
docker compose run --rm bot pnpm --filter @fluxcore/systems test packages/systems/tests/unit/actions-cache-atomic.test.ts
```

The first test will currently pass (because `getRulesByGuild` resolves before `invalidateGuild`), but the second is unlikely to highlight the bug. Add a third assertion that wraps the issue precisely: insert a microtask between fetch and rebuild and assert no empty window.

Append to the test file:

```typescript
  it("preserves visibility across microtask boundaries", async () => {
    addRuleToCache(rule(20, "voiceJoin"));
    getRulesByGuildMock.mockImplementation(async () => {
      await Promise.resolve(); // microtask boundary
      return [rule(21, "voiceJoin")];
    });

    const reloadPromise = reloadGuild("g1");
    // Yield once: cache should still show the old rule
    await Promise.resolve();
    expect(getRulesForEvent("g1", "voiceJoin").length).toBeGreaterThan(0);
    await reloadPromise;
    expect(getRulesForEvent("g1", "voiceJoin")).toHaveLength(1);
  });
```

Re-run; the third test should fail on `main`.

- [ ] **Step 3: Implement build-then-swap**

Edit `packages/systems/src/actions/cache.ts`. Replace `reloadGuild`:

```typescript
export async function reloadGuild(guildId: string): Promise<void> {
  const rules = await getRulesByGuild(guildId);

  // Build the new per-event map locally first; only after it is fully
  // populated do we atomically swap it into the global cache. This
  // guarantees that any concurrent getRulesForEvent() call observes
  // EITHER the complete previous rule set OR the complete new one.
  const newGuildMap = new Map<string, ActionRule[]>();
  for (const rule of rules) {
    let bucket = newGuildMap.get(rule.eventType);
    if (!bucket) {
      bucket = [];
      newGuildMap.set(rule.eventType, bucket);
    }
    bucket.push(rule);
  }
  for (const bucket of newGuildMap.values()) {
    bucket.sort((a, b) => b.priority - a.priority);
  }

  if (newGuildMap.size === 0) {
    ruleCache.delete(guildId);
  } else {
    ruleCache.set(guildId, newGuildMap);
  }
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
docker compose run --rm bot pnpm --filter @fluxcore/systems test packages/systems/tests/unit/actions-cache-atomic.test.ts
docker compose run --rm bot pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/systems/src/actions/cache.ts packages/systems/tests/unit/actions-cache-atomic.test.ts
git commit -m "fix(actions): atomic-swap reload to eliminate empty-cache race window"
```
