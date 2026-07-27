# Command Palette (Record Search) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the palette find live database records across ten models, and land on the exact record the user picked.

**Architecture:** Each searchable table gains a Postgres `tsvector` column, generated and maintained by the database itself, plus a GIN index. One endpoint fans out across the sources the caller is permitted to see and returns ranked, capped groups. The client adds a debounced remote source alongside the static ones. Selecting a record navigates with `?focus=<id>`, and the target page pre-filters its list to that record.

**Tech Stack:** PostgreSQL 18 full-text search, Prisma 7 (`$queryRawUnsafe` — Prisma cannot type a generated `tsvector`), Fastify 5, TanStack Router search params, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-07-26-command-palette-design.md` (phases 3–6).

**Prerequisite:** `docs/superpowers/plans/2026-07-26-command-palette-navigation.md` must be complete and merged. This plan extends the palette it builds.

**Worktree setup:** if you are starting in a fresh worktree, run the three environmental steps in that plan's "Before You Start" section first (symlink `.env.dev`, install inside Docker, `db:deploy` to the worktree's own postgres volume). Without them `pnpm test` fails in ways that look like code bugs. This plan adds migrations, so step 3 matters twice over — `pnpm db:migrate` must run against the worktree's own volume, not the main stack's.

## Global Constraints

Everything in the navigation plan's Global Constraints still applies. Additionally:

- **`pnpm db:generate` after every `schema.prisma` change**, and `pnpm db:migrate` to apply migrations. Both run through Docker.
- **Never interpolate user input into SQL.** Table names and column expressions are compile-time constants; `guildId` and the tsquery string are always bound parameters.
- **Text search config is `simple`, never `english`.** Content spans 48 locales; English stemming would corrupt matching for every other language.
- **Server route tests** live in `apps/dashboard/tests/server/features/<module>/` — matching the repo, not the (stale) path in `CLAUDE.md`.
- **Integration tests** run with `pnpm test:integration` against the Docker test database and must use the real DB, never a mock.
- **Guild scoping is a security property.** Every query filters on `guildId`, and there is a test that proves it.

---

## File Structure

**Created:**

| File | Responsibility |
|------|----------------|
| `packages/database/prisma/migrations/<ts>_add_search_vectors/migration.sql` | tsvector columns + GIN indexes |
| `packages/systems/src/search/types.ts` | `SearchItem`, `SearchGroup`, `RecordSourceKey` |
| `packages/systems/src/search/tsquery.ts` | Sanitise input → prefix tsquery |
| `packages/systems/src/search/sources.ts` | One descriptor per searchable model |
| `packages/systems/src/search/index.ts` | `searchGuild()` fan-out |
| `apps/dashboard/src/server/features/search/routes.ts` | `GET /api/guilds/:guildId/search` |
| `apps/dashboard/src/client/shared/command-palette/sources/records.ts` | Debounced remote source |
| `apps/dashboard/src/client/shared/hooks/useFocusedRecord.ts` | Reads `?focus=`, scrolls, highlights, clears |

**Modified:** `schema.prisma`, `packages/systems/package.json` (exports), `packages/systems/tests/helpers/db.ts` + `factories.ts`, `apps/dashboard/src/server/index.ts`, `main.tsx` (9 routes), `__root.tsx`, and 9 feature pages.

---

## Task 1: Search vectors, migration, and test fixtures

**Files:**
- Create: `packages/database/prisma/migrations/<timestamp>_add_search_vectors/migration.sql`
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `packages/systems/tests/helpers/db.ts`
- Modify: `packages/systems/tests/helpers/factories.ts`
- Test: `packages/systems/tests/integration/search-vectors.test.ts`

**Interfaces:**
- Produces: a `searchVector` column on 10 tables; factories `createWarning`, `createModCase`, `createTicket`, `createGiveaway`, `createSuggestion`, `createRolePanel`, `createTicketPanel`, `createCustomCommand`. Consumed by Task 3.

- [ ] **Step 1: Write the failing integration test**

Create `packages/systems/tests/integration/search-vectors.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { getPrisma } from "@fluxcore/database";
import { setupTestDatabase, cleanTestData, teardownTestDatabase } from "../helpers/db";
import { createActionRule, createWarning } from "../helpers/factories";

beforeAll(() => setupTestDatabase());
beforeEach(() => cleanTestData());
afterAll(() => teardownTestDatabase());

