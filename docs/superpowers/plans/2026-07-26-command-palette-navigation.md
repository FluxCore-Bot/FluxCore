# Command Palette (Navigation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `⌘K` command palette that navigates to any dashboard page, switches servers, and runs a small set of app-level actions — entirely client-side.

**Architecture:** A React context owns open/close state and a global hotkey listener. A Radix `Dialog` renders an input plus a virtual-focus listbox. Three pure "source" modules turn in-memory data (the nav registry, the cached guild list, a static action list) into `Command` objects; a pure `ranking` module scores them against the query. No new API endpoints and no database work.

**Tech Stack:** React 19, TanStack Router, TanStack Query, Radix Dialog, Tailwind 4, react-i18next, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-26-command-palette-design.md` (phases 1–2). Live-record search, `?focus=` deep-linking, and "Create X" actions are in the companion plan `2026-07-26-command-palette-record-search.md`.

## Global Constraints

- **Never run `pnpm add`/`pnpm install` on the host** — host `node_modules` are root-owned. All installs go through Docker. This plan adds **no new dependencies**, so no install is needed.
- **Strict TypeScript.** No `any` unless unavoidable.
- **Use the shadcn wrappers** in `apps/dashboard/src/client/shared/ui/` (`dialog`, `input`, `button`, `tooltip`, …). Never import Radix directly when a wrapper exists, and never hand-roll a primitive that already exists.
- **Do not add `cmdk`** or any command-palette library. Project precedent: `SearchableSelect` was built on Radix `Popover` rather than adding a dependency.
- **Design tokens only:** background `#0e0e10`, accent `#a3a6ff`, tonal surfaces. Inter (body), Space Grotesk (labels), JetBrains Mono (code/shortcuts). Lucide icons at 1.5px stroke — **never filled**.
- **RTL:** use logical properties (`ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`), never `left`/`right`.
- **i18n:** edit locale sources in `packages/i18n/src/locales/<lang>/`, never the built `dist` copy. Every new key must be translated in **all 48 locales** in the same commit — English placeholders block merge. **Never** name an interpolation variable `count` (i18next reads it as a plural selector and would require `_few`/`_many`/… categories in all 48 locales); use `total`.
- **Client test files** must start with the docblock `// @vitest-environment jsdom`.
- **Test locations:** client tests in `apps/dashboard/tests/client/...`, mirroring `src/client/...`.
- **Accessibility:** WCAG AA. Interactive targets ≥44px. Respect `prefers-reduced-motion`.
- **Commits:** `feat(palette): …` / `refactor(palette): …` / `i18n(palette): …`, one logical change each, ending with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

## Before You Start

**A fresh worktree cannot run `pnpm test` until three environmental steps are done.** Each failure looks like a code bug but is not. Do these first:

```bash
# 1. .env.dev is gitignored, so it did not come with the checkout.
#    Symlink (not copy) so secrets stay in sync and are never duplicated.
ln -s /home/abdulkhalek/Projects/FluxCore/.env.dev .env.dev

# 2. docker-compose bind-mounts ./packages and ./apps over the image's baked
#    node_modules, so the empty worktree dirs shadow them. Install in Docker —
#    never on the host, where node_modules end up root-owned.
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot \
  run --rm --no-deps bot pnpm install --frozen-lockfile

# 3. Compose derives its project name from the directory, so this worktree gets
#    its OWN empty postgres volume. Apply migrations to it.
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot \
  run --rm bot pnpm --filter @fluxcore/database db:deploy
```

`-f docker-compose.no-db-port.yml` goes **last** so its `ports: !reset []` wins — without it, the worktree's postgres collides with the main stack on `127.0.0.1:5432`. The explicit `-f` flags suppress the override file that `docker compose` would otherwise auto-load, which is why `docker-compose.override.yml` is named explicitly (it carries `CI=true`).

Then establish the baseline:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.no-db-port.yml --profile bot \
  run --rm bot pnpm turbo run test
```

**Expected on `d2e4759` (this branch's base): 1104 tests / 138 files, 0 failures, 9/9 turbo tasks.** Anything else is a pre-existing problem — report it before writing code rather than attributing it to your changes.

> **Never judge a test run by a piped exit code.** `pnpm test 2>&1 | tail -60` reports *tail's* status, not the suite's — a piped run has previously reported success when the suite never ran. Read the summary line.

Throughout this plan, `pnpm --filter @fluxcore/dashboard test -- <pattern>` is shorthand; run it through the same Docker invocation.

---

## File Structure

**Created:**

| File | Responsibility |
|------|----------------|
| `apps/dashboard/src/client/shared/lib/navigation.ts` | The single nav registry, shared by `Sidebar` and the palette |
| `apps/dashboard/src/client/shared/command-palette/types.ts` | `Command`, `CommandGroup`, group keys |
| `apps/dashboard/src/client/shared/command-palette/ranking.ts` | Pure normalise / score / segment functions |
| `apps/dashboard/src/client/shared/command-palette/sources/pages.ts` | Nav registry → page commands |
| `apps/dashboard/src/client/shared/command-palette/sources/servers.ts` | Guild list → server commands |
| `apps/dashboard/src/client/shared/command-palette/sources/actions.ts` | Static app-level action commands |
| `apps/dashboard/src/client/shared/command-palette/useCommandPalette.ts` | Context + global hotkey |
| `apps/dashboard/src/client/shared/command-palette/useRecentCommands.ts` | localStorage-backed recents |
| `apps/dashboard/src/client/shared/command-palette/useCommandSources.ts` | Assembles + ranks + caps groups |
| `apps/dashboard/src/client/shared/command-palette/CommandRow.tsx` | One result row |
| `apps/dashboard/src/client/shared/command-palette/CommandGroup.tsx` | Group header + rows |
| `apps/dashboard/src/client/shared/command-palette/CommandPalette.tsx` | Dialog shell, input, listbox, keyboard model |
| `apps/dashboard/src/client/shared/components/CommandPaletteTrigger.tsx` | Top-nav button with the `⌘K` chip |

**Modified:**

| File | Change |
|------|--------|
| `apps/dashboard/src/client/shared/components/Sidebar.tsx` | Import `navItems` from the registry instead of declaring it |
| `apps/dashboard/src/client/features/permissions/hooks/usePermissions.ts` | Skip the query when `guildId` is empty |
| `apps/dashboard/src/client/routes/__root.tsx` | Mount provider + palette, add trigger button |
| `packages/i18n/src/locales/<48 langs>/common.json` | Add the `palette` block |

---

## Task 1: Extract the navigation registry

`navItems` currently lives inside `Sidebar.tsx`. The palette needs the same list; duplicating it guarantees drift as routes are added. This task is a pure refactor — no behaviour change.

**Files:**
- Create: `apps/dashboard/src/client/shared/lib/navigation.ts`
- Modify: `apps/dashboard/src/client/shared/components/Sidebar.tsx:10-37`
- Test: `apps/dashboard/tests/client/shared/lib/navigation.test.ts`

**Interfaces:**
- Produces: `NavItem` interface and `navItems: NavItem[]`, consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/shared/lib/navigation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { navItems } from "../../../../src/client/shared/lib/navigation";

describe("navigation registry", () => {
  it("lists every guild route", () => {
    expect(navItems).toHaveLength(18);
  });

  it("gives every item a guild-scoped path, an i18n key, and an icon", () => {
    for (const item of navItems) {
      expect(item.path).toMatch(/^\/guild\/\$guildId\//);
      expect(item.i18nKey).toMatch(/^nav\./);
      expect(item.icon).toBeTruthy();
    }
  });

  it("uses unique paths", () => {
    const paths = navItems.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("permission-gates every item except the overview", () => {
    const ungated = navItems.filter((i) => !i.permission);
    expect(ungated.map((i) => i.path)).toEqual(["/guild/$guildId/overview"]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- navigation
```

Expected: FAIL — cannot resolve `shared/lib/navigation`.

- [ ] **Step 3: Create the registry**

Create `apps/dashboard/src/client/shared/lib/navigation.ts` by moving the interface and array verbatim out of `Sidebar.tsx`, adding the optional `keywordsI18nKey` field:

