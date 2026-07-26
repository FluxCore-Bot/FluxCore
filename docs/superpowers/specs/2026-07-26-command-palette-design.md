# Command Palette — Design

**Date:** 2026-07-26
**Branch:** `worktree-feat+command-palette`
**Status:** Approved, pending implementation plan

## Summary

A dashboard-wide command palette opened with `⌘K` / `Ctrl+K` (alias `⌘P` / `Ctrl+P`). It searches four kinds of thing in one blended, grouped list:

1. **Pages** — the 18 guild routes, filtered by the viewer's dashboard permissions
2. **Servers** — the guilds the viewer can manage
3. **Actions** — verbs like "Create automation rule"
4. **Records** — live rows from Postgres (rules, panels, warnings, cases, tickets, giveaways, suggestions, scheduled messages, custom commands)

Picking a record navigates to its page with `?focus=<id>`, and the page highlights and scrolls to that record.

## Goals

- Reach any page in the dashboard in under two seconds without touching the sidebar
- Find a specific record by name or reason text without knowing which module owns it
- Never surface a page, action, or record the viewer lacks permission to see

## Non-goals

- **Member search.** Resolving Discord members is the heaviest lookup available and was explicitly cut.
- **Starboard entries.** `StarboardEntry` stores only message IDs — no text worth matching.
- **Log entries.** High row-count, low query value; excluded to keep the fan-out small.
- **Fuzzy/typo tolerance.** See "Deferred" below.

---

## 1. Entry points and shell

### Keybinding

| Key | Behaviour |
|-----|-----------|
| `⌘K` / `Ctrl+K` | Open palette (primary) |
| `⌘P` / `Ctrl+P` | Open palette (alias, Discord muscle memory) |
| `Esc` | Close |

Both bindings call `preventDefault()`.

> **Accepted tradeoff:** intercepting `Ctrl+P` overrides browser print on every dashboard page. This was raised with the user and accepted. Reverting is a one-line change in the hotkey handler.

The listener ignores keystrokes originating in `input`, `textarea`, or `contenteditable` targets **only** when the key is unmodified — `⌘K` inside a text field must still open the palette.

### Discoverability

A keyboard-only feature is invisible. A button is added to the top nav in `apps/dashboard/src/client/routes/__root.tsx`, beside `RefreshDataWidget`, showing a search icon and a `⌘K` chip. The chip renders `⌘K` on Apple platforms and `Ctrl K` elsewhere, detected once from `navigator.platform`.

### Availability

The palette mounts at the root layout and is available on every authenticated route.

- On `/` (server list): **Servers** and global actions only.
- Inside `/guild/$guildId/*`: all four source types.

---

## 2. Result UX

### Layout

```
┌──────────────────────────────────────┐
│ 🔎 spam                              │
├──────────────────────────────────────┤
│ PAGES                                │
│  ⚡ Automation                        │
│ AUTOMATION RULES              3 more │
│  ◇ Anti-spam escalation              │
│ WARNINGS                      8 more │
│  ⚠ #142 · spam in #general           │
│ TICKETS                              │
│  🎫 #12 · spam report                 │
├──────────────────────────────────────┤
│ ↑↓ navigate   ⏎ open   esc close     │
└──────────────────────────────────────┘
```

- Groups render in a fixed order: Pages → Actions → Servers → record groups (in sidebar order).
- Each group caps at **5 rows**. If the source has more, the group header shows an "N more" affordance that navigates to the module page.
- Rows show an icon, a title, and a muted subtitle (e.g. the moderator and date on a warning).
- Matched substrings in the title are wrapped in `<mark>` for scanability.

### Keyboard model

Arrow keys move a **virtual** cursor across the flattened result list; real DOM focus never leaves the input. `Home`/`End` jump to first/last. `Enter` activates the cursor row. Wrapping at the ends is enabled.

### States

| State | Display |
|-------|---------|
| Empty query | Recent destinations (last 5, from `localStorage`), else the Pages group unfiltered |
| Query 1 char | Static sources only — remote search requires ≥2 chars |
| Loading remote | Static groups render immediately; a skeleton row sits under each pending record group |
| No results | Empty state with the query echoed back |
| Remote error | Static groups still render; a single inline non-blocking error row replaces the record groups |