async function matches(table: string, guildId: string, tsq: string) {
  return getPrisma().$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT "id" FROM "${table}"
      WHERE "guildId" = $1 AND "searchVector" @@ to_tsquery('simple', $2)`,
    guildId, tsq,
  );
}

describe("search vectors", () => {
  it("populates on insert with no application-side sync", async () => {
    await createActionRule({ guildId: "g1", name: "Anti-spam escalation" });
    expect(await matches("ActionRule", "g1", "spam:*")).toHaveLength(1);
  });

  it("updates when the indexed text changes", async () => {
    const rule = await createActionRule({ guildId: "g1", name: "Original name" });
    expect(await matches("ActionRule", "g1", "original:*")).toHaveLength(1);

    await getPrisma().actionRule.update({
      where: { id: rule.id },
      data: { name: "Completely different" },
    });

    expect(await matches("ActionRule", "g1", "original:*")).toHaveLength(0);
    expect(await matches("ActionRule", "g1", "different:*")).toHaveLength(1);
  });

  it("matches a word prefix", async () => {
    await createWarning({ guildId: "g1", reason: "spamming in general" });
    expect(await matches("Warning", "g1", "spam:*")).toHaveLength(1);
  });

  it("does NOT match a mid-word substring", async () => {
    // Locks in the documented tradeoff: FTS is word-prefix only. If this ever
    // needs to pass, the fix is a pg_trgm index, not a change here.
    await createWarning({ guildId: "g1", reason: "spamming in general" });
    expect(await matches("Warning", "g1", "amming:*")).toHaveLength(0);
  });

  it("does not stem, so stopword-like names stay findable", async () => {
    // 'english' config would drop "The" entirely; 'simple' keeps it.
    await createActionRule({ guildId: "g1", name: "The Purge" });
    expect(await matches("ActionRule", "g1", "the:*")).toHaveLength(1);
  });

  it("indexes non-Latin text", async () => {
    await createActionRule({ guildId: "g1", name: "قواعد الإشراف" });
    expect(await matches("ActionRule", "g1", "الإشراف:*")).toHaveLength(1);
  });

  it("isolates guilds", async () => {
    await createActionRule({ guildId: "g1", name: "Anti-spam" });
    await createActionRule({ guildId: "g2", name: "Anti-spam" });
    expect(await matches("ActionRule", "g1", "spam:*")).toHaveLength(1);
  });

  it("folds every indexed column into one vector", async () => {
    const { createTicket } = await import("../helpers/factories");
    await createTicket({ guildId: "g1", categoryName: "billing", closeReason: "resolved" });
    expect(await matches("Ticket", "g1", "billing:*")).toHaveLength(1);
    expect(await matches("Ticket", "g1", "resolved:*")).toHaveLength(1);
  });

  it("tolerates NULLs in indexed columns", async () => {
    const { createTicket } = await import("../helpers/factories");
    await createTicket({ guildId: "g1", categoryName: null, closeReason: null });
    expect(await matches("Ticket", "g1", "anything:*")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm test:integration -- search-vectors
```

Expected: FAIL — `column "searchVector" does not exist`.

- [ ] **Step 3: Add the columns to `schema.prisma`**

Add this line to each of the 10 models (`ActionRule`, `RolePanel`, `TicketPanel`, `Ticket`, `ScheduledMessage`, `CustomCommand`, `Warning`, `ModCase`, `Giveaway`, `Suggestion`):

```prisma
  /// Generated by Postgres — see migration add_search_vectors. Prisma 7 cannot
  /// type a generated tsvector, so it is Unsupported and excluded from the
  /// client API; queries against it use $queryRawUnsafe.
  searchVector Unsupported("tsvector")?
```

- [ ] **Step 4: Create the migration**

```bash
pnpm db:migrate -- --create-only --name add_search_vectors
```

Replace the generated `migration.sql` body entirely with:

```sql
-- Generated tsvector columns + GIN indexes for command-palette search.
--
-- 'simple' (not 'english') is deliberate: dashboard content spans 48 locales,
-- and English stemming/stopword removal would drop words from user-authored
-- names in every other language.
--
-- GENERATED ALWAYS ... STORED means Postgres maintains these on every write.
-- No application-side sync, no backfill, no drift. The ALTER TABLE populates
-- existing rows.

ALTER TABLE "ActionRule" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("name", ''))) STORED;
CREATE INDEX "ActionRule_searchVector_idx" ON "ActionRule" USING GIN ("searchVector");

ALTER TABLE "RolePanel" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("name", ''))) STORED;
CREATE INDEX "RolePanel_searchVector_idx" ON "RolePanel" USING GIN ("searchVector");

ALTER TABLE "TicketPanel" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("name", ''))) STORED;
CREATE INDEX "TicketPanel_searchVector_idx" ON "TicketPanel" USING GIN ("searchVector");

ALTER TABLE "Ticket" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple',
    coalesce("categoryName", '') || ' ' || coalesce("closeReason", ''))) STORED;
CREATE INDEX "Ticket_searchVector_idx" ON "Ticket" USING GIN ("searchVector");

ALTER TABLE "ScheduledMessage" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("name", ''))) STORED;
CREATE INDEX "ScheduledMessage_searchVector_idx" ON "ScheduledMessage" USING GIN ("searchVector");

ALTER TABLE "CustomCommand" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("name", ''))) STORED;
CREATE INDEX "CustomCommand_searchVector_idx" ON "CustomCommand" USING GIN ("searchVector");

ALTER TABLE "Warning" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("reason", ''))) STORED;
CREATE INDEX "Warning_searchVector_idx" ON "Warning" USING GIN ("searchVector");

ALTER TABLE "ModCase" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("reason", ''))) STORED;
CREATE INDEX "ModCase_searchVector_idx" ON "ModCase" USING GIN ("searchVector");

ALTER TABLE "Giveaway" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("prize", ''))) STORED;
CREATE INDEX "Giveaway_searchVector_idx" ON "Giveaway" USING GIN ("searchVector");

ALTER TABLE "Suggestion" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("content", ''))) STORED;
CREATE INDEX "Suggestion_searchVector_idx" ON "Suggestion" USING GIN ("searchVector");
```

Then apply and regenerate:

```bash
pnpm db:migrate
pnpm db:generate
```

- [ ] **Step 5: Extend `cleanTestData`**

`packages/systems/tests/helpers/db.ts` truncates only a subset of tables — the models this plan searches would leak between tests. Add the missing names to the `TRUNCATE` list:

```
      "Warning",
      "WarnPunishment",
      "WarnGuildSettings",
      "ModCase",
      "ModGuildSettings",
      "RolePanel",
      "CustomCommand",
      "Giveaway",
      "GiveawayCacheInvalidation",
      "Suggestion",
      "SuggestionGuildSettings",
```

- [ ] **Step 6: Add the missing factories**

Append to `packages/systems/tests/helpers/factories.ts`, following the existing style:

```ts
export async function createWarning(overrides: {
  guildId?: string; userId?: string; moderatorId?: string; reason?: string;
} = {}) {
  return getPrisma().warning.create({
    data: {
      guildId: overrides.guildId ?? "guild-1",
      userId: overrides.userId ?? "user-1",
      moderatorId: overrides.moderatorId ?? "mod-1",
      reason: overrides.reason ?? "test reason",
    },
  });
}

export async function createModCase(overrides: {
  guildId?: string; targetId?: string; moderatorId?: string;
  action?: string; reason?: string | null;
} = {}) {
  return getPrisma().modCase.create({
    data: {
      guildId: overrides.guildId ?? "guild-1",
      targetId: overrides.targetId ?? "user-1",
      moderatorId: overrides.moderatorId ?? "mod-1",
      action: overrides.action ?? "ban",
      reason: overrides.reason === undefined ? "test reason" : overrides.reason,
    },
  });
}

export async function createTicket(overrides: {
  guildId?: string; channelId?: string; userId?: string;
  categoryName?: string | null; closeReason?: string | null; status?: string;
} = {}) {
  return getPrisma().ticket.create({
    data: {
      guildId: overrides.guildId ?? "guild-1",
      channelId: overrides.channelId ?? `chan-${Math.floor(performance.now() * 1000)}`,
      userId: overrides.userId ?? "user-1",
      categoryName: overrides.categoryName === undefined ? "support" : overrides.categoryName,
      closeReason: overrides.closeReason === undefined ? null : overrides.closeReason,
      status: overrides.status ?? "open",
    },
  });
}

export async function createGiveaway(overrides: {
  guildId?: string; channelId?: string; hostId?: string;
  prize?: string; endsAt?: Date;
} = {}) {
  return getPrisma().giveaway.create({
    data: {
      guildId: overrides.guildId ?? "guild-1",
      channelId: overrides.channelId ?? "chan-1",
      hostId: overrides.hostId ?? "user-1",
      prize: overrides.prize ?? "test prize",
      endsAt: overrides.endsAt ?? new Date(Date.parse("2030-01-01T00:00:00Z")),
    },
  });
}

export async function createSuggestion(overrides: {
  guildId?: string; userId?: string; content?: string; status?: string;
} = {}) {
  return getPrisma().suggestion.create({
    data: {
      guildId: overrides.guildId ?? "guild-1",
      userId: overrides.userId ?? "user-1",
      content: overrides.content ?? "test suggestion",
      status: overrides.status ?? "pending",
    },
  });
}

export async function createRolePanel(overrides: {
  guildId?: string; channelId?: string; name?: string; type?: string; createdBy?: string;
} = {}) {
  return getPrisma().rolePanel.create({
    data: {
      guildId: overrides.guildId ?? "guild-1",
      channelId: overrides.channelId ?? "chan-1",
      name: overrides.name ?? "test panel",
      type: overrides.type ?? "button",
      createdBy: overrides.createdBy ?? "user-1",
    },
  });
}

export async function createTicketPanel(overrides: {
  guildId?: string; channelId?: string; name?: string; createdBy?: string;
} = {}) {
  return getPrisma().ticketPanel.create({
    data: {
      guildId: overrides.guildId ?? "guild-1",
      channelId: overrides.channelId ?? "chan-1",
      name: overrides.name ?? "test ticket panel",
      createdBy: overrides.createdBy ?? "user-1",
    },
  });
}

export async function createCustomCommand(overrides: {
  guildId?: string; name?: string; triggerType?: string; createdBy?: string;
} = {}) {
  return getPrisma().customCommand.create({
    data: {
      guildId: overrides.guildId ?? "guild-1",
      name: overrides.name ?? "test-command",
      triggerType: overrides.triggerType ?? "command",
      createdBy: overrides.createdBy ?? "user-1",
    },
  });
}
```

> `performance.now()` supplies the unique `channelId` a `Ticket` needs (`channelId` is `@unique`). `Date.now()` is avoided here only for consistency with the deterministic-time convention; any unique value works.

- [ ] **Step 7: Run the integration test**

```bash
pnpm test:integration -- search-vectors
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/database/prisma packages/systems/tests/helpers \
        packages/systems/tests/integration/search-vectors.test.ts
git commit -m "$(cat <<'EOF'
feat(search): add generated tsvector columns and GIN indexes

GENERATED ALWAYS ... STORED means Postgres maintains the vectors itself, so
there is no write-path hook to miss and no backfill. 'simple' config avoids
English stemming, which would corrupt matching for the other 47 locales.

Tests pin the tradeoffs: word-prefix matches, mid-word substrings do not.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: The tsquery builder

Raw user text must never reach `to_tsquery` — malformed input raises a Postgres syntax error and would turn a typo into a 500.

**Files:**
- Create: `packages/systems/src/search/tsquery.ts`
- Test: `packages/systems/tests/tsquery.test.ts`

**Interfaces:**
- Produces: `toPrefixQuery(raw: string): string | null`, `parseExactId(raw: string): number | null`. Consumed by Task 3.

- [ ] **Step 1: Write the failing test**

Create `packages/systems/tests/tsquery.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toPrefixQuery, parseExactId } from "../src/search/tsquery";