```ts
export interface NavItem {
  path: string;
  /** i18n key under the "nav" namespace (e.g. "overview" -> t("nav.overview")) */
  i18nKey: string;
  icon: string;
  permission?: string;
  /**
   * Optional i18n key holding extra search terms for the command palette, so a
   * page can be found by a word that is not in its label — e.g. Automation is
   * findable by "rules". Unused by the sidebar.
   */
  keywordsI18nKey?: string;
}

export const navItems: NavItem[] = [
  { path: "/guild/$guildId/overview", i18nKey: "nav.overview", icon: "dashboard" },
  { path: "/guild/$guildId/rules", i18nKey: "nav.automation", icon: "bolt", permission: "actions.rules.view", keywordsI18nKey: "palette.keywords.automation" },
  { path: "/guild/$guildId/tempvoice", i18nKey: "nav.tempvoice", icon: "settings_voice", permission: "tempvoice.config.view" },
  { path: "/guild/$guildId/welcome", i18nKey: "nav.welcome", icon: "waving_hand", permission: "welcome.config.view" },
  { path: "/guild/$guildId/moderation", i18nKey: "nav.moderation", icon: "shield", permission: "moderation.cases.view", keywordsI18nKey: "palette.keywords.moderation" },
  { path: "/guild/$guildId/warnings", i18nKey: "nav.warnings", icon: "warning", permission: "moderation.warnings.view" },
  { path: "/guild/$guildId/roles", i18nKey: "nav.rolePanels", icon: "badge", permission: "roles.panels.view" },
  { path: "/guild/$guildId/leveling", i18nKey: "nav.leveling", icon: "trending_up", permission: "leveling.leaderboard.view" },
  { path: "/guild/$guildId/scheduled", i18nKey: "nav.scheduled", icon: "schedule", permission: "scheduled.messages.view" },
  { path: "/guild/$guildId/commands", i18nKey: "nav.commands", icon: "terminal", permission: "commands.list.view" },
  { path: "/guild/$guildId/security", i18nKey: "nav.security", icon: "security", permission: "security.config.view" },
  { path: "/guild/$guildId/tickets", i18nKey: "nav.tickets", icon: "confirmation_number", permission: "tickets.list.view" },
  { path: "/guild/$guildId/giveaways", i18nKey: "nav.giveaways", icon: "celebration", permission: "giveaways.list.view" },
  { path: "/guild/$guildId/suggestions", i18nKey: "nav.suggestions", icon: "lightbulb", permission: "suggestions.list.view" },
  { path: "/guild/$guildId/starboard", i18nKey: "nav.starboard", icon: "star", permission: "starboard.entries.view" },
  { path: "/guild/$guildId/logs", i18nKey: "nav.logs", icon: "description", permission: "logging.entries.view" },
  { path: "/guild/$guildId/permissions", i18nKey: "nav.permissions", icon: "admin_panel_settings", permission: "dashboard.roles.view" },
  { path: "/guild/$guildId/settings", i18nKey: "nav.settings", icon: "tune", permission: "dashboard.settings.manage" },
];
```

- [ ] **Step 4: Point the sidebar at the registry**

In `Sidebar.tsx`, delete the local `interface NavItem` block and the `const navItems` array (lines 10–37), and add to the imports:

```ts
import { navItems } from "../lib/navigation";
```

Nothing else in the file changes.

- [ ] **Step 5: Run the tests and the typechecker**

```bash
pnpm --filter @fluxcore/dashboard test
pnpm --filter @fluxcore/dashboard typecheck
```

Expected: PASS. The pre-existing sidebar tests must still pass — this is a refactor.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/client/shared/lib/navigation.ts \
        apps/dashboard/src/client/shared/components/Sidebar.tsx \
        apps/dashboard/tests/client/shared/lib/navigation.test.ts
git commit -m "$(cat <<'EOF'
refactor(nav): extract the nav registry out of Sidebar

The command palette needs the same route list. Duplicating it would drift
the moment a route is added, so both now read one array.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Translate the `palette` i18n block

Every later task references these keys, so they land first. **All 48 locales in this one commit.**

**Files:**
- Modify: `packages/i18n/src/locales/<lang>/common.json` × 48
- Test: `apps/dashboard/tests/client/shared/command-palette/i18n-parity.test.ts`

**Interfaces:**
- Produces: the `palette.*` key set consumed by Tasks 4–8.

- [ ] **Step 1: Write the failing parity test**

Create `apps/dashboard/tests/client/shared/command-palette/i18n-parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LOCALES_DIR = join(__dirname, "../../../../../../packages/i18n/src/locales");

function paletteBlock(lang: string): Record<string, unknown> {
  const raw = readFileSync(join(LOCALES_DIR, lang, "common.json"), "utf8");
  return JSON.parse(raw).palette;
}

function flatten(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

const langs = readdirSync(LOCALES_DIR);
const englishKeys = flatten(paletteBlock("en")).sort();

describe("palette i18n", () => {
  it("covers all 48 locales", () => {
    expect(langs).toHaveLength(48);
  });

  it.each(langs)("%s has the same palette keys as en", (lang) => {
    expect(flatten(paletteBlock(lang)).sort()).toEqual(englishKeys);
  });

  it.each(langs)("%s translates the placeholder rather than copying English", (lang) => {
    if (lang === "en") return;
    const value = (paletteBlock(lang) as { placeholder: string }).placeholder;
    expect(value).toBeTruthy();
    expect(value).not.toBe((paletteBlock("en") as { placeholder: string }).placeholder);
  });

  it.each(langs)("%s never interpolates a variable named count", (lang) => {
    const json = JSON.stringify(paletteBlock(lang));
    expect(json).not.toMatch(/\{\{\s*count\s*\}\}/);
  });
});
```

> The third assertion is deliberately strict: it is the mechanical guard against shipping English placeholders. A locale that genuinely shares the English string (none here do) would need an explicit exemption.

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- i18n-parity
```

Expected: FAIL — `palette` is undefined in every locale.

- [ ] **Step 3: Define the English block**

Add this top-level `"palette"` key to `packages/i18n/src/locales/en/common.json`:

```jsonc
"palette": {
  "open": "Search",
  "placeholder": "Search pages, servers, and actions…",
  "dialogTitle": "Command palette",
  "dialogDescription": "Search for a page, server, or action. Use the arrow keys to move and Enter to open.",
  "hint": {
    "navigate": "navigate",
    "select": "open",
    "close": "close"
  },
  "group": {
    "recent": "Recent",
    "pages": "Pages",
    "actions": "Actions",
    "servers": "Servers"
  },
  "keywords": {
    "automation": "rules automation triggers workflow",
    "moderation": "cases bans kicks mutes punishments"
  },
  "action": {
    "refreshGuild": "Refresh this server's data",
    "refreshGuildList": "Refresh my server list",
    "backToServers": "Back to all servers",
    "addToServer": "Add the bot to a server",
    "logout": "Log out"
  },
  "more": "{{total}} more",
  "empty": "No results for \"{{query}}\"",
  "resultCount": "{{total}} results"
}
```

- [ ] **Step 4: Propagate to the other 47 locales — format-preserving**

**Critical:** `JSON.stringify(parsed, null, 2)` is **not** format-preserving across this locale set — `th` is semi-compact and 17 files contain `\uXXXX` escapes. Round-tripping them would rewrite unrelated lines and bury the real change.

Use this script, which round-trips **only** where that is provably a no-op and otherwise splices text:

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "packages/i18n/src/locales";
const TRANSLATIONS = JSON.parse(readFileSync("/tmp/palette-translations.json", "utf8"));

for (const lang of readdirSync(DIR)) {
  if (lang === "en") continue;
  const file = join(DIR, lang, "common.json");
  const raw = readFileSync(file, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed.palette) { console.log(`skip ${lang} (already present)`); continue; }

  const block = TRANSLATIONS[lang];
  if (!block) throw new Error(`missing translations for ${lang}`);

  parsed.palette = block;
  const roundTripped = JSON.stringify(parsed, null, 2) + "\n";

  // Safe only if re-serialising the ORIGINAL reproduces it byte for byte.
  const original = JSON.parse(raw);
  const control = JSON.stringify(original, null, 2) + "\n";
  if (control === raw) {
    writeFileSync(file, roundTripped);
    console.log(`rewrote ${lang}`);
  } else {
    // Splice: insert before the final closing brace, preserving everything else.
    const idx = raw.lastIndexOf("}");
    const head = raw.slice(0, idx).replace(/\s*$/, "");
    const indented = JSON.stringify(block, null, 2)
      .split("\n").map((l, i) => (i === 0 ? l : "  " + l)).join("\n");
    writeFileSync(file, `${head},\n  "palette": ${indented}\n}\n`);
    console.log(`spliced ${lang}`);
  }
}
'
```

Write real translations for all 47 languages into `/tmp/palette-translations.json` first, keyed by language directory name, each value being the full block from Step 3 translated. Keep `{{keys}}`, `{{query}}`, `{{total}}`, and `{{language}}` placeholders intact and untranslated.

- [ ] **Step 5: Verify the diff touched only the intended lines**

```bash
git diff --stat packages/i18n/src/locales | tail -3
git diff packages/i18n/src/locales | grep -c '^-' 
```

Expected: **zero deletions** (`grep -c '^-'` returns the count of removed lines; only the 3 `---` file headers should appear, so expect `48`, i.e. one per changed file, and no content deletions). If a locale shows removed content lines, the splice path mangled it — revert that file and fix before continuing.

- [ ] **Step 6: Run the parity test**

```bash
pnpm --filter @fluxcore/dashboard test -- i18n-parity
```

Expected: PASS, all 48 locales.

- [ ] **Step 7: Commit**