The key property: **static results never wait on the network.** Pages and actions appear on the first keystroke regardless of remote latency.

---

## 3. Client architecture

```
apps/dashboard/src/client/shared/command-palette/
  CommandPaletteProvider.tsx   context (open/close state) + global hotkey listener
  CommandPalette.tsx           Dialog shell, input, listbox, keyboard navigation
  CommandGroup.tsx             group header + "N more" affordance
  CommandRow.tsx               single result row
  useCommandSources.ts         assembles all sources into capped, ordered groups
  useRecentCommands.ts         localStorage-backed recents
  sources/pages.ts
  sources/servers.ts
  sources/actions.ts
  sources/records.ts           debounced remote query
  ranking.ts                   pure match + score functions
  types.ts
```

### Shared navigation registry (refactor)

`navItems` currently lives inside `apps/dashboard/src/client/shared/components/Sidebar.tsx`. It is extracted to `apps/dashboard/src/client/shared/lib/navigation.ts` and imported by both `Sidebar` and `sources/pages.ts`, so the two cannot drift as routes are added.

The registry entry gains two optional fields used only by the palette:

```ts
interface NavItem {
  path: string;
  i18nKey: string;
  icon: string;
  permission?: string;
  /** Extra i18n keys folded into palette matching, e.g. "automation" → "rules" */
  keywordsI18nKey?: string;
}
```

`Sidebar` rendering is otherwise unchanged.

### Ranking

`ranking.ts` exports pure functions — no React, no I/O, trivially unit-testable:

```ts
score(query: string, candidate: { title: string; keywords?: string }): number | null
```

Scoring, highest first: exact title match → title prefix → word-boundary prefix in title → substring in title → match in keywords. `null` means no match, and the row is dropped. Ties break on the group's fixed order, then alphabetically.

Remote record rows arrive pre-ranked by Postgres `ts_rank` and keep server order — client scoring applies only to static sources.

### Remote query

```ts
useQuery({
  queryKey: ["guilds", guildId, "search", debouncedQuery],
  enabled: isOpen && debouncedQuery.length >= 2,
  staleTime: 15_000,
  placeholderData: keepPreviousData,
})
```

Debounce is 200 ms. `keepPreviousData` prevents the list collapsing and re-expanding between keystrokes, which otherwise causes the cursor row to jump under the user's finger.

---

## 4. Server API

### Endpoint

```
GET /api/guilds/:guildId/search?q=<string>
```

**Response:**

```jsonc
{
  "groups": [
    {
      "source": "warnings",
      "total": 11,          // total matches, for the "N more" affordance
      "items": [
        {
          "type": "warning",
          "id": "142",
          "title": "#142 · spam in #general",
          "subtitle": "by @mod · 3 days ago",
          "route": "/guild/$guildId/warnings",
          "focus": "142"
        }
      ]
    }
  ]
}
```

### Authorization

```ts
preHandler: [requireAuth, requireGuildAdmin]
```

Deliberately **not** `requirePermission`. A viewer with access to three of nine modules should get three groups of results, not a 403. Per-source filtering happens inside the handler against `request.resolvedPermissions`, using the existing `hasPermission` helper. A source the viewer cannot see is never queried at all — so permissions gate the database round-trip, not just the response body.

### Rate limiting

The app registers a global limit of 100 requests/minute in `apps/dashboard/src/server/index.ts`. A debounced palette shares that bucket with every other dashboard call, so the route declares its own:

```ts
config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
```

### Validation

- `q` is trimmed; length < 2 returns `{ groups: [] }` with 200 (not an error — it is a normal typing state)
- `q` longer than 100 chars is truncated
- Response schema registered via the existing `withDocs` OpenAPI helper

### Query logic placement

Search logic lives in `packages/systems/src/search/`, mirroring how `apps/dashboard/src/server/features/suggestions/routes.ts` delegates to `@fluxcore/systems/suggestions/persistence`:

