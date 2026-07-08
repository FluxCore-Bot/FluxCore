# Verify $queryRaw Tagged-Template Safety in actions/persistence.ts — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** Critical (verify-only — no exploitable issue confirmed)
**Goal:** Prove the two `$queryRaw` call sites in `packages/systems/src/actions/persistence.ts` use Prisma's tagged-template form (which auto-parameterizes) rather than `$queryRawUnsafe` (which interpolates literally), then lock that guarantee in with a regression test and an explicit safety comment so future edits cannot silently regress to the unsafe form.
**Architecture:** `getAnalytics()` and `getLastFiredByGuild()` accept a `guildId` arg from API/command callers and feed it into a raw SQL string that targets `ActionLog`. Prisma's tagged-template `$queryRaw\`...${guildId}...\`` form sends parameters as bind variables, while `$queryRawUnsafe` concatenates them into the SQL string verbatim — a SQLi sink. We will add a test that injects a malicious guildId and asserts the row count is unchanged (proving Prisma escaped it), and annotate both call sites.
**Tech Stack:** discord.js v14, TypeScript, Prisma, Vitest

---

## Vulnerability

`packages/systems/src/actions/persistence.ts` lines 272-284 and 351-358 use `prisma.$queryRaw` with template-literal interpolation of a caller-supplied `guildId`. Verification reading the file confirms it uses the tagged-template form (`prisma.$queryRaw<...>\`...WHERE "guildId" = ${guildId}...\``), which Prisma turns into a parameterized query. However, there is no test that pins this guarantee, and the file has no comment warning future maintainers that switching to `$queryRawUnsafe` here would expose a SQLi sink.

## Files

- `packages/systems/src/actions/persistence.ts` (lines 260-358)
- `packages/systems/tests/integration/actions-sync.test.ts` (sibling — pattern reference)
- New: `packages/systems/tests/integration/actions-persistence-sqli.test.ts`

## Tasks

### Task 1: Add SQLi regression test for getAnalytics and getLastFiredByGuild

- [ ] **Step 1: Write failing test** — create `packages/systems/tests/integration/actions-persistence-sqli.test.ts`:

```typescript
/**
 * Regression: prisma.$queryRaw in actions/persistence.ts MUST use the
 * tagged-template form so guildId is bound as a parameter, not concatenated.
 * If anyone switches these call sites to $queryRawUnsafe with string
 * interpolation, the malicious guildId below would drop or corrupt rows
 * and these assertions would fail.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setupTestDatabase,
  cleanTestData,
  teardownTestDatabase,
} from "../helpers/db.js";
import { getPrisma } from "@fluxcore/database";
import {
  getAnalytics,
  getLastFiredByGuild,
} from "../../src/actions/persistence.js";

const SAFE_GUILD = "guild-safe-1";
const MALICIOUS_GUILD = `guild-x'; DROP TABLE "ActionLog"; --`;

describe("actions persistence — $queryRaw SQLi safety", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestData();
    const prisma = getPrisma();
    await prisma.actionRule.create({
      data: {
        guildId: SAFE_GUILD,
        name: "rule-1",
        enabled: true,
        eventType: "memberJoin",
        actions: "[]",
        conditions: "{}",
        priority: 0,
        createdBy: "user-1",
      },
    });
    await prisma.actionLog.create({
      data: {
        guildId: SAFE_GUILD,
        ruleId: 0,
        ruleName: "rule-1",
        eventType: "memberJoin",
        actionType: "sendMessage",
        success: true,
        error: null,
        metadata: "{}",
      },
    });
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("getAnalytics treats malicious guildId as a literal value, not SQL", async () => {
    const result = await getAnalytics(MALICIOUS_GUILD, 7);
    expect(result.summary.totalExecutions).toBe(0);
    expect(result.executionTrend).toEqual([]);

    // ActionLog table must still exist and still contain the safe row
    const prisma = getPrisma();
    const stillThere = await prisma.actionLog.count({
      where: { guildId: SAFE_GUILD },
    });
    expect(stillThere).toBe(1);
  });

  it("getLastFiredByGuild treats malicious guildId as a literal value, not SQL", async () => {
    const map = await getLastFiredByGuild(MALICIOUS_GUILD);
    expect(map.size).toBe(0);

    const prisma = getPrisma();
    const stillThere = await prisma.actionLog.count({
      where: { guildId: SAFE_GUILD },
    });
    expect(stillThere).toBe(1);
  });

  it("getAnalytics returns real data for the legitimate guildId", async () => {
    const result = await getAnalytics(SAFE_GUILD, 7);
    expect(result.summary.totalExecutions).toBe(1);
  });
});
```

- [ ] **Step 2: Run** — `docker compose -f docker-compose.test.yml run --rm test pnpm test:integration packages/systems/tests/integration/actions-persistence-sqli.test.ts`. Expected: tests PASS immediately (the tagged-template form is already safe). If any test FAILS, that means the call site is unsafe and Task 2 must convert it to a Prisma query builder before re-running.

- [ ] **Step 3: Implement** — annotate both call sites in `packages/systems/src/actions/persistence.ts` so future maintainers do not regress. Replace the `getAnalytics` raw block (around line 272) by adding a comment immediately above the `prisma.$queryRaw` call:

```typescript
      // SECURITY: tagged-template `$queryRaw` form. Prisma binds ${guildId}
      // and ${since} as parameters — DO NOT switch this to $queryRawUnsafe
      // or string-concatenate values into the SQL. Covered by
      // tests/integration/actions-persistence-sqli.test.ts.
      prisma.$queryRaw<
        Array<{ date: string; total: bigint; success: bigint; error: bigint }>
      >`
```

And likewise above the `getLastFiredByGuild` block (around line 351):

```typescript
  // SECURITY: tagged-template `$queryRaw` form — guildId is bound as a
  // parameter. DO NOT convert to $queryRawUnsafe. Covered by
  // tests/integration/actions-persistence-sqli.test.ts.
  const rows = await prisma.$queryRaw<
    Array<{ ruleId: number; lastFired: Date }>
  >`
```

- [ ] **Step 4: Run** — `docker compose -f docker-compose.test.yml run --rm test pnpm test:integration packages/systems/tests/integration/actions-persistence-sqli.test.ts` and `docker compose run --rm bot pnpm typecheck`. Expected: tests PASS, typecheck PASSES.

- [ ] **Step 5: Commit** —

```
test(actions): pin $queryRaw guildId binding with SQLi regression test

Adds an integration test that proves prisma.$queryRaw in
actions/persistence.ts uses the tagged-template (parameterized) form
and is not vulnerable to SQL injection via guildId. Annotates both
call sites with a SECURITY comment so future edits cannot silently
regress to $queryRawUnsafe.
```