```bash
git add packages/i18n/src/locales apps/dashboard/tests/client/shared/command-palette/i18n-parity.test.ts
git commit -m "$(cat <<'EOF'
i18n(palette): add the palette namespace in all 48 locales

Includes a parity test that fails if a locale is missing a key, copies the
English placeholder verbatim, or introduces a `count` interpolation (which
i18next would treat as a plural selector).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Ranking primitives

Pure functions, no React, no I/O. Everything downstream depends on these, and they are the easiest thing in the feature to get subtly wrong.

**Files:**
- Create: `apps/dashboard/src/client/shared/command-palette/ranking.ts`
- Test: `apps/dashboard/tests/client/shared/command-palette/ranking.test.ts`

**Interfaces:**
- Produces:
  - `normalize(s: string): string`
  - `score(query: string, c: { title: string; keywords?: string }): number | null`
  - `segment(title: string, query: string): Array<{ text: string; match: boolean }>`
  - Constants `SCORE_EXACT`, `SCORE_TITLE_PREFIX`, `SCORE_WORD_PREFIX`, `SCORE_TITLE_SUBSTRING`, `SCORE_KEYWORD`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/shared/command-palette/ranking.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  normalize, score, segment,
  SCORE_EXACT, SCORE_TITLE_PREFIX, SCORE_WORD_PREFIX,
  SCORE_TITLE_SUBSTRING, SCORE_KEYWORD,
} from "../../../../src/client/shared/command-palette/ranking";

describe("normalize", () => {
  it("lowercases", () => {
    expect(normalize("Moderation")).toBe("moderation");
  });

  it("strips diacritics so accented labels are reachable from a plain keyboard", () => {
    expect(normalize("Modération")).toBe("moderation");
    expect(normalize("Añadir")).toBe("anadir");
  });

  it("round-trips precomposed non-Latin scripts", () => {
    // Both decompose under NFD into marks that are NOT \p{Diacritic}, so the
    // NFC recomposition is what keeps them equal to their input. Without it,
    // segment() stops highlighting these scripts entirely.
    expect(normalize("إشراف")).toBe("إشراف");
    expect(normalize("한글")).toBe("한글");
  });
});

describe("score", () => {
  it("ranks an exact title match highest", () => {
    expect(score("logs", { title: "Logs" })).toBe(SCORE_EXACT);
  });

  it("ranks a title prefix above a word prefix", () => {
    expect(score("mod", { title: "Moderation" })).toBe(SCORE_TITLE_PREFIX);
    expect(score("pan", { title: "Role Panels" })).toBe(SCORE_WORD_PREFIX);
    expect(SCORE_TITLE_PREFIX).toBeGreaterThan(SCORE_WORD_PREFIX);
  });

  it("ranks a mid-word substring below a word prefix", () => {
    expect(score("ard", { title: "Starboard" })).toBe(SCORE_TITLE_SUBSTRING);
    expect(SCORE_WORD_PREFIX).toBeGreaterThan(SCORE_TITLE_SUBSTRING);
  });

  it("falls back to keywords when the title does not match", () => {
    expect(score("rules", { title: "Automation", keywords: "rules triggers" }))
      .toBe(SCORE_KEYWORD);
  });

  it("returns null when nothing matches", () => {
    expect(score("zzzz", { title: "Automation", keywords: "rules" })).toBeNull();
  });

  it("matches accented titles from unaccented input", () => {
    expect(score("moderation", { title: "Modération" })).toBe(SCORE_EXACT);
  });

  it("treats an empty query as matching everything", () => {
    expect(score("", { title: "Anything" })).toBe(0);
    expect(score("   ", { title: "Anything" })).toBe(0);
  });
});

describe("segment", () => {
  it("splits the title around the match", () => {
    expect(segment("Moderation", "mod")).toEqual([
      { text: "Mod", match: true },
      { text: "eration", match: false },
    ]);
  });

  it("preserves the original casing of the matched run", () => {
    expect(segment("Role Panels", "PAN")).toEqual([
      { text: "Role ", match: false },
      { text: "Pan", match: true },
      { text: "els", match: false },
    ]);
  });

  it("returns a single unmatched segment when there is no match", () => {
    expect(segment("Logs", "zzz")).toEqual([{ text: "Logs", match: false }]);
  });

  it("highlights precomposed non-Latin scripts", () => {
    expect(segment("관리", "관리")).toEqual([{ text: "관리", match: true }]);
  });

  it("skips highlighting when stripping accents changed the length", () => {
    // Offsets from the normalized string would no longer map onto the
    // original, so the whole title renders unmatched. score() still matches.
    expect(segment("Modération", "moderation")).toEqual([
      { text: "Modération", match: false },
    ]);
  });

  it("returns a single unmatched segment for an empty query", () => {
    expect(segment("Logs", "")).toEqual([{ text: "Logs", match: false }]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- ranking
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/dashboard/src/client/shared/command-palette/ranking.ts`:

```ts
export const SCORE_EXACT = 100;
export const SCORE_TITLE_PREFIX = 80;
export const SCORE_WORD_PREFIX = 60;
export const SCORE_TITLE_SUBSTRING = 40;
export const SCORE_KEYWORD = 20;

export interface Scorable {
  title: string;
  keywords?: string;
}

export interface Segment {
  text: string;
  match: boolean;
}

/**
 * Casefold and strip diacritics so "moderation" finds "Modération".
 *
 * NFD splits a letter into base + combining marks; removing the marks leaves
 * the base. The trailing NFC recomposition is load-bearing, not cosmetic:
 * NFD also decomposes characters whose marks are NOT `\p{Diacritic}` — every
 * Hangul syllable becomes three jamo, and Arabic إ becomes ALEF + HAMZA_BELOW.
 * Without recomposing, those strings come back longer than they went in, and
 * `segment()`'s length guard would then skip highlighting for all Korean and
 * for common Arabic words (إعدادات, أوامر).
 *
 * Latin accented text and Devanagari with matras still change length, because
 * marks genuinely were removed. Those correctly skip highlighting.
 */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .normalize("NFC")
    .toLowerCase();
}

export function score(query: string, c: Scorable): number | null {
  const q = normalize(query.trim());
  if (!q) return 0;

  const title = normalize(c.title);
  if (title === q) return SCORE_EXACT;
  if (title.startsWith(q)) return SCORE_TITLE_PREFIX;

  // Split on anything that is not a letter or number, so "Role Panels" yields
  // ["role", "panels"] and a query of "pan" is a word prefix rather than a
  // mid-string substring. Avoids \b, which misbehaves on non-Latin scripts.
  const words = title.split(/[^\p{L}\p{N}]+/u);
  if (words.some((w) => w.length > 0 && w.startsWith(q))) return SCORE_WORD_PREFIX;

  if (title.includes(q)) return SCORE_TITLE_SUBSTRING;
  if (c.keywords && normalize(c.keywords).includes(q)) return SCORE_KEYWORD;

  return null;
}

/**
 * Split `title` into matched/unmatched runs for <mark> highlighting. Indices
 * come from the normalized form but slice the ORIGINAL string, so the caller
 * renders the user's real casing and accents back to them.
 *
 * Safe because normalize() removes combining marks, which never begin a
 * grapheme — so index alignment with the source string is preserved for the
 * scripts we highlight. Where alignment cannot hold, the match simply fails
 * and the whole title renders unmatched.
 */
export function segment(title: string, query: string): Segment[] {
  const q = normalize(query.trim());
  if (!q) return [{ text: title, match: false }];

  const start = normalize(title).indexOf(q);
  if (start === -1 || normalize(title).length !== title.length) {
    return [{ text: title, match: false }];
  }

  const end = start + q.length;
  const out: Segment[] = [];
  if (start > 0) out.push({ text: title.slice(0, start), match: false });
  out.push({ text: title.slice(start, end), match: true });
  if (end < title.length) out.push({ text: title.slice(end), match: false });
  return out;
}
```

> The `normalize(title).length !== title.length` guard is what makes the accent case safe: if stripping diacritics changed the length, offsets no longer map onto the original string, so highlighting is skipped rather than rendered wrong. `score()` still matches — only the visual highlight is dropped.

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @fluxcore/dashboard test -- ranking
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/command-palette/ranking.ts \
        apps/dashboard/tests/client/shared/command-palette/ranking.test.ts
git commit -m "$(cat <<'EOF'
feat(palette): add pure ranking primitives

Diacritic-insensitive matching so "moderation" finds "Modération", with
word-prefix ranked above mid-word substring. Highlighting is skipped rather
than mis-offset when normalisation changes string length.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Command types and static sources

**Files:**
- Create: `apps/dashboard/src/client/shared/command-palette/types.ts`
- Create: `apps/dashboard/src/client/shared/command-palette/sources/pages.ts`
- Create: `apps/dashboard/src/client/shared/command-palette/sources/servers.ts`
- Create: `apps/dashboard/src/client/shared/command-palette/sources/actions.ts`
- Modify: `apps/dashboard/src/client/features/permissions/hooks/usePermissions.ts`
- Test: `apps/dashboard/tests/client/shared/command-palette/sources.test.ts`