```
packages/systems/src/search/
  index.ts       searchGuild(guildId, query, allowed) → SearchGroup[]
  sources.ts     one descriptor per module
  tsquery.ts     sanitise + build the tsquery string
  types.ts
```

A source descriptor:

```ts
interface SearchSource {
  key: RecordSourceKey;
  permission: string;        // e.g. "moderation.warnings.view"
  table: string;             // quoted Postgres identifier
  route: string;             // TanStack route path
  select: string;            // columns needed by map()
  map(row): SearchItem;
}
```

`searchGuild` runs the permitted sources with `Promise.all`, each `LIMIT 5`. The `total` needed by the "N more" affordance comes from a `COUNT(*) OVER()` window function in the same statement — not a second round-trip, which would double the fan-out from 10 queries to 20.

---

## 5. Full-text search

### Indexed columns

| Model | Text folded into the vector | Permission | Route |
|-------|------------------------------|------------|-------|
| `ActionRule` | `name` | `actions.rules.view` | `/rules` |
| `RolePanel` | `name` | `roles.panels.view` | `/roles` |
| `TicketPanel` | `name` | `tickets.list.view` | `/tickets` |
| `Ticket` | `categoryName`, `closeReason` | `tickets.list.view` | `/tickets` |
| `ScheduledMessage` | `name` | `scheduled.messages.view` | `/scheduled` |
| `CustomCommand` | `name` | `commands.list.view` | `/commands` |
| `Warning` | `reason` | `moderation.warnings.view` | `/warnings` |
| `ModCase` | `reason` | `moderation.cases.view` | `/moderation` |
| `Giveaway` | `prize` | `giveaways.list.view` | `/giveaways` |
| `Suggestion` | `content` | `suggestions.list.view` | `/suggestions` |

### Migration

Prisma 7 has no representation for a generated `tsvector` column, so this is a hand-written SQL migration (the repo already has several, e.g. `20260407120000_encrypt_dashboard_session_tokens`). Generate with `prisma migrate dev --create-only`, then replace the body:

```sql
ALTER TABLE "ActionRule"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("name", ''))) STORED;

CREATE INDEX "ActionRule_searchVector_idx"
  ON "ActionRule" USING GIN ("searchVector");
```

Multi-field vectors concatenate with a space separator:

```sql
GENERATED ALWAYS AS (
  to_tsvector('simple',
    coalesce("categoryName", '') || ' ' || coalesce("closeReason", ''))
) STORED
```

Because the column is `GENERATED … STORED`, Postgres maintains it on every write — **no application-side sync, no backfill, and no drift**. Existing rows are populated by the `ALTER TABLE` itself.

In `schema.prisma` each model gains:

```prisma
searchVector Unsupported("tsvector")?
```

`Unsupported` types are excluded from the generated client's select and write APIs, so Prisma never attempts to write the generated column.

### Why `simple`, not `english`

Dashboard content spans 48 locales. The `english` configuration applies stemming and stopword removal, which would silently drop words from user-authored names — a rule called "The Purge" would lose "The", and a Turkish or Arabic rule name would be stemmed by English rules that do not apply to it. `simple` lowercases and tokenises without stemming, which is the correct behaviour for mixed-language proper nouns.

### Query construction

User input never reaches `to_tsquery` unescaped — malformed input raises a Postgres syntax error, so tokens are extracted and rebuilt:

```ts
export function toPrefixQuery(raw: string): string | null {
  const tokens = raw.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (tokens.length === 0) return null;
  return tokens.map((t) => `${t}:*`).join(" & ");
}
```

```ts
const rows = await prisma.$queryRaw`
  SELECT "id", "name"
    FROM "ActionRule"
   WHERE "guildId" = ${guildId}
     AND "searchVector" @@ to_tsquery('simple', ${tsq})
   ORDER BY ts_rank("searchVector", to_tsquery('simple', ${tsq})) DESC
   LIMIT 6
`;
```

`guildId` is always in the `WHERE` clause. Cross-guild leakage is covered by an explicit integration test.

### Matching behaviour

FTS matches **word prefixes, not substrings**: `"spa"` finds `"spam"`; `"pam"` does not. This is acceptable for names and reason text, where people type from the start of a word. Documented as a deferred item below.