describe("toPrefixQuery", () => {
  it("turns a single word into a prefix term", () => {
    expect(toPrefixQuery("spam")).toBe("spam:*");
  });

  it("ANDs multiple words", () => {
    expect(toPrefixQuery("spam general")).toBe("spam:* & general:*");
  });

  it("lowercases", () => {
    expect(toPrefixQuery("SPAM")).toBe("spam:*");
  });

  it("strips tsquery operators instead of passing them through", () => {
    expect(toPrefixQuery("a & | b")).toBe("a:* & b:*");
    expect(toPrefixQuery("!(foo)")).toBe("foo:*");
    expect(toPrefixQuery("a <-> b")).toBe("a:* & b:*");
  });

  it("keeps non-Latin words", () => {
    expect(toPrefixQuery("الإشراف")).toBe("الإشراف:*");
  });

  it("keeps digits", () => {
    expect(toPrefixQuery("case 142")).toBe("case:* & 142:*");
  });

  it("returns null when nothing usable remains", () => {
    expect(toPrefixQuery("")).toBeNull();
    expect(toPrefixQuery("   ")).toBeNull();
    expect(toPrefixQuery("&&&")).toBeNull();
    expect(toPrefixQuery("🎉")).toBeNull();
  });
});

describe("parseExactId", () => {
  it("reads a bare integer", () => {
    expect(parseExactId("142")).toBe(142);
  });

  it("reads a hash-prefixed integer", () => {
    expect(parseExactId("#142")).toBe(142);
  });

  it("ignores surrounding whitespace", () => {
    expect(parseExactId("  #142  ")).toBe(142);
  });

  it("returns null for anything else", () => {
    expect(parseExactId("spam")).toBeNull();
    expect(parseExactId("142 spam")).toBeNull();
    expect(parseExactId("")).toBeNull();
  });

  it("returns null for values outside a 32-bit signed int", () => {
    // Prisma ids are Int; a larger value would overflow the column type.
    expect(parseExactId("99999999999")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/systems test -- tsquery
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `packages/systems/src/search/tsquery.ts`:

```ts
const MAX_INT32 = 2_147_483_647;

/**
 * Build a prefix tsquery from untrusted input.
 *
 * Tokens are EXTRACTED rather than escaped: only letters and digits survive,
 * so tsquery operators (& | ! <-> parentheses) can never reach the parser and
 * a malformed query is impossible by construction.
 *
 * Each token gets `:*` so typing prefixes match as you go — "spa" finds
 * "spam". Note this is a WORD prefix: "pam" will not find "spam".
 */
export function toPrefixQuery(raw: string): string | null {
  const tokens = raw.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!tokens || tokens.length === 0) return null;
  return tokens.map((t) => `${t}:*`).join(" & ");
}

/**
 * People refer to these records by number ("case 142", "#142"). Returns the id
 * for an exact lookup, or null when the query is not purely an id.
 */
export function parseExactId(raw: string): number | null {
  const match = raw.trim().match(/^#?(\d+)$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_INT32 ? value : null;
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @fluxcore/systems test -- tsquery
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/systems/src/search/tsquery.ts packages/systems/tests/tsquery.test.ts
git commit -m "$(cat <<'EOF'
feat(search): build tsqueries by token extraction

Only letters and digits survive, so tsquery operators cannot reach the
parser — a malformed query is impossible rather than merely escaped.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Source descriptors and the fan-out

**Files:**
- Create: `packages/systems/src/search/types.ts`
- Create: `packages/systems/src/search/sources.ts`
- Create: `packages/systems/src/search/index.ts`
- Modify: `packages/systems/package.json` (exports)
- Test: `packages/systems/tests/integration/search.test.ts`

**Interfaces:**
- Consumes: `toPrefixQuery`, `parseExactId` (Task 2); factories (Task 1).
- Produces:
  ```ts
  type RecordSourceKey = "rules" | "rolePanels" | "ticketPanels" | "tickets"
    | "scheduled" | "commands" | "warnings" | "cases" | "giveaways" | "suggestions";
  interface SearchItem { type: RecordSourceKey; id: string; title: string;
    subtitle: string | null; route: string; focus: string }
  interface SearchGroup { source: RecordSourceKey; total: number; items: SearchItem[] }
  function searchGuild(guildId: string, query: string,
    can: (permission: string) => boolean): Promise<SearchGroup[]>
  ```
  Consumed by Task 4.

- [ ] **Step 1: Write the failing integration test**

Create `packages/systems/tests/integration/search.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDatabase, cleanTestData, teardownTestDatabase } from "../helpers/db";
import { searchGuild } from "../../src/search/index";
import {
  createActionRule, createWarning, createModCase, createTicket,
  createGiveaway, createSuggestion, createRolePanel, createTicketPanel,
  createCustomCommand, createScheduledMessageFactory,
} from "../helpers/factories";

const ALL = () => true;
const NONE = () => false;

beforeAll(() => setupTestDatabase());
beforeEach(() => cleanTestData());
afterAll(() => teardownTestDatabase());

describe("searchGuild", () => {
  it("returns nothing for a query with no usable tokens", async () => {
    await createActionRule({ guildId: "g1", name: "Anti-spam" });
    expect(await searchGuild("g1", "!!!", ALL)).toEqual([]);
  });

  it("finds a rule by word prefix", async () => {
    await createActionRule({ guildId: "g1", name: "Anti-spam escalation" });
    const groups = await searchGuild("g1", "spam", ALL);
    expect(groups.map((g) => g.source)).toEqual(["rules"]);
    expect(groups[0].items[0].title).toBe("Anti-spam escalation");
    expect(groups[0].items[0].route).toBe("/guild/$guildId/rules");
  });

  it("searches every permitted source", async () => {
    await createActionRule({ guildId: "g1", name: "spam rule" });
    await createWarning({ guildId: "g1", reason: "spam in general" });
    await createModCase({ guildId: "g1", reason: "spam" });
    await createTicket({ guildId: "g1", categoryName: "spam reports" });
    await createGiveaway({ guildId: "g1", prize: "spam sandwich" });
    await createSuggestion({ guildId: "g1", content: "less spam please" });
    await createRolePanel({ guildId: "g1", name: "spam panel" });
    await createTicketPanel({ guildId: "g1", name: "spam tickets" });
    await createCustomCommand({ guildId: "g1", name: "spamcheck" });
    await createScheduledMessageFactory({ guildId: "g1", name: "spam digest" });

    const sources = (await searchGuild("g1", "spam", ALL)).map((g) => g.source);
    expect(sources).toEqual([
      "rules", "rolePanels", "ticketPanels", "tickets", "scheduled",
      "commands", "warnings", "cases", "giveaways", "suggestions",
    ]);
  });

  it("omits sources the caller cannot see", async () => {
    await createActionRule({ guildId: "g1", name: "spam rule" });
    await createWarning({ guildId: "g1", reason: "spam" });

    const groups = await searchGuild("g1", "spam", (p) => p === "actions.rules.view");
    expect(groups.map((g) => g.source)).toEqual(["rules"]);
  });

  it("returns nothing when the caller can see nothing", async () => {
    await createActionRule({ guildId: "g1", name: "spam rule" });
    expect(await searchGuild("g1", "spam", NONE)).toEqual([]);
  });

  it("never leaks another guild's records", async () => {
    await createActionRule({ guildId: "g1", name: "spam rule" });
    await createWarning({ guildId: "g2", reason: "spam" });
    await createTicket({ guildId: "g2", categoryName: "spam" });

    const groups = await searchGuild("g1", "spam", ALL);
    expect(groups.map((g) => g.source)).toEqual(["rules"]);
    expect(groups[0].items).toHaveLength(1);
  });

  it("caps a group at five items but reports the true total", async () => {
    for (let i = 0; i < 9; i++) {
      await createActionRule({ guildId: "g1", name: `spam rule ${i}` });
    }
    const [rules] = await searchGuild("g1", "spam", ALL);
    expect(rules.items).toHaveLength(5);
    expect(rules.total).toBe(9);
  });

  it("carries a focus id that identifies the record", async () => {
    const warning = await createWarning({ guildId: "g1", reason: "spam" });
    const [group] = await searchGuild("g1", "spam", ALL);
    expect(group.items[0].focus).toBe(String(warning.id));
  });

  it("finds a record by exact id", async () => {
    const warning = await createWarning({ guildId: "g1", reason: "nothing alike" });
    const groups = await searchGuild("g1", `#${warning.id}`, ALL);
    const warnings = groups.find((g) => g.source === "warnings");
    expect(warnings?.items[0].focus).toBe(String(warning.id));
  });

  it("does not return an id match from another guild", async () => {
    const warning = await createWarning({ guildId: "g2", reason: "spam" });
    const groups = await searchGuild("g1", `#${warning.id}`, ALL);
    expect(groups.find((g) => g.source === "warnings")).toBeUndefined();
  });

  it("ANDs multiple words rather than ORing them", async () => {
    await createActionRule({ guildId: "g1", name: "spam filter" });
    await createActionRule({ guildId: "g1", name: "spam only" });
    const [rules] = await searchGuild("g1", "spam filter", ALL);
    expect(rules.items).toHaveLength(1);
    expect(rules.items[0].title).toBe("spam filter");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm test:integration -- integration/search.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Define the types**

Create `packages/systems/src/search/types.ts`:

```ts
export type RecordSourceKey =
  | "rules" | "rolePanels" | "ticketPanels" | "tickets" | "scheduled"
  | "commands" | "warnings" | "cases" | "giveaways" | "suggestions";

export interface SearchItem {
  type: RecordSourceKey;
  id: string;
  title: string;
  subtitle: string | null;
  /** TanStack route path, with $guildId left unsubstituted. */
  route: string;
  /** Value for the ?focus= search param on that route. */
  focus: string;
}

export interface SearchGroup {
  source: RecordSourceKey;
  /** Total matches before capping — drives the "N more" affordance. */
  total: number;
  items: SearchItem[];
}
```

- [ ] **Step 4: Define the source descriptors**

Create `packages/systems/src/search/sources.ts`:

```ts
import type { RecordSourceKey } from "./types.js";

export interface SearchSource {
  key: RecordSourceKey;
  permission: string;
  /** Quoted Postgres table name. COMPILE-TIME CONSTANT — never user input. */
  table: string;
  /** SQL expression producing the row title. COMPILE-TIME CONSTANT. */
  titleExpr: string;
  /** SQL expression producing the muted subtitle, or null. COMPILE-TIME CONSTANT. */
  subtitleExpr: string | null;
  route: string;
}

/**
 * Order here is the order groups appear in the palette — it mirrors the
 * sidebar so the list reads the way the navigation does.
 */
export const SEARCH_SOURCES: SearchSource[] = [
  {
    key: "rules", permission: "actions.rules.view", table: "ActionRule",
    titleExpr: `"name"`, subtitleExpr: `"eventType"`,
    route: "/guild/$guildId/rules",
  },
  {
    key: "rolePanels", permission: "roles.panels.view", table: "RolePanel",
    titleExpr: `"name"`, subtitleExpr: `"type"`,
    route: "/guild/$guildId/roles",
  },
  {
    key: "ticketPanels", permission: "tickets.list.view", table: "TicketPanel",
    titleExpr: `"name"`, subtitleExpr: null,
    route: "/guild/$guildId/tickets",
  },
  {
    key: "tickets", permission: "tickets.list.view", table: "Ticket",
    titleExpr: `'#' || "id" || ' · ' || coalesce("categoryName", '')`,
    subtitleExpr: `"status"`,
    route: "/guild/$guildId/tickets",
  },
  {
    key: "scheduled", permission: "scheduled.messages.view", table: "ScheduledMessage",
    titleExpr: `"name"`, subtitleExpr: `"cronExpr"`,
    route: "/guild/$guildId/scheduled",
  },
  {
    key: "commands", permission: "commands.list.view", table: "CustomCommand",
    titleExpr: `"name"`, subtitleExpr: `"triggerType"`,
    route: "/guild/$guildId/commands",
  },
  {
    key: "warnings", permission: "moderation.warnings.view", table: "Warning",
    titleExpr: `'#' || "id" || ' · ' || "reason"`, subtitleExpr: `"userId"`,
    route: "/guild/$guildId/warnings",
  },
  {
    key: "cases", permission: "moderation.cases.view", table: "ModCase",
    titleExpr: `'#' || "id" || ' · ' || coalesce("reason", '')`,
    subtitleExpr: `"action"`,
    route: "/guild/$guildId/moderation",
  },
  {
    key: "giveaways", permission: "giveaways.list.view", table: "Giveaway",
    titleExpr: `"prize"`, subtitleExpr: null,
    route: "/guild/$guildId/giveaways",
  },
  {
    key: "suggestions", permission: "suggestions.list.view", table: "Suggestion",
    titleExpr: `'#' || "id" || ' · ' || "content"`, subtitleExpr: `"status"`,
    route: "/guild/$guildId/suggestions",
  },
];
```

- [ ] **Step 5: Implement the fan-out**

Create `packages/systems/src/search/index.ts`:

```ts
import { getPrisma } from "@fluxcore/database";
import { toPrefixQuery, parseExactId } from "./tsquery.js";
import { SEARCH_SOURCES, type SearchSource } from "./sources.js";
import type { SearchGroup, SearchItem } from "./types.js";

export type { SearchGroup, SearchItem, RecordSourceKey } from "./types.js";

const GROUP_CAP = 5;

interface Row {
  id: string;
  title: string;
  subtitle: string | null;
  total: bigint;
}

function toItem(source: SearchSource, row: Row): SearchItem {
  return {
    type: source.key,
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    route: source.route,
    focus: row.id,
  };
}

async function runSource(
  source: SearchSource,
  guildId: string,
  tsq: string | null,
  exactId: number | null,
): Promise<SearchGroup | null> {
  const prisma = getPrisma();
  const items: SearchItem[] = [];

  // Exact-id hit first: people search "142" meaning "case 142", and a text
  // match on the digits is far less likely to be what they wanted.
  if (exactId !== null) {
    const sql = `
      SELECT "id"::text AS id,
             ${source.titleExpr} AS title,
             ${source.subtitleExpr ?? "NULL"} AS subtitle,
             1::bigint AS total
        FROM "${source.table}"
       WHERE "guildId" = $1 AND "id" = $2
    `;
    const rows = await prisma.$queryRawUnsafe<Row[]>(sql, guildId, exactId);
    items.push(...rows.map((r) => toItem(source, r)));
  }

  let total = items.length;

  if (tsq) {
    // COUNT(*) OVER() gives the pre-LIMIT total in the same statement — a
    // separate COUNT query would double the fan-out from 10 round-trips to 20.
    const sql = `
      SELECT "id"::text AS id,
             ${source.titleExpr} AS title,
             ${source.subtitleExpr ?? "NULL"} AS subtitle,
             COUNT(*) OVER() AS total
        FROM "${source.table}"
       WHERE "guildId" = $1
         AND "searchVector" @@ to_tsquery('simple', $2)
       ORDER BY ts_rank("searchVector", to_tsquery('simple', $2)) DESC, "id" DESC
       LIMIT ${GROUP_CAP}
    `;
    const rows = await prisma.$queryRawUnsafe<Row[]>(sql, guildId, tsq);
    if (rows.length > 0) total = Number(rows[0].total) + items.length;

    for (const row of rows) {
      if (items.some((i) => i.id === row.id)) continue; // already matched by id
      items.push(toItem(source, row));
    }
  }

  if (items.length === 0) return null;
  return { source: source.key, total, items: items.slice(0, GROUP_CAP) };
}

/**
 * Search every source the caller is permitted to see, in parallel.
 *
 * Permission filtering happens BEFORE the query, so an unpermitted table is
 * never touched — permissions gate the database round-trip, not just the
 * response body.
 */
export async function searchGuild(
  guildId: string,
  query: string,
  can: (permission: string) => boolean,
): Promise<SearchGroup[]> {
  const tsq = toPrefixQuery(query);
  const exactId = parseExactId(query);
  if (!tsq && exactId === null) return [];

  const permitted = SEARCH_SOURCES.filter((s) => can(s.permission));
  const results = await Promise.all(
    permitted.map((s) => runSource(s, guildId, tsq, exactId)),
  );

  return results.filter((g): g is SearchGroup => g !== null);
}
```

- [ ] **Step 6: Add the package exports**

In `packages/systems/package.json`, add to `"exports"`:

```jsonc
    "./search": {
      "types": "./dist/search/index.d.ts",
      "import": "./dist/search/index.js"
    },
    "./search/types": {
      "types": "./dist/search/types.d.ts",
      "import": "./dist/search/types.js"
    },
```

- [ ] **Step 7: Run the tests**

```bash
pnpm --filter @fluxcore/systems build
pnpm test:integration -- integration/search.test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/systems/src/search packages/systems/package.json \
        packages/systems/tests/integration/search.test.ts
git commit -m "$(cat <<'EOF'
feat(search): add the guild search fan-out

Permission filtering happens before the query, so an unpermitted table is
never touched. COUNT(*) OVER() returns the pre-LIMIT total in the same
statement rather than doubling the fan-out.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: The search endpoint

**Files:**
- Create: `apps/dashboard/src/server/features/search/routes.ts`
- Modify: `apps/dashboard/src/server/index.ts`
- Test: `apps/dashboard/tests/server/features/search/search.test.ts`

**Interfaces:**
- Consumes: `searchGuild` (Task 3).
- Produces: `GET /api/guilds/:guildId/search?q=` → `{ groups: SearchGroup[] }`. Consumed by Task 5.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/features/search/search.test.ts`, following the mocking style of `tests/server/features/actions/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token", clientId: "test-client-id",
    dashboardSessionSecret: "session-secret", logLevel: "info",
  },
}));

const MANAGE_GUILD = BigInt(0x20);
const mockSession = {
  userId: "user-1", username: "testuser",
  guilds: [{ id: "guild-1", name: "Test", permissions: MANAGE_GUILD.toString() }],
};

const mockGetSession = vi.fn().mockResolvedValue(mockSession);
vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: (...a: unknown[]) => mockGetSession(...a),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));

const mockIsBotInGuild = vi.fn().mockResolvedValue(true);
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: (...a: unknown[]) => mockIsBotInGuild(...a),
}));

const mockResolveUserPermissions = vi.fn();
const mockHasPermission = vi.fn().mockReturnValue(true);
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: (...a: unknown[]) => mockResolveUserPermissions(...a),
  hasPermission: (...a: unknown[]) => mockHasPermission(...a),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockSearchGuild = vi.fn().mockResolvedValue([]);
vi.mock("@fluxcore/systems/search", () => ({
  searchGuild: (...a: unknown[]) => mockSearchGuild(...a),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerSearchRoutes } from "../../../../src/server/features/search/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerSearchRoutes(app);
  await app.ready();
  return app;
}

function get(app: Awaited<ReturnType<typeof buildApp>>, q: string, auth = true) {
  return app.inject({
    method: "GET",
    url: `/api/guilds/guild-1/search?q=${encodeURIComponent(q)}`,
    cookies: auth ? { session: app.signCookie("valid") } : undefined,
  });
}

describe("GET /api/guilds/:guildId/search", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    mockHasPermission.mockReturnValue(true);
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["*"]), isOwner: false, isGuildAdmin: true,
    });
    mockSearchGuild.mockResolvedValue([]);
    app = await buildApp();
  });

  it("401s without a session", async () => {
    expect((await get(app, "spam", false)).statusCode).toBe(401);
  });

  it("403s when the user is not a guild admin", async () => {
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(), isOwner: false, isGuildAdmin: false,
    });
    expect((await get(app, "spam")).statusCode).toBe(403);
  });

  it("403s when the bot is not in the guild", async () => {
    mockIsBotInGuild.mockResolvedValue(false);
    expect((await get(app, "spam")).statusCode).toBe(403);
  });

  it("returns empty groups for a query under two characters", async () => {
    const res = await get(app, "s");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ groups: [] });
    expect(mockSearchGuild).not.toHaveBeenCalled();
  });

  it("returns empty groups for a missing query", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/guilds/guild-1/search",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ groups: [] });
  });

  it("passes the query through and returns the groups", async () => {
    mockSearchGuild.mockResolvedValue([
      { source: "rules", total: 3, items: [
        { type: "rules", id: "1", title: "spam rule", subtitle: null,
          route: "/guild/$guildId/rules", focus: "1" },
      ]},
    ]);
    const res = await get(app, "spam");
    expect(res.statusCode).toBe(200);
    expect(res.json().groups[0].source).toBe("rules");
    expect(mockSearchGuild).toHaveBeenCalledWith(
      "guild-1", "spam", expect.any(Function),
    );
  });

  it("gives searchGuild a permission predicate backed by the resolved set", async () => {
    mockHasPermission.mockImplementation(
      (_resolved: unknown, key: string) => key === "actions.rules.view",
    );
    await get(app, "spam");
    const can = mockSearchGuild.mock.calls[0][2] as (p: string) => boolean;
    expect(can("actions.rules.view")).toBe(true);
    expect(can("moderation.cases.view")).toBe(false);
  });

  it("truncates an overlong query rather than rejecting it", async () => {
    await get(app, "x".repeat(300));
    expect((mockSearchGuild.mock.calls[0][1] as string)).toHaveLength(100);
  });

  it("trims surrounding whitespace", async () => {
    await get(app, "  spam  ");
    expect(mockSearchGuild.mock.calls[0][1]).toBe("spam");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- features/search
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `apps/dashboard/src/server/features/search/routes.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { withDocs } from "../../shared/openapi-schemas.js";
import { requireAuth, requireGuildAdmin } from "../../shared/middleware.js";
import { hasPermission } from "../../shared/permissions.js";
import { searchGuild } from "@fluxcore/systems/search";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

export function registerSearchRoutes(app: FastifyInstance): void {
  app.get(
    "/api/guilds/:guildId/search",
    {
      schema: withDocs(
        {
          params: {
            type: "object",
            properties: { guildId: { type: "string" } },
            required: ["guildId"],
          },
          querystring: {
            type: "object",
            properties: { q: { type: "string" } },
          },
        },
        { tag: "Search", response: { 200: { type: "object", additionalProperties: true } } },
      ),
      // Deliberately NOT requirePermission: a viewer with access to three of
      // ten modules should get three groups of results, not a 403. Per-source
      // filtering happens below.
      preHandler: [requireAuth, requireGuildAdmin],
      // The global limit is 100/min across every /api route; a debounced
      // palette would eat it. Give the endpoint its own bucket.
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const { q } = request.query as { q?: string };

      const query = (q ?? "").trim().slice(0, MAX_QUERY_LENGTH);
      if (query.length < MIN_QUERY_LENGTH) {
        // Not an error — this is the normal state while typing.
        reply.send({ groups: [] });
        return;
      }

      const resolved = request.resolvedPermissions!;
      const groups = await searchGuild(guildId, query, (permission) =>
        hasPermission(resolved, permission),
      );

      reply.send({ groups });
    },
  );
}
```

- [ ] **Step 4: Register it**

In `apps/dashboard/src/server/index.ts`, import and register alongside the other feature routes:

```ts
import { registerSearchRoutes } from "./features/search/routes.js";
```

```ts
  registerSearchRoutes(app);
```

- [ ] **Step 5: Run the tests**

```bash
pnpm --filter @fluxcore/dashboard test -- features/search
pnpm --filter @fluxcore/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/server/features/search \
        apps/dashboard/src/server/index.ts \
        apps/dashboard/tests/server/features/search/search.test.ts
git commit -m "$(cat <<'EOF'
feat(search): add the guild search endpoint

Guild-admin gated but not permission-gated: partial access returns partial
results rather than a 403. Gets its own rate-limit bucket so a debounced
palette does not consume the global 100/min budget.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire records into the palette

**Files:**
- Create: `apps/dashboard/src/client/shared/command-palette/sources/records.ts`
- Modify: `apps/dashboard/src/client/shared/command-palette/types.ts`
- Modify: `apps/dashboard/src/client/shared/command-palette/CommandPalette.tsx`
- Modify: `apps/dashboard/src/client/routes/__root.tsx`
- Modify: `packages/i18n/src/locales/<48>/common.json`
- Test: `apps/dashboard/tests/client/shared/command-palette/records.test.tsx`

**Interfaces:**
- Consumes: the endpoint (Task 4), the palette (navigation plan Task 7).
- Produces: `useRecordCommands(guildId, query)` returning `{ commands, isLoading, isError }`.

- [ ] **Step 1: Extend the group keys and i18n**

In `types.ts`, widen `CommandGroupKey` and `GROUP_ORDER` with the ten record sources, keeping record groups after the static ones:

```ts
export type CommandGroupKey =
  | "recent" | "pages" | "actions" | "servers"
  | "rules" | "rolePanels" | "ticketPanels" | "tickets" | "scheduled"
  | "commands" | "warnings" | "cases" | "giveaways" | "suggestions";

export const GROUP_ORDER: CommandGroupKey[] = [
  "recent", "pages", "actions", "servers",
  "rules", "rolePanels", "ticketPanels", "tickets", "scheduled",
  "commands", "warnings", "cases", "giveaways", "suggestions",
];
```

Add the matching group labels plus two states to the `palette` block in **all 48 locales**, using the same format-preserving script from the navigation plan's Task 2:

```jsonc
"group": {
  // …existing four…
  "rules": "Automation rules",
  "rolePanels": "Role panels",
  "ticketPanels": "Ticket panels",
  "tickets": "Tickets",
  "scheduled": "Scheduled messages",
  "commands": "Custom commands",
  "warnings": "Warnings",
  "cases": "Moderation cases",
  "giveaways": "Giveaways",
  "suggestions": "Suggestions"
},
"searchError": "Could not search records",
"searching": "Searching…"
```

Run the parity test to confirm all 48 stayed in step:

```bash
pnpm --filter @fluxcore/dashboard test -- i18n-parity
```

- [ ] **Step 2: Write the failing test**

Create `apps/dashboard/tests/client/shared/command-palette/records.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useRecordCommands } from "../../../../src/client/shared/command-palette/sources/records";

const mockApiFetch = vi.fn();
vi.mock("../../../../src/client/shared/lib/client", () => ({
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const groups = [
  {
    source: "warnings", total: 8,
    items: [{
      type: "warnings", id: "142", title: "#142 · spam",
      subtitle: "user-1", route: "/guild/$guildId/warnings", focus: "142",
    }],
  },
];

describe("useRecordCommands", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not query for a short query", () => {
    renderHook(() => useRecordCommands("g1", "s"), { wrapper });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("does not query without a guild", () => {
    renderHook(() => useRecordCommands(undefined, "spam"), { wrapper });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("maps groups into commands carrying route, params, and focus", async () => {
    mockApiFetch.mockResolvedValue({ groups });
    const { result } = renderHook(() => useRecordCommands("g1", "spam"), { wrapper });

    await waitFor(() => expect(result.current.commands).toHaveLength(1));
    expect(result.current.commands[0]).toMatchObject({
      id: "record:warnings:142",
      group: "warnings",
      title: "#142 · spam",
      subtitle: "user-1",
      to: "/guild/$guildId/warnings",
      params: { guildId: "g1" },
      search: { focus: "142" },
    });
  });

  it("reports the error state without throwing", async () => {
    mockApiFetch.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useRecordCommands("g1", "spam"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.commands).toEqual([]);
  });

  it("requests the encoded query", async () => {
    mockApiFetch.mockResolvedValue({ groups: [] });
    renderHook(() => useRecordCommands("g1", "spam & eggs"), { wrapper });
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/guilds/g1/search?q=spam%20%26%20eggs",
    );
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- records
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement the source**

Create `apps/dashboard/src/client/shared/command-palette/sources/records.ts`:

```ts
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "../../lib/client";
import type { Command, CommandGroupKey } from "../types";

const MIN_QUERY_LENGTH = 2;

interface SearchItem {
  type: CommandGroupKey;
  id: string;
  title: string;
  subtitle: string | null;
  route: string;
  focus: string;
}

interface SearchGroup {
  source: CommandGroupKey;
  total: number;
  items: SearchItem[];
}

const ICONS: Partial<Record<CommandGroupKey, string>> = {
  rules: "bolt", rolePanels: "badge", ticketPanels: "confirmation_number",
  tickets: "confirmation_number", scheduled: "schedule", commands: "terminal",
  warnings: "warning", cases: "shield", giveaways: "celebration",
  suggestions: "lightbulb",
};

export function useRecordCommands(guildId: string | undefined, query: string) {
  const enabled = Boolean(guildId) && query.trim().length >= MIN_QUERY_LENGTH;

  const { data, isFetching, isError } = useQuery<{ groups: SearchGroup[] }>({
    queryKey: ["guilds", guildId, "search", query.trim()],
    queryFn: () =>
      apiFetch(`/api/guilds/${guildId}/search?q=${encodeURIComponent(query.trim())}`),
    enabled,
    staleTime: 15_000,
    // Without this the list collapses and re-expands between keystrokes, and
    // the cursor row jumps under the user's finger.
    placeholderData: keepPreviousData,
    retry: false,
  });

  const commands: Command[] = (data?.groups ?? []).flatMap((group) =>
    group.items.map((item) => ({
      id: `record:${item.type}:${item.id}`,
      group: group.source,
      title: item.title,
      subtitle: item.subtitle ?? undefined,
      icon: ICONS[item.type] ?? "search",
      to: item.route,
      params: { guildId: guildId! },
      search: { focus: item.focus },
    })),
  );

  return { commands, isLoading: enabled && isFetching, isError };
}
```

Add `search?: Record<string, string>` to the `Command` interface in `types.ts`.

- [ ] **Step 5: Render the remote state and honour `search` on navigate**

In `CommandPalette.tsx`, accept two new optional props and render them below the list — static groups must never wait on the network:

```tsx
export function CommandPalette({
  commands, onNavigate, isSearching = false, searchFailed = false,
}: {
  commands: Command[];
  onNavigate: (command: Command) => void;
  isSearching?: boolean;
  searchFailed?: boolean;
}) {
```

Replace the empty-state paragraph with:

```tsx
        {flat.length === 0 && !isSearching && (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            {t("palette.empty", { query })}
          </p>
        )}

        {isSearching && (
          <p className="px-4 py-3 text-center text-xs text-text-muted">
            {t("palette.searching")}
          </p>
        )}

        {searchFailed && (
          <p className="px-4 py-3 text-center text-xs text-danger/80">
            {t("palette.searchError")}
          </p>
        )}
```

In `__root.tsx`, extend `AppCommandPalette` to drive the query from a debounced copy of the palette's input. Because the query lives inside `CommandPalette`, lift it: add `onQueryChange?: (q: string) => void` to `CommandPalette` and call it from the input's `onChange`. Then in `AppCommandPalette`:

```tsx
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(id);
  }, [query]);

  const records = useRecordCommands(guildId, debounced);
```

Include `...records.commands` in the `commands` memo, and pass the flags plus `onQueryChange={setQuery}` down. Finally, teach `onNavigate` to carry search params:

```tsx
    if (command.to) {
      navigate({ to: command.to, params: command.params, search: command.search });
    }
```

- [ ] **Step 6: Run the tests**

```bash
pnpm --filter @fluxcore/dashboard test
pnpm --filter @fluxcore/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/client packages/i18n/src/locales \
        apps/dashboard/tests/client/shared/command-palette/records.test.tsx
git commit -m "$(cat <<'EOF'
feat(palette): search live records from the palette

Debounced at 200ms with keepPreviousData, so the list never collapses
between keystrokes and the cursor stays put. Static groups render
immediately regardless of remote latency.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: The focus hook and route search params

**Files:**
- Create: `apps/dashboard/src/client/shared/hooks/useFocusedRecord.ts`
- Modify: `apps/dashboard/src/client/main.tsx`
- Test: `apps/dashboard/tests/client/shared/hooks/useFocusedRecord.test.tsx`

**Interfaces:**
- Produces: `useFocusedRecord(): { focus: string | undefined; isFocused: (id: string | number) => boolean; focusRef: (id: string | number) => ((el: HTMLElement | null) => void) }`. Consumed by Task 7.

- [ ] **Step 1: Add `validateSearch` to the 9 target routes**

In `main.tsx`, add this to `rulesRoute`, `rolesRoute`, `ticketsRoute`, `scheduledRoute`, `commandsRoute`, `warningsRoute`, `moderationRoute`, `giveawaysRoute`, and `suggestionsRoute`:

```ts
  validateSearch: (search: Record<string, unknown>) => ({
    focus: typeof search.focus === "string" ? search.focus : undefined,
  }),
```

For example:

```ts
const warningsRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/warnings",
  component: WarningsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    focus: typeof search.focus === "string" ? search.focus : undefined,
  }),
});
```

- [ ] **Step 2: Write the failing test**

Create `apps/dashboard/tests/client/shared/hooks/useFocusedRecord.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFocusedRecord } from "../../../../src/client/shared/hooks/useFocusedRecord";

const mockNavigate = vi.fn();
let mockSearch: { focus?: string } = {};

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => mockSearch,
}));

describe("useFocusedRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSearch = {};
  });

  it("reports no focus when the param is absent", () => {
    const { result } = renderHook(() => useFocusedRecord());
    expect(result.current.focus).toBeUndefined();
    expect(result.current.isFocused(1)).toBe(false);
  });

  it("matches the focused id as a string or a number", () => {
    mockSearch = { focus: "142" };
    const { result } = renderHook(() => useFocusedRecord());
    expect(result.current.isFocused(142)).toBe(true);
    expect(result.current.isFocused("142")).toBe(true);
    expect(result.current.isFocused(143)).toBe(false);
  });

  it("scrolls the registered element into view", () => {
    mockSearch = { focus: "142" };
    const scrollIntoView = vi.fn();
    const { result } = renderHook(() => useFocusedRecord());

    act(() => {
      result.current.focusRef(142)({ scrollIntoView } as unknown as HTMLElement);
    });

    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "center" }),
    );
  });

  it("ignores elements that are not the focused record", () => {
    mockSearch = { focus: "142" };
    const scrollIntoView = vi.fn();
    const { result } = renderHook(() => useFocusedRecord());

    act(() => {
      result.current.focusRef(999)({ scrollIntoView } as unknown as HTMLElement);
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("clears the param afterwards so a refresh does not re-fire it", () => {
    mockSearch = { focus: "142" };
    renderHook(() => useFocusedRecord());

    act(() => { vi.advanceTimersByTime(2000); });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ replace: true }),
    );
  });

  it("does not navigate when there is nothing to clear", () => {
    renderHook(() => useFocusedRecord());
    act(() => { vi.advanceTimersByTime(2000); });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- useFocusedRecord
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `apps/dashboard/src/client/shared/hooks/useFocusedRecord.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

const HIGHLIGHT_MS = 2000;

/**
 * Reads the ?focus= search param written by the command palette, lets a list
 * mark and scroll to the matching row, then clears the param so a refresh or
 * a back-navigation does not re-trigger the highlight.
 */
export function useFocusedRecord() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { focus?: string };
  const [focus, setFocus] = useState(search.focus);

  useEffect(() => setFocus(search.focus), [search.focus]);

  useEffect(() => {
    if (!search.focus) return;
    const id = setTimeout(() => {
      navigate({ search: (prev) => ({ ...prev, focus: undefined }), replace: true });
    }, HIGHLIGHT_MS);
    return () => clearTimeout(id);
  }, [search.focus, navigate]);

  const isFocused = useCallback(
    (id: string | number) => focus !== undefined && String(id) === focus,
    [focus],
  );

  const focusRef = useCallback(
    (id: string | number) => (el: HTMLElement | null) => {
      if (!el || focus === undefined || String(id) !== focus) return;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    },
    [focus],
  );

  return { focus, isFocused, focusRef };
}
```

- [ ] **Step 5: Run the tests**

```bash
pnpm --filter @fluxcore/dashboard test -- useFocusedRecord
pnpm --filter @fluxcore/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/client/shared/hooks/useFocusedRecord.ts \
        apps/dashboard/src/client/main.tsx \
        apps/dashboard/tests/client/shared/hooks/useFocusedRecord.test.tsx
git commit -m "$(cat <<'EOF'
feat(palette): add ?focus= search params and the focus hook

Clears the param after the highlight so a refresh or back-navigation does
not re-fire it. Honours prefers-reduced-motion when scrolling.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Apply focus on each list page

Nine pages, done one at a time. Each is independently verifiable, so a problem in one module never blocks the others.

**Files:** the nine feature pages under `apps/dashboard/src/client/features/*/`, plus a test per page.

**Interfaces:**
- Consumes: `useFocusedRecord` (Task 6).

> **The pagination problem.** These lists paginate, so a record on page 7 is not mounted and scrolling to it would find nothing. Each page therefore **pre-filters its list query to the focused id**, making the target the only result on page 1. Where a list endpoint has no `id` filter, add one beside its existing filters.

Repeat this cycle for each of: warnings, moderation (cases), rules, roles (panels), tickets, scheduled, commands, giveaways, suggestions.

- [ ] **Step 1: Write the failing test for the page**

Pattern — `apps/dashboard/tests/client/features/warnings/focus.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WarningsPage } from "../../../../src/client/routes/guild/$guildId/warnings";

vi.mock("../../../../src/client/shared/hooks/useFocusedRecord", () => ({
  useFocusedRecord: () => ({
    focus: "142",
    isFocused: (id: string | number) => String(id) === "142",
    focusRef: () => () => {},
  }),
}));

// …mock the page's data hooks to return warnings 141 and 142…

describe("warnings focus", () => {
  it("marks the focused row", () => {
    render(<WarningsPage />);
    expect(screen.getByTestId("warning-142")).toHaveAttribute("data-focused", "true");
  });

  it("leaves other rows unmarked", () => {
    render(<WarningsPage />);
    expect(screen.getByTestId("warning-141")).not.toHaveAttribute("data-focused");
  });

  it("passes the focused id to the list query as a filter", () => {
    // assert the query hook was called with { id: "142" }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- features/warnings
```

- [ ] **Step 3: Wire the page**

```tsx
const { isFocused, focusRef, focus } = useFocusedRecord();
const { data } = useWarnings(guildId, { page, id: focus });
```

and on each row:

```tsx
<tr
  ref={focusRef(warning.id)}
  data-testid={`warning-${warning.id}`}
  data-focused={isFocused(warning.id) || undefined}
  className={cn(isFocused(warning.id) && "ring-1 ring-accent motion-safe:animate-in")}
>
```

If the corresponding list endpoint has no `id` filter, add one — an optional `id` query param that, when present, narrows the `where` clause — with a route test covering it.

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @fluxcore/dashboard test -- features/warnings
```

- [ ] **Step 5: Commit the single page**

```bash
git commit -m "$(cat <<'EOF'
feat(warnings): highlight the record the palette linked to

The list pre-filters to the focused id so the target is on page 1 rather
than buried in a page that was never mounted.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Repeat for the remaining eight pages**

Track each: `- [ ]` moderation · `- [ ]` rules · `- [ ]` roles · `- [ ]` tickets · `- [ ]` scheduled · `- [ ]` commands · `- [ ]` giveaways · `- [ ]` suggestions.

---

## Task 8: "Create X" actions

Now that routes carry search params, the palette can open a page with its create dialog already open.

**Files:**
- Modify: `main.tsx` (extend `validateSearch` with `new`), `sources/actions.ts`, the create-capable pages
- Modify: `packages/i18n/src/locales/<48>/common.json`
- Test: `apps/dashboard/tests/client/shared/command-palette/sources.test.ts`

- [ ] **Step 1: Extend `validateSearch`**

On the create-capable routes, widen the validator:

```ts
  validateSearch: (search: Record<string, unknown>) => ({
    focus: typeof search.focus === "string" ? search.focus : undefined,
    new: search.new === true || search.new === "true" ? true : undefined,
  }),
```

- [ ] **Step 2: Write the failing test**

Add to `sources.test.ts`:

```ts
it("offers a create action per create-capable module the viewer can manage", () => {
  const cmds = actionCommands({
    guildId: "g1", t,
    onRefreshGuild: vi.fn(), onRefreshGuildList: vi.fn(), inviteUrl: null,
    can: () => true,
  });
  const createRule = cmds.find((c) => c.id === "action:create:rules");
  expect(createRule?.to).toBe("/guild/$guildId/rules");
  expect(createRule?.search).toEqual({ new: "true" });
});

it("hides create actions the viewer cannot manage", () => {
  const cmds = actionCommands({
    guildId: "g1", t,
    onRefreshGuild: vi.fn(), onRefreshGuildList: vi.fn(), inviteUrl: null,
    can: (p) => p !== "actions.rules.manage",
  });
  expect(cmds.map((c) => c.id)).not.toContain("action:create:rules");
});
```

- [ ] **Step 3: Extend `actionCommands`**

Add a `can` option and a `CREATE_ACTIONS` table of `{ key, permission, route, i18nKey }`, mapping each to a command with `search: { new: "true" }`. Add the `palette.action.create.*` labels to **all 48 locales**.

- [ ] **Step 4: Open the dialog on arrival**

On each create-capable page:

```tsx
const { new: openNew } = useSearch({ strict: false }) as { new?: boolean };
useEffect(() => {
  if (openNew) setCreateDialogOpen(true);
}, [openNew]);
```

- [ ] **Step 5: Run everything and commit**

```bash
pnpm test && pnpm typecheck
```

```bash
git commit -m "$(cat <<'EOF'
feat(palette): add create actions

Each opens its module page with the create dialog already open, gated on
the same manage permission the page itself enforces.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Done criteria

- [ ] `pnpm test`, `pnpm test:integration`, and `pnpm typecheck` all pass
- [ ] Typing 2+ characters returns records from every module the viewer can see, and none from modules they cannot
- [ ] A guild-isolation test proves guild A never sees guild B's records
- [ ] `#142` finds case 142 directly
- [ ] Selecting a record lands on its page with the row highlighted and scrolled into view
- [ ] The `?focus=` param clears itself after the highlight
- [ ] All 48 locales carry every new key; the parity test enforces it
- [ ] Manual RTL pass in Arabic, including record groups