**Interfaces:**
- Consumes: `navItems` (Task 1), `palette.*` keys (Task 2).
- Produces:
  ```ts
  interface Command {
    id: string; group: CommandGroupKey; title: string; subtitle?: string;
    icon: string; keywords?: string;
    to?: string; params?: Record<string, string>;
    href?: string; onSelect?: () => void;
  }
  ```
  and `pageCommands(...)`, `serverCommands(...)`, `actionCommands(...)`. Consumed by Tasks 5–8.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/shared/command-palette/sources.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { pageCommands } from "../../../../src/client/shared/command-palette/sources/pages";
import { serverCommands } from "../../../../src/client/shared/command-palette/sources/servers";
import { actionCommands } from "../../../../src/client/shared/command-palette/sources/actions";
import type { Guild } from "../../../../src/client/shared/lib/schemas";

const t = ((key: string) => key) as unknown as Parameters<typeof pageCommands>[0]["t"];

describe("pageCommands", () => {
  it("returns nothing outside a guild", () => {
    expect(pageCommands({ guildId: undefined, t, can: () => true })).toEqual([]);
  });

  it("includes every page when all permissions are granted", () => {
    expect(pageCommands({ guildId: "g1", t, can: () => true })).toHaveLength(18);
  });

  it("hides pages the viewer cannot see", () => {
    const cmds = pageCommands({
      guildId: "g1",
      t,
      can: (p) => p === "moderation.cases.view",
    });
    // Overview is ungated, moderation is granted; nothing else.
    expect(cmds.map((c) => c.to)).toEqual([
      "/guild/$guildId/overview",
      "/guild/$guildId/moderation",
    ]);
  });

  it("carries the guild id through as a route param", () => {
    const [overview] = pageCommands({ guildId: "g1", t, can: () => true });
    expect(overview.params).toEqual({ guildId: "g1" });
    expect(overview.group).toBe("pages");
  });

  it("resolves keyword hints through the translator", () => {
    const cmds = pageCommands({ guildId: "g1", t, can: () => true });
    const automation = cmds.find((c) => c.to === "/guild/$guildId/rules");
    expect(automation?.keywords).toBe("palette.keywords.automation");
  });
});

describe("serverCommands", () => {
  const guilds: Guild[] = [
    { id: "g1", name: "Etqan", icon: null, botPresent: true },
    { id: "g2", name: "No Bot", icon: null, botPresent: false },
  ];

  it("offers only servers the bot is actually in", () => {
    const cmds = serverCommands({ guilds });
    expect(cmds).toHaveLength(1);
    expect(cmds[0].title).toBe("Etqan");
  });

  it("routes to the guild overview", () => {
    const [first] = serverCommands({ guilds });
    expect(first.to).toBe("/guild/$guildId/overview");
    expect(first.params).toEqual({ guildId: "g1" });
    expect(first.group).toBe("servers");
  });

  it("tolerates an empty list", () => {
    expect(serverCommands({ guilds: [] })).toEqual([]);
  });
});