### Exact-ID lookup

People refer to these records by number ("case 142"). When the query matches `/^#?\d+$/`, each permitted source additionally runs a direct `WHERE id = $n` lookup, and any hit is prepended to its group above the ranked text matches.

---

## 6. Deep-link focus

No route in the dashboard currently declares `validateSearch`, so this is net-new. All routes are defined in one file — `apps/dashboard/src/client/main.tsx` — so the change is localised.

The 10 indexed models map to **9** target routes: `TicketPanel` and `Ticket` both live on `/tickets`. Each of those 9 routes gains:

```ts
validateSearch: (search: Record<string, unknown>) => ({
  focus: typeof search.focus === "string" ? search.focus : undefined,
}),
```

A shared hook drives the behaviour:

```ts
useFocusedRecord(): { focus: string | undefined; register: (id: string) => RefCallback }
```

On mount with a `focus` value it scrolls the registered element into view (`behavior: "smooth"`, or `"auto"` under `prefers-reduced-motion`), applies a highlight ring for ~2s, then clears the param via `navigate({ search: { focus: undefined }, replace: true })` so a refresh does not re-fire it.

### The pagination problem

These lists paginate — a record on page 7 is not mounted, so scrolling to it would find nothing. Each page therefore implements `focus` by **pre-filtering its list query to that record id**, making the target the sole result on page 1. Where a list endpoint has no `id` filter, one is added alongside its existing filters.

This is the single fiddliest part of the feature and is sequenced last, per-page, so a failure in one module does not block the rest.

---

## 7. Internationalisation

A `palette` block is added to `common.json` and **fully translated across all 48 locales in the same change** — English placeholders read as unfinished work.

Keys:

```jsonc
"palette": {
  "open": "Search",              // nav button aria-label
  "placeholder": "Search pages, servers, and records…",
  "hint": { "navigate": "navigate", "open": "open", "close": "close" },
  "group": {
    "pages": "Pages", "actions": "Actions", "servers": "Servers",
    "recent": "Recent",
    "rules": "Automation rules", "rolePanels": "Role panels",
    "ticketPanels": "Ticket panels", "tickets": "Tickets",
    "scheduled": "Scheduled messages", "commands": "Custom commands",
    "warnings": "Warnings", "cases": "Moderation cases",
    "giveaways": "Giveaways", "suggestions": "Suggestions"
  },
  "more": "{{total}} more",
  "empty": "No results for \"{{query}}\"",
  "error": "Could not search records",
  "resultCount": "{{total}} results"
}
```

Two constraints carried from prior i18n work:

- **Never** use an interpolation variable named `count` — i18next treats it as a plural selector and would require correct plural categories (`_few`, `_many`, …) in all 48 locales. `total` is used throughout, matching `GuildSearch`.
- Locale sources are edited in `packages/i18n/src/locales/`; the app serves the built copy. Edits go to source only.

---

## 8. Accessibility

- Input: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant` pointing at the virtual cursor row
- List: `role="listbox"`; rows `role="option"` with `aria-selected`
- Real DOM focus stays in the input — screen readers announce the active option via `aria-activedescendant`
- Radix `Dialog` supplies the focus trap, `Esc` handling, and focus restoration to the trigger
- `aria-live="polite"` region announces the result total (using `total`, never `count`)
- All spacing and iconography use logical properties (`ps-`/`pe-`/`start-`/`end-`) for RTL, matching house style
- Highlight-on-focus animation and smooth scrolling both respect `prefers-reduced-motion`
- Nav trigger button meets the 44px hit-area standard applied in the automation UX audit

Design tokens only — background `#0e0e10`, accent `#a3a6ff`, tonal surfaces, Space Grotesk for group labels, JetBrains Mono for the shortcut chip. Lucide icons at 1.5px stroke, never filled.

---

## 9. Testing

Per `CLAUDE.md`, every feature ships with tests. Three tiers:

### Unit — `apps/dashboard/tests/`