describe("actionCommands", () => {
  it("offers guild-scoped actions only inside a guild", () => {
    const outside = actionCommands({
      guildId: undefined, t,
      onRefreshGuild: vi.fn(), onRefreshGuildList: vi.fn(), inviteUrl: null,
    });
    expect(outside.map((c) => c.id)).not.toContain("action:refreshGuild");
    expect(outside.map((c) => c.id)).toContain("action:refreshGuildList");
  });

  it("offers the guild refresh inside a guild", () => {
    const inside = actionCommands({
      guildId: "g1", t,
      onRefreshGuild: vi.fn(), onRefreshGuildList: vi.fn(), inviteUrl: null,
    });
    expect(inside.map((c) => c.id)).toContain("action:refreshGuild");
    expect(inside.map((c) => c.id)).toContain("action:backToServers");
  });

  it("runs the supplied callback on select", () => {
    const onRefreshGuild = vi.fn();
    const cmds = actionCommands({
      guildId: "g1", t,
      onRefreshGuild, onRefreshGuildList: vi.fn(), inviteUrl: null,
    });
    cmds.find((c) => c.id === "action:refreshGuild")?.onSelect?.();
    expect(onRefreshGuild).toHaveBeenCalledOnce();
  });

  it("omits the invite action when there is no invite url", () => {
    const cmds = actionCommands({
      guildId: "g1", t,
      onRefreshGuild: vi.fn(), onRefreshGuildList: vi.fn(), inviteUrl: null,
    });
    expect(cmds.map((c) => c.id)).not.toContain("action:addToServer");
  });

  it("includes the invite action as an external link when a url exists", () => {
    const cmds = actionCommands({
      guildId: "g1", t,
      onRefreshGuild: vi.fn(), onRefreshGuildList: vi.fn(),
      inviteUrl: "https://discord.com/invite",
    });
    const invite = cmds.find((c) => c.id === "action:addToServer");
    expect(invite?.href).toBe("https://discord.com/invite");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- sources
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Define the types**

Create `apps/dashboard/src/client/shared/command-palette/types.ts`:

```ts
export type CommandGroupKey = "recent" | "pages" | "actions" | "servers";

/** Fixed render order. Groups not listed here never render. */
export const GROUP_ORDER: CommandGroupKey[] = ["recent", "pages", "actions", "servers"];

export interface Command {
  /** Stable, unique, and safe to persist in localStorage. */
  id: string;
  group: CommandGroupKey;
  title: string;
  subtitle?: string;
  /** Icon name understood by shared/components/Icon.tsx */
  icon: string;
  /** Extra text folded into matching but never displayed. */
  keywords?: string;
  /** In-app navigation target (TanStack route path). */
  to?: string;
  params?: Record<string, string>;
  /** External link. Mutually exclusive with `to`. */
  href?: string;
  /** Imperative action. Mutually exclusive with `to` and `href`. */
  onSelect?: () => void;
}

export interface CommandGroup {
  key: CommandGroupKey;
  commands: Command[];
  /** Total available before capping — drives the "N more" affordance. */
  total: number;
}

/**
 * Rows rendered per group, before the "N more" affordance takes over.
 *
 * Pages and actions are deliberately uncapped: both are small, bounded,
 * already permission-filtered sets, and capping them would mean opening the
 * palette on an empty query showed only 5 of the 18 pages — breaking the
 * primary navigation use case. Servers and (later) record groups are unbounded
 * and do get capped.
 */
export const DEFAULT_GROUP_CAP = 5;

export const GROUP_CAPS: Partial<Record<CommandGroupKey, number>> = {
  pages: Number.POSITIVE_INFINITY,
  actions: Number.POSITIVE_INFINITY,
};

export function capFor(key: CommandGroupKey): number {
  return GROUP_CAPS[key] ?? DEFAULT_GROUP_CAP;
}
```

- [ ] **Step 4: Implement the three sources**

`sources/pages.ts`:

```ts
import type { TFunction } from "i18next";
import { navItems } from "../../lib/navigation";
import type { Command } from "../types";

export function pageCommands(opts: {
  guildId: string | undefined;
  t: TFunction;
  can: (permission: string) => boolean;
}): Command[] {
  const { guildId, t, can } = opts;
  if (!guildId) return [];

  return navItems
    .filter((item) => !item.permission || can(item.permission))
    .map((item) => ({
      id: `page:${item.path}`,
      group: "pages" as const,
      title: t(item.i18nKey),
      icon: item.icon,
      keywords: item.keywordsI18nKey ? t(item.keywordsI18nKey) : undefined,
      to: item.path,
      params: { guildId },
    }));
}
```

`sources/servers.ts`:

```ts
import type { Guild } from "../../lib/schemas";
import type { Command } from "../types";

export function serverCommands(opts: { guilds: Guild[] }): Command[] {
  const { guilds } = opts;

  // Bot-less guilds are deliberately excluded: every dashboard page for such a
  // guild 403s (requireGuildAdmin checks isBotInGuild first), so offering them
  // here would be offering a dead end. They remain visible on the server list,
  // where the invite affordance lives.
  return guilds
    .filter((g) => g.botPresent)
    .map((g) => ({
      id: `server:${g.id}`,
      group: "servers" as const,
      title: g.name,
      icon: "dns",
      to: "/guild/$guildId/overview",
      params: { guildId: g.id },
    }));
}
```

`sources/actions.ts`:

```ts
import type { TFunction } from "i18next";
import type { Command } from "../types";

export function actionCommands(opts: {
  guildId: string | undefined;
  t: TFunction;
  onRefreshGuild: () => void;
  onRefreshGuildList: () => void;
  inviteUrl: string | null;
}): Command[] {
  const { guildId, t, onRefreshGuild, onRefreshGuildList, inviteUrl } = opts;
  const cmds: Command[] = [];

  if (guildId) {
    cmds.push({
      id: "action:refreshGuild",
      group: "actions",
      title: t("palette.action.refreshGuild"),
      icon: "sync",
      onSelect: onRefreshGuild,
    });
    cmds.push({
      id: "action:backToServers",
      group: "actions",
      title: t("palette.action.backToServers"),
      icon: "arrow_back",
      to: "/",
    });
  }

  cmds.push({
    id: "action:refreshGuildList",
    group: "actions",
    title: t("palette.action.refreshGuildList"),
    icon: "sync",
    onSelect: onRefreshGuildList,
  });

  if (inviteUrl) {
    cmds.push({
      id: "action:addToServer",
      group: "actions",
      title: t("palette.action.addToServer"),
      icon: "add_circle",
      href: inviteUrl,
    });
  }

  cmds.push({
    id: "action:logout",
    group: "actions",
    title: t("palette.action.logout"),
    icon: "logout",
    href: "/auth/logout",
  });

  return cmds;
}
```

- [ ] **Step 5: Make `usePermissions` safe to call without a guild**

The palette calls `usePermissions` unconditionally (hooks cannot be conditional), but on `/` there is no guild id. Without a guard that fires a request to `/api/guilds//my-permissions`.

In `apps/dashboard/src/client/features/permissions/hooks/usePermissions.ts`, add `enabled` to the query:

```ts
  const { data, isLoading } = useQuery<MyPermissions>({
    queryKey: ["guilds", guildId, "my-permissions"],
    queryFn: async () => {
      const raw = await apiFetch<unknown>(`/api/guilds/${guildId}/my-permissions`);
      return MyPermissionsSchema.parse(raw);
    },
    staleTime: 60_000,
    enabled: Boolean(guildId),
  });
```

`can()` already returns `false` when `data` is undefined, so an unfetched state fails closed.

- [ ] **Step 6: Run the tests and typecheck**

```bash
pnpm --filter @fluxcore/dashboard test -- sources
pnpm --filter @fluxcore/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/client/shared/command-palette/ \
        apps/dashboard/src/client/features/permissions/hooks/usePermissions.ts \
        apps/dashboard/tests/client/shared/command-palette/sources.test.ts
git commit -m "$(cat <<'EOF'
feat(palette): add command types and the three static sources

Pages are permission-filtered, servers exclude bot-less guilds (every page
there 403s), and actions cover only what needs no new route plumbing.

usePermissions now skips its query without a guild id, so the palette can
call it unconditionally from the server-list route.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Palette context and global hotkey

**Files:**
- Create: `apps/dashboard/src/client/shared/command-palette/useCommandPalette.ts`
- Test: `apps/dashboard/tests/client/shared/command-palette/useCommandPalette.test.tsx`

**Interfaces:**
- Produces: `CommandPaletteContext`, `CommandPaletteProvider`, `useCommandPalette(): { isOpen, open, close, toggle }`. Consumed by Tasks 6 and 8.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/shared/command-palette/useCommandPalette.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CommandPaletteProvider,
  useCommandPalette,
} from "../../../../src/client/shared/command-palette/useCommandPalette";

function Probe() {
  const { isOpen, open, close } = useCommandPalette();
  return (
    <div>
      <span data-testid="state">{isOpen ? "open" : "closed"}</span>
      <button onClick={open}>open</button>
      <button onClick={close}>close</button>
      <input aria-label="text field" />
    </div>
  );
}

function renderProbe() {
  return render(
    <CommandPaletteProvider>
      <Probe />
    </CommandPaletteProvider>,
  );
}

describe("useCommandPalette", () => {
  it("starts closed", () => {
    renderProbe();
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("opens on Ctrl+K", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });

  it("opens on Meta+K", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });

  it("opens on Ctrl+P", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.keyboard("{Control>}p{/Control}");
    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });

  it("toggles closed when the hotkey fires again", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("prevents the browser default so Ctrl+P does not open print", () => {
    renderProbe();
    const event = new KeyboardEvent("keydown", {
      key: "p", ctrlKey: true, bubbles: true, cancelable: true,
    });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
  });

  it("still opens while a text field has focus", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByLabelText("text field"));
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });

  it("does not hijack an unmodified keypress in a text field", async () => {
    const user = userEvent.setup();
    renderProbe();
    const field = screen.getByLabelText("text field");
    await user.click(field);
    await user.keyboard("k");
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
    expect(field).toHaveValue("k");
  });

  it("throws a useful error when used outside the provider", () => {
    function Orphan() {
      useCommandPalette();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(/CommandPaletteProvider/);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- useCommandPalette
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/dashboard/src/client/shared/command-palette/useCommandPalette.ts`:

```ts
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";

interface CommandPaletteValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteValue | null>(null);

export function useCommandPalette(): CommandPaletteValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used inside a CommandPaletteProvider");
  }
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key !== "k" && key !== "p") return;
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.altKey || e.shiftKey) return;

      // Deliberate: this overrides browser print on Ctrl+P / ⌘P across the
      // dashboard. Accepted during design as the cost of Discord-style muscle
      // memory. Removing the "p" branch above restores print.
      e.preventDefault();
      toggle();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
}
```

> Because the handler requires a modifier, there is no need to skip events originating in inputs — an unmodified `k` never reaches `toggle()`. That is what the last two tests pin down.

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @fluxcore/dashboard test -- useCommandPalette
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/command-palette/useCommandPalette.ts \
        apps/dashboard/tests/client/shared/command-palette/useCommandPalette.test.tsx
git commit -m "$(cat <<'EOF'
feat(palette): add the palette context and global hotkey

Ctrl/Cmd + K, with Ctrl/Cmd + P as a Discord-style alias. Requiring a
modifier means typing in a text field is never hijacked.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Group assembly

**Files:**
- Create: `apps/dashboard/src/client/shared/command-palette/useCommandSources.ts`
- Test: `apps/dashboard/tests/client/shared/command-palette/useCommandSources.test.ts`

**Interfaces:**
- Consumes: `Command`, `CommandGroup`, `GROUP_ORDER`, `GROUP_CAP` (Task 4); `score` (Task 3).
- Produces: `buildGroups(commands: Command[], query: string): CommandGroup[]` and `flatten(groups: CommandGroup[]): Command[]`. Consumed by Task 7.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/shared/command-palette/useCommandSources.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildGroups, flatten } from "../../../../src/client/shared/command-palette/useCommandSources";
import type { Command } from "../../../../src/client/shared/command-palette/types";

function cmd(over: Partial<Command> & { id: string }): Command {
  return { group: "pages", title: over.id, icon: "dashboard", ...over } as Command;
}

describe("buildGroups", () => {
  it("orders groups pages → actions → servers", () => {
    const groups = buildGroups(
      [
        cmd({ id: "s", group: "servers", title: "Server" }),
        cmd({ id: "a", group: "actions", title: "Action" }),
        cmd({ id: "p", group: "pages", title: "Page" }),
      ],
      "",
    );
    expect(groups.map((g) => g.key)).toEqual(["pages", "actions", "servers"]);
  });

  it("omits groups with no matches", () => {
    const groups = buildGroups([cmd({ id: "p", title: "Logs" })], "logs");
    expect(groups.map((g) => g.key)).toEqual(["pages"]);
  });

  it("caps an unbounded group at five rows but reports the true total", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      cmd({ id: `s${i}`, group: "servers", title: `Server ${i}` }),
    );
    const [servers] = buildGroups(many, "server");
    expect(servers.commands).toHaveLength(5);
    expect(servers.total).toBe(9);
  });

  it("does not cap pages — all 18 must be reachable on an empty query", () => {
    const many = Array.from({ length: 18 }, (_, i) =>
      cmd({ id: `p${i}`, title: `Page ${i}` }),
    );
    const [pages] = buildGroups(many, "");
    expect(pages.commands).toHaveLength(18);
    expect(pages.total).toBe(18);
  });

  it("does not cap actions", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      cmd({ id: `a${i}`, group: "actions", title: `Action ${i}` }),
    );
    const [actions] = buildGroups(many, "");
    expect(actions.commands).toHaveLength(8);
  });

  it("sorts by score, then alphabetically within a score", () => {
    const groups = buildGroups(
      [
        cmd({ id: "1", title: "Starboard" }),   // substring
        cmd({ id: "2", title: "Star Panels" }), // title prefix
        cmd({ id: "3", title: "Star" }),        // exact
      ],
      "star",
    );
    expect(groups[0].commands.map((c) => c.title)).toEqual([
      "Star", "Star Panels", "Starboard",
    ]);
  });

  it("drops non-matching commands entirely", () => {
    const groups = buildGroups(
      [cmd({ id: "1", title: "Logs" }), cmd({ id: "2", title: "Tickets" })],
      "logs",
    );
    expect(groups[0].commands.map((c) => c.title)).toEqual(["Logs"]);
  });

  it("returns everything for an empty query", () => {
    const groups = buildGroups(
      [cmd({ id: "1", title: "Logs" }), cmd({ id: "2", title: "Tickets" })],
      "",
    );
    expect(groups[0].total).toBe(2);
  });

  it("returns no groups when nothing matches", () => {
    expect(buildGroups([cmd({ id: "1", title: "Logs" })], "zzz")).toEqual([]);
  });
});