| File | Covers |
|------|--------|
| `shared/command-palette/ranking.test.ts` | Pure scoring: exact > prefix > word-boundary > substring > keyword; non-matches return `null`; tie-breaking |
| `shared/command-palette/useCommandSources.test.ts` | Permission filtering (page/action hidden without permission), group ordering, 5-row cap, `total` passthrough |
| `shared/command-palette/CommandPalette.test.tsx` | Hotkey opens/closes; `Ctrl+P` prevents default; arrow/Home/End cursor movement with wrap; `Enter` navigates; combobox/listbox roles and `aria-activedescendant` wiring; static results render before remote resolves |
| `shared/lib/navigation.test.ts` | Registry and `Sidebar` agree — guards the extraction refactor |

### Route — `apps/dashboard/tests/server/routes/search.test.ts`

- Unauthenticated → 401
- Authenticated non-admin → 403
- Viewer with partial permissions → only permitted groups present, and unpermitted tables are never queried
- `q` shorter than 2 chars → 200 with empty groups
- Happy path → correct shape, `total` and capped `items`
- Per-route rate limit configured

### Integration — `packages/systems/tests/integration/search.test.ts`

Real Postgres, per the existing `setupTestDatabase` / `cleanTestData` / `teardownTestDatabase` pattern:

- Generated column populates on insert and updates on write, with no application-side sync
- GIN index matches a word prefix (`"spa"` → `"spam"`)
- Mid-word substring does **not** match — locks in the documented tradeoff so a future change is deliberate
- `simple` config does not stem: a rule named "The Purge" is findable by "The"
- Exact-ID lookup returns the record and ranks above text matches
- **Guild isolation:** a query in guild A never returns guild B's records
- Malformed input (`"a & | b"`, emoji-only, empty) returns cleanly rather than raising a Postgres syntax error

---

## 10. Implementation order

Sequenced so each phase is independently verifiable and the risky part lands last.

1. **Navigation registry extraction** — move `navItems` out of `Sidebar`, add parity test. No behaviour change.
2. **Palette shell** — provider, hotkey, Dialog, keyboard model, a11y, Pages + Servers + Actions sources, i18n across 48 locales. Fully usable feature on its own.
3. **FTS migration** — tsvector columns, GIN indexes, `schema.prisma` updates, integration tests.
4. **Search endpoint** — `packages/systems/src/search/`, the route, permission filtering, rate limit, route tests.
5. **Records source** — wire remote results into the palette; record groups now populate.
6. **Deep-link focus** — `validateSearch` on 9 routes, `useFocusedRecord`, then per-page `focus` filtering one module at a time.

Phases 1–2 deliver the navigation win the request started from; 3–6 add live-record search.

---

## 11. Deferred

| Item | Why deferred | Upgrade path |
|------|--------------|--------------|
| Substring / typo tolerance | FTS is word-prefix only; adequate for names and reasons | Add a `pg_trgm` GIN index and union trigram similarity into the ranking |
| Member search | Discord member resolution is the heaviest lookup; explicitly cut from scope | New source backed by the member cache once one exists |
| Log entry search | High row count, low query value | Add as a source with a date-bounded query |
| Sigil modes (`>` actions, `@` members) | Blended grouping was chosen instead; adds surface to learn and to translate | Additive — a prefix parser in front of `useCommandSources` |
| Cross-guild record search | Records are guild-scoped by design; would multiply the fan-out by guild count | Requires a different indexing strategy entirely |

## 12. Rejected alternatives

**Fan-out `contains` queries** (recommended during design, not chosen). One endpoint running parallel Prisma `contains` filters — zero migrations, zero write-path coupling, substring matching for free. Rejected in favour of real relevance ranking and index-backed scale.

**Materialised `SearchDocument` index table.** A single table written on every mutation, giving one query and uniform ranking. Rejected because every write path in *both* the bot and the dashboard would need a sync hook, with silent drift whenever one is missed. Generated `tsvector` columns achieve index-backed search with the database maintaining consistency instead.

**cmdk.** The standard React command-palette library. Rejected per existing project precedent — `SearchableSelect` was built on Radix `Popover` rather than adding cmdk, and this palette follows the same approach on Radix `Dialog`.