describe("flatten", () => {
  it("produces one ordered list for cursor navigation", () => {
    const groups = buildGroups(
      [
        cmd({ id: "s", group: "servers", title: "Server" }),
        cmd({ id: "p", group: "pages", title: "Page" }),
      ],
      "",
    );
    expect(flatten(groups).map((c) => c.id)).toEqual(["p", "s"]);
  });

  it("is empty for no groups", () => {
    expect(flatten([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- useCommandSources
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/dashboard/src/client/shared/command-palette/useCommandSources.ts`:

```ts
import { score } from "./ranking";
import {
  capFor, GROUP_ORDER,
  type Command, type CommandGroup, type CommandGroupKey,
} from "./types";

export function buildGroups(commands: Command[], query: string): CommandGroup[] {
  const scored = new Map<CommandGroupKey, Array<{ cmd: Command; s: number }>>();

  for (const cmd of commands) {
    const s = score(query, { title: cmd.title, keywords: cmd.keywords });
    if (s === null) continue;
    const bucket = scored.get(cmd.group) ?? [];
    bucket.push({ cmd, s });
    scored.set(cmd.group, bucket);
  }

  const groups: CommandGroup[] = [];
  for (const key of GROUP_ORDER) {
    const bucket = scored.get(key);
    if (!bucket || bucket.length === 0) continue;

    bucket.sort((a, b) =>
      b.s - a.s || a.cmd.title.localeCompare(b.cmd.title),
    );

    groups.push({
      key,
      total: bucket.length,
      commands: bucket.slice(0, capFor(key)).map((e) => e.cmd),
    });
  }

  return groups;
}

/** Flatten in render order so arrow keys walk the list the eye sees. */
export function flatten(groups: CommandGroup[]): Command[] {
  return groups.flatMap((g) => g.commands);
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @fluxcore/dashboard test -- useCommandSources
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/command-palette/useCommandSources.ts \
        apps/dashboard/tests/client/shared/command-palette/useCommandSources.test.ts
git commit -m "$(cat <<'EOF'
feat(palette): assemble, rank, and cap result groups

Groups render in a fixed order and cap at five rows while reporting the
true total, so the "N more" affordance can be honest.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: The palette dialog

The visible feature: Radix `Dialog`, a search input, a virtual-focus listbox, and full keyboard navigation.

**Files:**
- Create: `apps/dashboard/src/client/shared/command-palette/CommandRow.tsx`
- Create: `apps/dashboard/src/client/shared/command-palette/CommandGroup.tsx`
- Create: `apps/dashboard/src/client/shared/command-palette/CommandPalette.tsx`
- Test: `apps/dashboard/tests/client/shared/command-palette/CommandPalette.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 3–6.
- Produces: `<CommandPalette commands={Command[]} onNavigate={(c: Command) => void} />`. Consumed by Task 8.

> `CommandPalette` receives its commands as a prop rather than calling the source hooks itself. That keeps it a pure presentational component that tests can drive with fixtures, and confines data wiring to Task 8.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/shared/command-palette/CommandPalette.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "../../../../src/client/shared/command-palette/CommandPalette";
import {
  CommandPaletteProvider,
} from "../../../../src/client/shared/command-palette/useCommandPalette";
import type { Command } from "../../../../src/client/shared/command-palette/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}:${Object.values(o).join(",")}` : k,
  }),
}));

vi.mock("../../../../src/client/shared/components/Icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

const commands: Command[] = [
  { id: "p1", group: "pages", title: "Overview", icon: "dashboard", to: "/a" },
  { id: "p2", group: "pages", title: "Moderation", icon: "shield", to: "/b" },
  { id: "a1", group: "actions", title: "Log out", icon: "logout", href: "/auth/logout" },
  { id: "s1", group: "servers", title: "Etqan", icon: "dns", to: "/c" },
];

function setup(onNavigate = vi.fn()) {
  const user = userEvent.setup();
  render(
    <CommandPaletteProvider>
      <CommandPalette commands={commands} onNavigate={onNavigate} />
    </CommandPaletteProvider>,
  );
  return { user, onNavigate };
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{Control>}k{/Control}");
}

describe("CommandPalette", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing until opened", () => {
    setup();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("exposes a combobox wired to a listbox", async () => {
    const { user } = setup();
    await open(user);
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
  });

  it("keeps DOM focus in the input and tracks the cursor with aria-activedescendant", async () => {
    const { user } = setup();
    await open(user);
    const input = screen.getByRole("combobox");
    expect(input).toHaveFocus();

    const options = screen.getAllByRole("option");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("wraps the cursor at both ends", async () => {
    const { user } = setup();
    await open(user);
    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");

    await user.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", options[options.length - 1].id);

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
  });

  it("jumps to first and last with Home and End", async () => {
    const { user } = setup();
    await open(user);
    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");

    await user.keyboard("{End}");
    expect(input).toHaveAttribute("aria-activedescendant", options[options.length - 1].id);

    await user.keyboard("{Home}");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
  });

  it("groups results under translated headers in a fixed order", async () => {
    const { user } = setup();
    await open(user);
    const headers = screen.getAllByRole("presentation").map((el) => el.textContent);
    expect(headers).toEqual([
      "palette.group.pages",
      "palette.group.actions",
      "palette.group.servers",
    ]);
  });

  it("announces how many rows a capped group is hiding", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`, group: "servers" as const, title: `Server ${i}`,
      icon: "dns", to: "/x",
    }));
    render(
      <CommandPaletteProvider>
        <CommandPalette commands={many} onNavigate={vi.fn()} />
      </CommandPaletteProvider>,
    );
    await open(user);
    // 8 matches, capped at 5 → 3 hidden.
    expect(screen.getByText("palette.more:3")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(5);
  });

  it("shows no overflow hint when nothing is hidden", async () => {
    const { user } = setup();
    await open(user);
    expect(screen.queryByText(/^palette\.more/)).not.toBeInTheDocument();
  });

  it("filters as the user types", async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByRole("combobox"), "mod");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Moderation");
  });

  it("highlights the matched run", async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByRole("combobox"), "mod");
    const mark = within(screen.getByRole("option")).getByText("Mod");
    expect(mark.tagName).toBe("MARK");
  });

  it("resets the cursor to the top when the query changes", async () => {
    const { user } = setup();
    await open(user);
    const input = screen.getByRole("combobox");
    await user.keyboard("{ArrowDown}");
    await user.type(input, "e");
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0].id);
  });

  it("activates the cursor row on Enter", async () => {
    const { user, onNavigate } = setup();
    await open(user);
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p2" }),
    );
  });

  it("activates a row on click", async () => {
    const { user, onNavigate } = setup();
    await open(user);
    await user.click(screen.getByText("Etqan"));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
  });

  it("closes after a selection", async () => {
    const { user } = setup();
    await open(user);
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const { user } = setup();
    await open(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("clears the query between openings", async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByRole("combobox"), "mod");
    await user.keyboard("{Escape}");
    await open(user);
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("shows an empty state naming the query", async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByRole("combobox"), "zzzz");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByText("palette.empty:zzzz")).toBeInTheDocument();
  });

  it("announces the result count politely", async () => {
    const { user } = setup();
    await open(user);
    const live = screen.getByRole("status");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveTextContent("palette.resultCount:4");
  });

  it("does not activate anything on Enter with no results", async () => {
    const { user, onNavigate } = setup();
    await open(user);
    await user.type(screen.getByRole("combobox"), "zzzz");
    await user.keyboard("{Enter}");
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- CommandPalette
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `CommandRow.tsx`**

```tsx
import { Icon } from "../components/Icon";
import { segment } from "./ranking";
import type { Command } from "./types";
import { cn } from "../lib/utils";

export function CommandRow({
  command, query, id, active, onActivate, onHover,
}: {
  command: Command;
  query: string;
  id: string;
  active: boolean;
  onActivate: () => void;
  onHover: () => void;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onClick={onActivate}
      onMouseMove={onHover}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
        active ? "bg-surface-high text-text" : "text-text-muted",
      )}
    >
      <Icon name={command.icon} size={18} />
      <span className="min-w-0 flex-1 truncate">
        {segment(command.title, query).map((seg, i) =>
          seg.match ? (
            <mark key={i} className="bg-transparent font-semibold text-accent">
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </span>
      {command.subtitle && (
        <span className="shrink-0 truncate text-xs text-text-muted">
          {command.subtitle}
        </span>
      )}
    </li>
  );
}
```

- [ ] **Step 4: Implement `CommandGroup.tsx`**

```tsx
import { useTranslation } from "react-i18next";
import { CommandRow } from "./CommandRow";
import type { Command, CommandGroup as Group } from "./types";

export function CommandGroup({
  group, query, activeId, optionId, onActivate, onHover,
}: {
  group: Group;
  query: string;
  activeId: string | null;
  optionId: (command: Command) => string;
  onActivate: (command: Command) => void;
  onHover: (command: Command) => void;
}) {
  const { t } = useTranslation();

  const hidden = group.total - group.commands.length;

  return (
    <>
      {/*
        role="presentation" keeps the header out of the option count that
        screen readers announce for the listbox, while leaving it visible.
      */}
      <li
        role="presentation"
        className="flex items-baseline justify-between px-3 pb-1 pt-3"
      >
        <span className="section-label text-text-muted">
          {t(`palette.group.${group.key}`)}
        </span>
        {hidden > 0 && (
          <span className="text-[0.625rem] text-text-muted">
            {t("palette.more", { total: hidden })}
          </span>
        )}
      </li>
      {group.commands.map((command) => (
        <CommandRow
          key={command.id}
          id={optionId(command)}
          command={command}
          query={query}
          active={optionId(command) === activeId}
          onActivate={() => onActivate(command)}
          onHover={() => onHover(command)}
        />
      ))}
    </>
  );
}
```

- [ ] **Step 5: Implement `CommandPalette.tsx`**

```tsx
import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/dialog";
import { Icon } from "../components/Icon";
import { CommandGroup } from "./CommandGroup";
import { useCommandPalette } from "./useCommandPalette";
import { buildGroups, flatten } from "./useCommandSources";
import type { Command } from "./types";

export function CommandPalette({
  commands, onNavigate,
}: {
  commands: Command[];
  onNavigate: (command: Command) => void;
}) {
  const { t } = useTranslation();
  const { isOpen, close } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const baseId = useId();

  const groups = useMemo(() => buildGroups(commands, query), [commands, query]);
  const flat = useMemo(() => flatten(groups), [groups]);

  const optionId = (command: Command) => `${baseId}-opt-${command.id}`;
  const activeId = flat[cursor] ? optionId(flat[cursor]) : null;

  // A fresh query means a fresh list; leaving the cursor where it was would
  // point at an unrelated row.
  useEffect(() => setCursor(0), [query]);

  // Reset between openings so the palette never reopens mid-search.
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setCursor(0);
    }
  }, [isOpen]);

  function activate(command: Command) {
    onNavigate(command);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (flat.length === 0) {
      if (e.key === "Enter") e.preventDefault();
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setCursor((c) => (c + 1) % flat.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setCursor((c) => (c - 1 + flat.length) % flat.length);
        break;
      case "Home":
        e.preventDefault();
        setCursor(0);
        break;
      case "End":
        e.preventDefault();
        setCursor(flat.length - 1);
        break;
      case "Enter":
        e.preventDefault();
        activate(flat[cursor]);
        break;
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="top-[15%] max-w-xl translate-y-0 gap-0 p-0">
        {/* Named for assistive tech; the visible affordance is the input. */}
        <DialogTitle className="sr-only">{t("palette.dialogTitle")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("palette.dialogDescription")}
        </DialogDescription>

        <div className="flex items-center gap-3 border-b border-border/50 px-4">
          <Icon name="search" size={18} className="shrink-0 text-text-muted" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={`${baseId}-listbox`}
            aria-activedescendant={activeId ?? undefined}
            aria-label={t("palette.placeholder")}
            placeholder={t("palette.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="h-12 w-full bg-transparent text-sm text-text placeholder:text-outline focus:outline-none"
          />
        </div>

        <ul
          id={`${baseId}-listbox`}
          role="listbox"
          aria-label={t("palette.dialogTitle")}
          className="max-h-80 overflow-y-auto p-2 scrollbar-thin"
        >
          {groups.map((group) => (
            <CommandGroup
              key={group.key}
              group={group}
              query={query}
              activeId={activeId}
              optionId={optionId}
              onActivate={activate}
              onHover={(command) =>
                setCursor(flat.findIndex((c) => c.id === command.id))
              }
            />
          ))}
        </ul>

        {flat.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            {t("palette.empty", { query })}
          </p>
        )}

        {/*
          `total`, never `count` — i18next treats a `count` variable as a plural
          selector, which would demand plural categories in all 48 locales.
        */}
        <p aria-live="polite" role="status" className="sr-only">
          {t("palette.resultCount", { total: flat.length })}
        </p>

        <div className="flex items-center gap-4 border-t border-border/50 px-4 py-2 text-[0.625rem] text-text-muted">
          <span><kbd className="font-mono">↑↓</kbd> {t("palette.hint.navigate")}</span>
          <span><kbd className="font-mono">⏎</kbd> {t("palette.hint.select")}</span>
          <span><kbd className="font-mono">esc</kbd> {t("palette.hint.close")}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Run the tests and typecheck**

```bash
pnpm --filter @fluxcore/dashboard test -- CommandPalette
pnpm --filter @fluxcore/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/client/shared/command-palette/ \
        apps/dashboard/tests/client/shared/command-palette/CommandPalette.test.tsx
git commit -m "$(cat <<'EOF'
feat(palette): add the palette dialog

Virtual-focus listbox: DOM focus stays in the input and the active row is
announced via aria-activedescendant, so typing and navigating never fight
each other. Group headers are role="presentation" to keep them out of the
option count.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Mount it and add the trigger

**Files:**
- Create: `apps/dashboard/src/client/shared/components/CommandPaletteTrigger.tsx`
- Modify: `apps/dashboard/src/client/routes/__root.tsx`
- Test: `apps/dashboard/tests/client/shared/components/CommandPaletteTrigger.test.tsx`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/shared/components/CommandPaletteTrigger.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPaletteTrigger } from "../../../../src/client/shared/components/CommandPaletteTrigger";
import {
  CommandPaletteProvider, useCommandPalette,
} from "../../../../src/client/shared/command-palette/useCommandPalette";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../src/client/shared/components/Icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

function State() {
  const { isOpen } = useCommandPalette();
  return <span data-testid="state">{isOpen ? "open" : "closed"}</span>;
}

function setup() {
  const user = userEvent.setup();
  render(
    <CommandPaletteProvider>
      <CommandPaletteTrigger />
      <State />
    </CommandPaletteProvider>,
  );
  return { user };
}

describe("CommandPaletteTrigger", () => {
  it("is a labelled button", () => {
    setup();
    expect(screen.getByRole("button", { name: "palette.open" })).toBeInTheDocument();
  });

  it("opens the palette on click", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "palette.open" }));
    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });

  it("shows the shortcut chip", () => {
    setup();
    expect(screen.getByText(/K$/)).toBeInTheDocument();
  });

  it("meets the 44px minimum hit area", () => {
    setup();
    const button = screen.getByRole("button", { name: "palette.open" });
    expect(button.className).toMatch(/min-h-11/);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- CommandPaletteTrigger
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the trigger**

Create `apps/dashboard/src/client/shared/components/CommandPaletteTrigger.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";
import { useCommandPalette } from "../command-palette/useCommandPalette";

/**
 * Apple platforms render ⌘; everything else renders Ctrl. Read once at module
 * scope — the platform cannot change during a session, and `navigator` is
 * absent under SSR/node, so it falls back to the Ctrl label.
 */
const IS_APPLE =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function CommandPaletteTrigger() {
  const { t } = useTranslation();
  const { open } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t("palette.open")}
      className="flex min-h-11 items-center gap-2 rounded-md px-2 text-text-muted transition-colors hover:bg-surface-high hover:text-text sm:px-3"
    >
      <Icon name="search" size={18} />
      <kbd className="hidden font-mono text-[0.625rem] text-text-muted sm:inline">
        {IS_APPLE ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
```

- [ ] **Step 4: Wire it into the root layout**

In `apps/dashboard/src/client/routes/__root.tsx`:

Add imports:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { CommandPaletteProvider } from "../shared/command-palette/useCommandPalette";
import { CommandPalette } from "../shared/command-palette/CommandPalette";
import { CommandPaletteTrigger } from "../shared/components/CommandPaletteTrigger";
import { pageCommands } from "../shared/command-palette/sources/pages";
import { serverCommands } from "../shared/command-palette/sources/servers";
import { actionCommands } from "../shared/command-palette/sources/actions";
import { useGuilds, useRefreshGuilds } from "../shared/hooks/useGuilds";
import { useRefreshGuild } from "../shared/hooks/useGuilds";
import { useBotInfo } from "../shared/hooks/useBotInfo";
import { usePermissions } from "../features/permissions/hooks/usePermissions";
import type { Command } from "../shared/command-palette/types";
```

Add a child component that owns the wiring (hooks cannot run before the `user &&` guard, and this keeps `RootLayout` readable):

```tsx
function AppCommandPalette({ guildId }: { guildId: string | undefined }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: guilds } = useGuilds();
  const { data: botInfo } = useBotInfo();
  const { can } = usePermissions(guildId ?? "");
  const refreshGuilds = useRefreshGuilds();
  const refreshGuild = useRefreshGuild(guildId ?? "");

  const commands: Command[] = useMemo(
    () => [
      ...pageCommands({ guildId, t, can }),
      ...actionCommands({
        guildId,
        t,
        onRefreshGuild: () => refreshGuild.mutate(),
        onRefreshGuildList: () => refreshGuilds.mutate(),
        inviteUrl: botInfo?.inviteUrl ?? null,
      }),
      ...serverCommands({ guilds: guilds ?? [] }),
    ],
    [guildId, t, can, guilds, botInfo, refreshGuild, refreshGuilds],
  );

  function onNavigate(command: Command) {
    if (command.href) {
      window.location.href = command.href;
      return;
    }
    if (command.onSelect) {
      command.onSelect();
      return;
    }
    if (command.to) {
      navigate({ to: command.to, params: command.params });
    }
  }

  return <CommandPalette commands={commands} onNavigate={onNavigate} />;
}
```

Add `useMemo` to the existing `react` import. Wrap the tree in the provider — replace the outermost `<TooltipProvider>` line so it reads:

```tsx
    <MobileSidebarContext.Provider value={{ isOpen: sidebarOpen, toggle, close }}>
      <CommandPaletteProvider>
        <TooltipProvider>
```

and close it with `</CommandPaletteProvider>` before `</MobileSidebarContext.Provider>`.

Inside the `{user && (...)}` nav, add the trigger just before `{params.guildId && <RefreshDataWidget .../>}`:

```tsx
                <CommandPaletteTrigger />
```

And render the palette itself immediately after the closing `</nav>`, still inside `{user && ...}`:

```tsx
              <AppCommandPalette guildId={params.guildId} />
```

> Mounting inside the `user &&` guard means the palette exists only for authenticated users, so the hotkey does nothing on the landing page — where there is nothing to navigate to.

- [ ] **Step 5: Run the full suite and typecheck**

```bash
pnpm --filter @fluxcore/dashboard test
pnpm --filter @fluxcore/dashboard typecheck
```

Expected: PASS, including the pre-existing root-layout tests.

- [ ] **Step 6: Verify by hand**

```bash
pnpm dev:dashboard
```

Check, in both a guild and the server list:
1. `⌘K`/`Ctrl+K` and `⌘P`/`Ctrl+P` open it; `Esc` closes it
2. Arrow keys move the highlight; `Enter` navigates; the dialog closes
3. Typing filters, and the matched run is highlighted in accent
4. Tab order and focus return to the trigger on close
5. Switch to Arabic via the language switcher — the palette mirrors correctly with no clipped text
6. Only pages your role can see are listed

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/client/shared/components/CommandPaletteTrigger.tsx \
        apps/dashboard/src/client/routes/__root.tsx \
        apps/dashboard/tests/client/shared/components/CommandPaletteTrigger.test.tsx
git commit -m "$(cat <<'EOF'
feat(palette): mount the palette and add the top-nav trigger

The trigger exists because a keyboard-only feature is invisible; it shows
the platform-correct shortcut. Both live inside the authenticated guard,
so the hotkey is inert on the landing page.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Recent destinations

On an empty query the palette should lead with where you actually go, not the top of an alphabetical list.

**Files:**
- Create: `apps/dashboard/src/client/shared/command-palette/useRecentCommands.ts`
- Modify: `apps/dashboard/src/client/routes/__root.tsx`
- Test: `apps/dashboard/tests/client/shared/command-palette/useRecentCommands.test.tsx`

**Interfaces:**
- Produces: `useRecentCommands(all: Command[]): { recent: Command[]; remember: (c: Command) => void }`.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/shared/command-palette/useRecentCommands.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecentCommands } from "../../../../src/client/shared/command-palette/useRecentCommands";
import type { Command } from "../../../../src/client/shared/command-palette/types";

function cmd(id: string): Command {
  return { id, group: "pages", title: id, icon: "dashboard", to: `/${id}` };
}

const all = [cmd("a"), cmd("b"), cmd("c"), cmd("d"), cmd("e"), cmd("f")];

describe("useRecentCommands", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty", () => {
    const { result } = renderHook(() => useRecentCommands(all));
    expect(result.current.recent).toEqual([]);
  });

  it("remembers a selection, most recent first", () => {
    const { result } = renderHook(() => useRecentCommands(all));
    act(() => result.current.remember(cmd("a")));
    act(() => result.current.remember(cmd("b")));
    expect(result.current.recent.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("re-selecting moves an entry to the front without duplicating it", () => {
    const { result } = renderHook(() => useRecentCommands(all));
    act(() => result.current.remember(cmd("a")));
    act(() => result.current.remember(cmd("b")));
    act(() => result.current.remember(cmd("a")));
    expect(result.current.recent.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("keeps at most five", () => {
    const { result } = renderHook(() => useRecentCommands(all));
    for (const c of all) act(() => result.current.remember(c));
    expect(result.current.recent).toHaveLength(5);
    expect(result.current.recent.map((c) => c.id)).toEqual(["f", "e", "d", "c", "b"]);
  });

  it("re-labels entries into the 'recent' group so they render separately", () => {
    const { result } = renderHook(() => useRecentCommands(all));
    act(() => result.current.remember(cmd("a")));
    expect(result.current.recent[0].group).toBe("recent");
  });

  it("survives a remount via localStorage", () => {
    const first = renderHook(() => useRecentCommands(all));
    act(() => first.result.current.remember(cmd("a")));
    first.unmount();

    const second = renderHook(() => useRecentCommands(all));
    expect(second.result.current.recent.map((c) => c.id)).toEqual(["a"]);
  });

  it("drops ids that no longer exist, so a removed page cannot linger", () => {
    localStorage.setItem("fluxcore.palette.recent", JSON.stringify(["gone", "a"]));
    const { result } = renderHook(() => useRecentCommands(all));
    expect(result.current.recent.map((c) => c.id)).toEqual(["a"]);
  });

  it("ignores corrupt storage rather than throwing", () => {
    localStorage.setItem("fluxcore.palette.recent", "{not json");
    const { result } = renderHook(() => useRecentCommands(all));
    expect(result.current.recent).toEqual([]);
  });

  it("ignores stored values that are not an array of strings", () => {
    localStorage.setItem("fluxcore.palette.recent", JSON.stringify({ a: 1 }));
    const { result } = renderHook(() => useRecentCommands(all));
    expect(result.current.recent).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- useRecentCommands
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/dashboard/src/client/shared/command-palette/useRecentCommands.ts`:

```ts
import { useCallback, useMemo, useState } from "react";
import type { Command } from "./types";

const STORAGE_KEY = "fluxcore.palette.recent";
const MAX_RECENT = 5;

function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // Corrupt or unavailable storage must never break the palette.
    return [];
  }
}

function write(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Private mode / quota exceeded — recents are a convenience, not a feature
    // worth failing over.
  }
}

/**
 * Only ids are persisted; the Command objects are resolved from the live list
 * on every render. That means a page the viewer has lost permission for, or a
 * route that no longer exists, silently drops out instead of lingering as a
 * dead entry.
 */
export function useRecentCommands(all: Command[]) {
  const [ids, setIds] = useState<string[]>(read);

  const recent = useMemo(
    () =>
      ids
        .map((id) => all.find((c) => c.id === id))
        .filter((c): c is Command => c !== undefined)
        .map((c) => ({ ...c, group: "recent" as const })),
    [ids, all],
  );

  const remember = useCallback((command: Command) => {
    setIds((prev) => {
      const next = [command.id, ...prev.filter((id) => id !== command.id)]
        .slice(0, MAX_RECENT);
      write(next);
      return next;
    });
  }, []);

  return { recent, remember };
}
```

- [ ] **Step 4: Wire it in**

In `__root.tsx`'s `AppCommandPalette`, resolve recents from the static command list and prepend them, and record every selection:

```tsx
  const staticCommands = useMemo(() => [/* pages, actions, servers as before */], [...]);
  const { recent, remember } = useRecentCommands(staticCommands);
  const commands = useMemo(() => [...recent, ...staticCommands], [recent, staticCommands]);

  function onNavigate(command: Command) {
    // Store under the underlying id, not the re-grouped "recent" copy.
    remember(command);
    /* …existing href / onSelect / to handling… */
  }
```

Because `recent` entries carry `group: "recent"` and `GROUP_ORDER` lists `recent` first, they render above Pages with no further change. They are copies, so the original command still appears in its own group — which is correct: a page you visit often should be reachable from both.

- [ ] **Step 5: Run the tests and typecheck**

```bash
pnpm --filter @fluxcore/dashboard test
pnpm --filter @fluxcore/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/client/shared/command-palette/useRecentCommands.ts \
        apps/dashboard/src/client/routes/__root.tsx \
        apps/dashboard/tests/client/shared/command-palette/useRecentCommands.test.tsx
git commit -m "$(cat <<'EOF'
feat(palette): remember recent destinations

Only ids are persisted and resolved against the live command list, so a page
the viewer lost access to drops out rather than lingering as a dead entry.
Corrupt or unavailable storage degrades to no recents rather than throwing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Done criteria

- [ ] `pnpm test` passes with no regressions against the recorded baseline
- [ ] `pnpm typecheck` clean
- [ ] All 48 locales carry the `palette` block, and the parity test enforces it
- [ ] The palette opens on both shortcuts from every authenticated route
- [ ] Pages the viewer lacks permission for never appear
- [ ] Manual RTL pass done in Arabic

## Handoff

Live-record search, `?focus=` deep-linking, and "Create X" actions continue in `docs/superpowers/plans/2026-07-26-command-palette-record-search.md`.
