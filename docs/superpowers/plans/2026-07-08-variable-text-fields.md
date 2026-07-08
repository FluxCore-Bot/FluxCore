# Variable Text Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every `{variable}` template text field in the dashboard `{`-triggered autocomplete, a searchable variable browser, inline highlighting, unknown-variable validation, and a live Discord-style preview — via one reusable component set.

**Architecture:** A new module `apps/dashboard/src/client/shared/ui/variable-field/` holds three React components (`VariableEditor`, `VariableBrowser`, `DiscordMessagePreview`) plus pure, DOM-free helper modules (tokenizing, caret math, filtering, validation, preview resolution) and a per-scope variable registry. All logic lives in the pure helpers (unit-tested under the existing node vitest env); the components are thin wrappers (tested under a newly-added jsdom env). Rollout swaps the plain `Input`/`Textarea` in six feature areas for `VariableEditor` and adds a preview.

**Tech Stack:** React 19, TypeScript (strict), Tailwind CSS 4 (Obsidian Engine tokens), Radix (`popover`, `scroll-area`), TanStack Query hooks (`useAuth`, `useGuilds`, `useConstants`), Vitest, `@testing-library/react` + `user-event` + `jsdom` (added in Task 1), react-i18next.

## Global Constraints

- **All `pnpm add`/`install` and all test runs execute inside Docker.** Canonical test command (abbreviated `<DTEST>` below):
  `docker compose --profile bot run --rm bot pnpm --filter @fluxcore/dashboard test -- <files>`
  Typecheck: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/dashboard exec tsc -p tsconfig.client.json --noEmit`.
- **Strict TypeScript — no `any`.** Prefer `unknown` + narrowing.
- **UI components live at** `apps/dashboard/src/client/shared/ui/` (NOT `components/ui`). Import `cn` from `../lib/utils`. Client imports use **relative paths** (no `@/` alias).
- **Placeholder syntax is `{token}` (curly braces).** A token matches `/\{[\w.]+\}/`.
- **Do NOT rename/unify existing runtime tokens** across features (welcome `{user.name}`/`{membercount}` vs custom-commands `{username}`/`{memberCount}`). Each field surfaces its own set.
- **No new backend endpoints.** Preview uses already-loaded `useGuilds()` (id/name/icon) + `useAuth()` (userId/username/avatar); `memberCount` is not client-available and uses a sample value.
- **Design tokens:** accent = `text-accent`; destructive = `text-danger`; surfaces `bg-surface-lowest`/`bg-surface-container`; muted `text-text-muted`. Match existing `Input`/`Textarea` metrics: `text-sm`, `px-3`, input `py-1 h-9`, textarea `py-2 min-h-[60px]`.
- **Every task ends green** (its tests pass) and is committed. Commit messages: `feat(dashboard): …` or `test(dashboard): …`.
- **Locale source of truth:** `packages/i18n/src/locales/en/*.json` (never `dist`); other 47 langs fall back to `en`.

---

## File Structure

```
apps/dashboard/src/client/shared/ui/variable-field/
  types.ts                 VariableDescriptor, Segment, UnknownToken, PreviewRealData, RealDataKey
  tokens.ts                TOKEN_REGEX, tokenize(), extractTokens()
  validation.ts            levenshtein(), detectUnknownTokens()
  caret.ts                 insertToken(), getActiveQuery()
  filterVariables.ts       filterByQuery()
  registry.ts              descriptor arrays (welcome/customCommand/leveling/tempvoice),
                           SAMPLE/GROUP/REAL maps, knownTokenSet(), buildRealData(), buildTokenValues()
  automationVariables.ts   buildAutomationVariables()
  resolvePreview.ts        resolveTemplatePreview()
  usePreviewContext.ts     usePreviewContext(guildId) hook
  VariableEditor.tsx       the field (input/textarea + overlay + autocomplete + validation)
  VariableBrowser.tsx      "Insert variable" popover
  DiscordMessagePreview.tsx Discord-style message/embed bubble
  index.ts                 barrel

apps/dashboard/tests/client/shared/ui/variable-field/
  tokens.test.ts  validation.test.ts  caret.test.ts  filterVariables.test.ts
  registry.test.ts  automationVariables.test.ts  resolvePreview.test.ts
  VariableEditor.test.tsx  VariableBrowser.test.tsx  DiscordMessagePreview.test.tsx
```

---

## Phase 0 — Test toolchain

### Task 1: Add client (jsdom) test toolchain

**Files:**
- Modify: `apps/dashboard/package.json` (devDependencies)
- Modify: `apps/dashboard/vitest.config.ts`
- Test: `apps/dashboard/tests/client/smoke.test.tsx`

**Interfaces:**
- Produces: a working jsdom test environment so `*.test.tsx` under `tests/client/**` render React components.

- [ ] **Step 1: Install devDependencies (in Docker)**

Run:
```bash
docker compose --profile bot run --rm --no-deps bot \
  pnpm --filter @fluxcore/dashboard add -D @testing-library/react @testing-library/user-event jsdom
```
Expected: pnpm reports the three packages added to `apps/dashboard/package.json` devDependencies.

- [ ] **Step 2: Update `vitest.config.ts` to include `.test.tsx`**

Replace the `include` line so both server `.ts` and client `.tsx` tests are collected. New `test` block:

```ts
  test: {
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    alias: {
      "../../src/server/": resolve(__dirname, "src/server") + "/",
    },
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.ts", "src/client/shared/ui/variable-field/**/*.ts"],
      exclude: ["src/server/index.ts"],
    },
  },
```

(Global environment stays `node`; component test files opt into jsdom via a docblock in Step 3.)

- [ ] **Step 3: Write the smoke component test**

Create `apps/dashboard/tests/client/smoke.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

function Hello() {
  return <button type="button">click me</button>;
}

describe("jsdom toolchain", () => {
  it("renders a component into the DOM", () => {
    render(<Hello />);
    expect(screen.getByRole("button", { name: "click me" })).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `<DTEST> tests/client/smoke.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/package.json apps/dashboard/pnpm-lock.yaml ../../pnpm-lock.yaml apps/dashboard/vitest.config.ts apps/dashboard/tests/client/smoke.test.tsx
git commit -m "test(dashboard): add jsdom + testing-library client test toolchain"
```
(If the lockfile lives only at repo root, adjust the `git add` to the actual changed lockfile path shown by `git status`.)

---

## Phase 1 — Pure logic foundations (node env)

### Task 2: Token types + tokenizer

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/variable-field/types.ts`
- Create: `apps/dashboard/src/client/shared/ui/variable-field/tokens.ts`
- Test: `apps/dashboard/tests/client/shared/ui/variable-field/tokens.test.ts`

**Interfaces:**
- Produces:
  - `type RealDataKey = "userMention"|"userName"|"userTag"|"userId"|"userAvatar"|"serverName"|"serverId"|"serverIcon"|"memberCount"`
  - `type VariableGroup = "user"|"server"|"channel"|"role"|"message"|"event"|"misc"`
  - `interface VariableDescriptor { token: string; labelKey?: string; description?: string; example: string; group: VariableGroup; realKey?: RealDataKey }`
  - `interface Segment { type: "text"|"var"; value: string; known: boolean }`
  - `interface UnknownToken { token: string; suggestion: string | null }`
  - `interface PreviewRealData { userMention: string; userName: string; userTag: string; userId: string; userAvatar: string; serverName: string; serverId: string; serverIcon: string; memberCount: string }`
  - `const TOKEN_REGEX: RegExp` (global, matches `\{[\w.]+\}`)
  - `function tokenize(value: string, known: Set<string>): Segment[]`
  - `function extractTokens(value: string): string[]`

- [ ] **Step 1: Write `types.ts`**

```ts
export type RealDataKey =
  | "userMention" | "userName" | "userTag" | "userId" | "userAvatar"
  | "serverName" | "serverId" | "serverIcon" | "memberCount";

export type VariableGroup =
  | "user" | "server" | "channel" | "role" | "message" | "event" | "misc";

export interface VariableDescriptor {
  token: string;
  labelKey?: string;
  description?: string;
  example: string;
  group: VariableGroup;
  realKey?: RealDataKey;
}

export interface Segment {
  type: "text" | "var";
  value: string;
  known: boolean;
}

export interface UnknownToken {
  token: string;
  suggestion: string | null;
}

export interface PreviewRealData {
  userMention: string;
  userName: string;
  userTag: string;
  userId: string;
  userAvatar: string;
  serverName: string;
  serverId: string;
  serverIcon: string;
  memberCount: string;
}
```

- [ ] **Step 2: Write the failing test**

Create `tokens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tokenize, extractTokens } from "../../../../../src/client/shared/ui/variable-field/tokens";

const known = new Set(["{user}", "{server}"]);

describe("tokenize", () => {
  it("splits text and variable segments", () => {
    const segs = tokenize("Hi {user}!", known);
    expect(segs).toEqual([
      { type: "text", value: "Hi ", known: false },
      { type: "var", value: "{user}", known: true },
      { type: "text", value: "!", known: false },
    ]);
  });

  it("marks unknown variables as not known", () => {
    const segs = tokenize("{nope}", known);
    expect(segs).toEqual([{ type: "var", value: "{nope}", known: false }]);
  });

  it("returns a single text segment when there are no tokens", () => {
    expect(tokenize("plain", known)).toEqual([{ type: "text", value: "plain", known: false }]);
  });
});

describe("extractTokens", () => {
  it("returns every token occurrence", () => {
    expect(extractTokens("{user} and {user} and {server}")).toEqual(["{user}", "{user}", "{server}"]);
  });
  it("returns [] when none", () => {
    expect(extractTokens("none here")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `<DTEST> tests/client/shared/ui/variable-field/tokens.test.ts`
Expected: FAIL (cannot find module `tokens`).

- [ ] **Step 4: Write `tokens.ts`**

```ts
import type { Segment } from "./types";

export const TOKEN_REGEX = /\{[\w.]+\}/g;

export function tokenize(value: string, known: Set<string>): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  const re = new RegExp(TOKEN_REGEX.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: value.slice(lastIndex, match.index), known: false });
    }
    segments.push({ type: "var", value: match[0], known: known.has(match[0]) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length) {
    segments.push({ type: "text", value: value.slice(lastIndex), known: false });
  }
  return segments;
}

export function extractTokens(value: string): string[] {
  const re = new RegExp(TOKEN_REGEX.source, "g");
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) out.push(match[0]);
  return out;
}
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `<DTEST> tests/client/shared/ui/variable-field/tokens.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/variable-field/types.ts apps/dashboard/src/client/shared/ui/variable-field/tokens.ts apps/dashboard/tests/client/shared/ui/variable-field/tokens.test.ts
git commit -m "feat(dashboard): add variable-field token types and tokenizer"
```

---

### Task 3: Unknown-token validation with suggestions

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/variable-field/validation.ts`
- Test: `apps/dashboard/tests/client/shared/ui/variable-field/validation.test.ts`

**Interfaces:**
- Consumes: `extractTokens` (Task 2), `UnknownToken` type.
- Produces:
  - `function levenshtein(a: string, b: string): number`
  - `function detectUnknownTokens(value: string, known: Set<string>): UnknownToken[]` — each unknown token gets the closest known token as `suggestion` when edit distance ≤ 3, else `null`. De-duplicated by token string, in first-seen order.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { levenshtein, detectUnknownTokens } from "../../../../../src/client/shared/ui/variable-field/validation";

const known = new Set(["{user}", "{server}", "{membercount}"]);

describe("levenshtein", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });
});

describe("detectUnknownTokens", () => {
  it("returns nothing when all tokens are known", () => {
    expect(detectUnknownTokens("Hi {user} on {server}", known)).toEqual([]);
  });

  it("flags an unknown token and suggests the closest known one", () => {
    expect(detectUnknownTokens("member #{membercont}", known)).toEqual([
      { token: "{membercont}", suggestion: "{membercount}" },
    ]);
  });

  it("gives null suggestion when nothing is close", () => {
    expect(detectUnknownTokens("{zzzzzzzz}", known)).toEqual([
      { token: "{zzzzzzzz}", suggestion: null },
    ]);
  });

  it("de-duplicates repeated unknown tokens", () => {
    expect(detectUnknownTokens("{foo} {foo}", known)).toEqual([
      { token: "{foo}", suggestion: null },
    ]);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `<DTEST> tests/client/shared/ui/variable-field/validation.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `validation.ts`**

```ts
import type { UnknownToken } from "./types";
import { extractTokens } from "./tokens";

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export function detectUnknownTokens(value: string, known: Set<string>): UnknownToken[] {
  const knownList = [...known];
  const seen = new Set<string>();
  const result: UnknownToken[] = [];
  for (const token of extractTokens(value)) {
    if (known.has(token) || seen.has(token)) continue;
    seen.add(token);
    let best: string | null = null;
    let bestDist = Infinity;
    for (const candidate of knownList) {
      const dist = levenshtein(token, candidate);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    result.push({ token, suggestion: bestDist <= 3 ? best : null });
  }
  return result;
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `<DTEST> tests/client/shared/ui/variable-field/validation.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/variable-field/validation.ts apps/dashboard/tests/client/shared/ui/variable-field/validation.test.ts
git commit -m "feat(dashboard): add unknown-variable detection with suggestions"
```

---

### Task 4: Caret helpers (insert + active query)

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/variable-field/caret.ts`
- Test: `apps/dashboard/tests/client/shared/ui/variable-field/caret.test.ts`

**Interfaces:**
- Produces:
  - `function insertToken(value: string, selStart: number, selEnd: number, token: string): { value: string; cursor: number }` — replaces `[selStart,selEnd)` with `token`, returns new value + caret positioned after the inserted token.
  - `function getActiveQuery(value: string, caret: number): { query: string; start: number } | null` — if the caret sits inside an open, unclosed `{…` run of `[\w.]*`, returns the partial text after `{` and the index of the `{`. Otherwise `null`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { insertToken, getActiveQuery } from "../../../../../src/client/shared/ui/variable-field/caret";

describe("insertToken", () => {
  it("inserts at a collapsed caret", () => {
    expect(insertToken("Hi ", 3, 3, "{user}")).toEqual({ value: "Hi {user}", cursor: 9 });
  });
  it("replaces a selection", () => {
    expect(insertToken("Hi XXX!", 3, 6, "{user}")).toEqual({ value: "Hi {user}!", cursor: 9 });
  });
  it("replaces an open query when start passed as selStart", () => {
    // caller replaces "{us" (indices 3..6) with the full token
    expect(insertToken("Hi {us", 3, 6, "{user}")).toEqual({ value: "Hi {user}", cursor: 9 });
  });
});

describe("getActiveQuery", () => {
  it("detects an open query at the caret", () => {
    expect(getActiveQuery("Hi {us", 6)).toEqual({ query: "us", start: 3 });
  });
  it("detects an empty query right after {", () => {
    expect(getActiveQuery("Hi {", 4)).toEqual({ query: "", start: 3 });
  });
  it("returns null when the brace is already closed before the caret", () => {
    expect(getActiveQuery("Hi {user} x", 11)).toBeNull();
  });
  it("returns null when there is no open brace", () => {
    expect(getActiveQuery("plain text", 5)).toBeNull();
  });
  it("returns null when a space breaks the run", () => {
    expect(getActiveQuery("{us er", 6)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `<DTEST> tests/client/shared/ui/variable-field/caret.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `caret.ts`**

```ts
export function insertToken(
  value: string,
  selStart: number,
  selEnd: number,
  token: string,
): { value: string; cursor: number } {
  const next = value.slice(0, selStart) + token + value.slice(selEnd);
  return { value: next, cursor: selStart + token.length };
}

export function getActiveQuery(
  value: string,
  caret: number,
): { query: string; start: number } | null {
  const before = value.slice(0, caret);
  const open = before.lastIndexOf("{");
  if (open === -1) return null;
  const run = before.slice(open + 1);
  // Valid partial token chars only; a closing brace or any other char breaks it.
  if (!/^[\w.]*$/.test(run)) return null;
  if (run.includes("}")) return null;
  return { query: run, start: open };
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `<DTEST> tests/client/shared/ui/variable-field/caret.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/variable-field/caret.ts apps/dashboard/tests/client/shared/ui/variable-field/caret.test.ts
git commit -m "feat(dashboard): add caret insert + active-query helpers"
```

---

### Task 5: Autocomplete filtering

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/variable-field/filterVariables.ts`
- Test: `apps/dashboard/tests/client/shared/ui/variable-field/filterVariables.test.ts`

**Interfaces:**
- Consumes: `VariableDescriptor` (Task 2).
- Produces: `function filterByQuery(descriptors: VariableDescriptor[], query: string): VariableDescriptor[]` — case-insensitive substring match against the token with `{`/`}` stripped; empty query returns all; exact prefix matches sort before mid-string matches; stable otherwise.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { filterByQuery } from "../../../../../src/client/shared/ui/variable-field/filterVariables";
import type { VariableDescriptor } from "../../../../../src/client/shared/ui/variable-field/types";

const vars: VariableDescriptor[] = [
  { token: "{user}", example: "@Ada", group: "user" },
  { token: "{user.name}", example: "Ada", group: "user" },
  { token: "{server}", example: "Acme", group: "server" },
];

describe("filterByQuery", () => {
  it("returns all descriptors for an empty query", () => {
    expect(filterByQuery(vars, "")).toHaveLength(3);
  });
  it("matches by substring, case-insensitively", () => {
    expect(filterByQuery(vars, "USER").map((v) => v.token)).toEqual(["{user}", "{user.name}"]);
  });
  it("ranks prefix matches before mid-string matches", () => {
    expect(filterByQuery(vars, "ser").map((v) => v.token)).toEqual(["{server}", "{user}", "{user.name}"]);
  });
  it("returns [] when nothing matches", () => {
    expect(filterByQuery(vars, "zzz")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `<DTEST> tests/client/shared/ui/variable-field/filterVariables.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `filterVariables.ts`**

```ts
import type { VariableDescriptor } from "./types";

function bareToken(token: string): string {
  return token.replace(/[{}]/g, "").toLowerCase();
}

export function filterByQuery(
  descriptors: VariableDescriptor[],
  query: string,
): VariableDescriptor[] {
  const q = query.toLowerCase();
  if (q === "") return [...descriptors];
  const matches = descriptors
    .map((d, index) => ({ d, index, pos: bareToken(d.token).indexOf(q) }))
    .filter((m) => m.pos !== -1);
  matches.sort((a, b) => (a.pos !== b.pos ? a.pos - b.pos : a.index - b.index));
  return matches.map((m) => m.d);
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `<DTEST> tests/client/shared/ui/variable-field/filterVariables.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/variable-field/filterVariables.ts apps/dashboard/tests/client/shared/ui/variable-field/filterVariables.test.ts
git commit -m "feat(dashboard): add variable autocomplete filtering"
```

---

### Task 6: Registry (per-scope descriptors + real/sample maps + drift guard)

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/variable-field/registry.ts`
- Test: `apps/dashboard/tests/client/shared/ui/variable-field/registry.test.ts`

**Interfaces:**
- Consumes: `VariableDescriptor`, `PreviewRealData`, `RealDataKey`.
- Produces:
  - `const welcomeVariables: VariableDescriptor[]`
  - `const customCommandVariables: VariableDescriptor[]`
  - `const levelingVariables: VariableDescriptor[]`
  - `const tempvoiceVariables: VariableDescriptor[]`
  - `function knownTokenSet(descriptors: VariableDescriptor[]): Set<string>`
  - `function buildRealData(guild: { id: string; name: string; icon: string | null } | undefined, user: { userId: string; username: string; avatar: string | null } | undefined): PreviewRealData`
  - `function buildTokenValues(descriptors: VariableDescriptor[], real: PreviewRealData): Map<string, string>`

**Notes:** `labelKey` values point at existing/added i18n keys (Task 20). Token **names** are asserted against the canonical `@fluxcore/systems` sources by the drift test; if that import fails to resolve, build the systems package first: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/systems build`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  welcomeVariables,
  customCommandVariables,
  levelingVariables,
  tempvoiceVariables,
  knownTokenSet,
  buildRealData,
  buildTokenValues,
} from "../../../../../src/client/shared/ui/variable-field/registry";
import { WELCOME_VARIABLES } from "@fluxcore/systems/welcome/constants";
import { TEMPLATE_VARIABLES as CUSTOM_CMD_VARS } from "@fluxcore/systems/customCommands/variables";

describe("registry drift guard", () => {
  it("welcome descriptors match the canonical WELCOME_VARIABLES tokens exactly", () => {
    expect(new Set(welcomeVariables.map((v) => v.token))).toEqual(new Set(Object.keys(WELCOME_VARIABLES)));
  });
  it("custom-command descriptors match the canonical customCommands TEMPLATE_VARIABLES tokens", () => {
    expect(new Set(customCommandVariables.map((v) => v.token))).toEqual(new Set(Object.keys(CUSTOM_CMD_VARS)));
  });
  it("leveling exposes {user} and {level}", () => {
    expect(levelingVariables.map((v) => v.token).sort()).toEqual(["{level}", "{user}"]);
  });
  it("tempvoice exposes at least {user}", () => {
    expect(tempvoiceVariables.map((v) => v.token)).toContain("{user}");
  });
});

describe("knownTokenSet", () => {
  it("collects tokens into a Set", () => {
    expect(knownTokenSet(levelingVariables).has("{level}")).toBe(true);
  });
});

describe("buildRealData", () => {
  it("uses real guild/user data and builds CDN URLs", () => {
    const real = buildRealData(
      { id: "42", name: "Acme", icon: "abc" },
      { userId: "7", username: "Ada", avatar: "def" },
    );
    expect(real.serverName).toBe("Acme");
    expect(real.serverIcon).toBe("https://cdn.discordapp.com/icons/42/abc.png");
    expect(real.userName).toBe("Ada");
    expect(real.userMention).toBe("@Ada");
    expect(real.userAvatar).toBe("https://cdn.discordapp.com/avatars/7/def.png");
    expect(real.memberCount).toBe("1,234"); // sample: not available client-side
  });
  it("falls back to defaults when data is missing", () => {
    const real = buildRealData(undefined, undefined);
    expect(real.serverName).toBe("My Server");
    expect(real.userName).toBe("User");
    expect(real.userAvatar).toBe("https://cdn.discordapp.com/embed/avatars/0.png");
  });
});

describe("buildTokenValues", () => {
  it("maps real values where realKey is set and samples otherwise", () => {
    const real = buildRealData({ id: "42", name: "Acme", icon: null }, undefined);
    const map = buildTokenValues(welcomeVariables, real);
    expect(map.get("{server}")).toBe("Acme");
    expect(map.get("{membercount}")).toBe("1,234");
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `<DTEST> tests/client/shared/ui/variable-field/registry.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `registry.ts`**

```ts
import type { PreviewRealData, RealDataKey, VariableDescriptor } from "./types";

export const welcomeVariables: VariableDescriptor[] = [
  { token: "{user}", labelKey: "variables.user", example: "@Ada", group: "user", realKey: "userMention" },
  { token: "{user.tag}", labelKey: "variables.userTag", example: "Ada#0001", group: "user", realKey: "userTag" },
  { token: "{user.name}", labelKey: "variables.userName", example: "Ada", group: "user", realKey: "userName" },
  { token: "{user.id}", labelKey: "variables.userId", example: "123456789012345678", group: "user", realKey: "userId" },
  { token: "{user.avatar}", labelKey: "variables.userAvatar", example: "https://cdn.discordapp.com/embed/avatars/0.png", group: "user", realKey: "userAvatar" },
  { token: "{server}", labelKey: "variables.server", example: "Acme", group: "server", realKey: "serverName" },
  { token: "{server.id}", labelKey: "variables.serverId", example: "987654321098765432", group: "server", realKey: "serverId" },
  { token: "{membercount}", labelKey: "variables.memberCount", example: "1,234", group: "server", realKey: "memberCount" },
  { token: "{server.icon}", labelKey: "variables.serverIcon", example: "https://cdn.discordapp.com/embed/avatars/0.png", group: "server", realKey: "serverIcon" },
];

export const customCommandVariables: VariableDescriptor[] = [
  { token: "{user}", labelKey: "variables.entries.user", example: "@Ada", group: "user", realKey: "userMention" },
  { token: "{username}", labelKey: "variables.entries.username", example: "Ada", group: "user", realKey: "userName" },
  { token: "{userId}", labelKey: "variables.entries.userId", example: "123456789012345678", group: "user", realKey: "userId" },
  { token: "{server}", labelKey: "variables.entries.server", example: "Acme", group: "server", realKey: "serverName" },
  { token: "{channel}", labelKey: "variables.entries.channel", example: "#general", group: "channel" },
  { token: "{channelName}", labelKey: "variables.entries.channelName", example: "general", group: "channel" },
  { token: "{memberCount}", labelKey: "variables.entries.memberCount", example: "1,234", group: "server", realKey: "memberCount" },
];

export const levelingVariables: VariableDescriptor[] = [
  { token: "{user}", labelKey: "variables.user", example: "@Ada", group: "user", realKey: "userMention" },
  { token: "{level}", labelKey: "variables.level", example: "5", group: "event" },
];

export const tempvoiceVariables: VariableDescriptor[] = [
  { token: "{user}", labelKey: "variables.user", example: "Ada", group: "user", realKey: "userName" },
];

export function knownTokenSet(descriptors: VariableDescriptor[]): Set<string> {
  return new Set(descriptors.map((d) => d.token));
}

export function buildRealData(
  guild: { id: string; name: string; icon: string | null } | undefined,
  user: { userId: string; username: string; avatar: string | null } | undefined,
): PreviewRealData {
  const serverName = guild?.name ?? "My Server";
  const serverId = guild?.id ?? "987654321098765432";
  const serverIcon =
    guild?.icon && guild.id
      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";
  const userName = user?.username ?? "User";
  const userId = user?.userId ?? "123456789012345678";
  const userAvatar =
    user?.avatar && user.userId
      ? `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";
  return {
    userMention: `@${userName}`,
    userName,
    userTag: userName,
    userId,
    userAvatar,
    serverName,
    serverId,
    serverIcon,
    memberCount: "1,234",
  };
}

export function buildTokenValues(
  descriptors: VariableDescriptor[],
  real: PreviewRealData,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of descriptors) {
    const value: string = d.realKey ? real[d.realKey as RealDataKey] : d.example;
    map.set(d.token, value);
  }
  return map;
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `<DTEST> tests/client/shared/ui/variable-field/registry.test.ts`
Expected: PASS. (If the two `@fluxcore/systems` imports fail to resolve, build systems first per the Notes above, then re-run.)

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/variable-field/registry.ts apps/dashboard/tests/client/shared/ui/variable-field/registry.test.ts
git commit -m "feat(dashboard): add per-scope variable registry with drift guard"
```

---

### Task 7: Automation variables builder

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/variable-field/automationVariables.ts`
- Test: `apps/dashboard/tests/client/shared/ui/variable-field/automationVariables.test.ts`

**Interfaces:**
- Consumes: `VariableDescriptor`, `VariableGroup`, `RealDataKey`; the client `Constants` type from `../../lib/schemas` (fields used: `eventTypeVariables: Record<string,string[]>`, `templateVariables: Record<string,string>`).
- Produces: `function buildAutomationVariables(constants: { eventTypeVariables: Record<string, string[]>; templateVariables: Record<string, string> }, eventType: string): VariableDescriptor[]` — for each token available to `eventType`, a descriptor whose `description` is the English text from `templateVariables[token]`, with `group`/`example`/`realKey` from the static maps below; unknown `eventType` → `[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildAutomationVariables } from "../../../../../src/client/shared/ui/variable-field/automationVariables";

const constants = {
  eventTypeVariables: {
    memberJoin: ["{user}", "{guild}", "{guild.memberCount}"],
    memberBanned: ["{user}", "{ban.reason}"],
  },
  templateVariables: {
    "{user}": "User mention (e.g. @User)",
    "{guild}": "Server name",
    "{guild.memberCount}": "Server member count",
    "{ban.reason}": "Ban reason",
  },
};

describe("buildAutomationVariables", () => {
  it("returns descriptors for the event's tokens with descriptions from templateVariables", () => {
    const vars = buildAutomationVariables(constants, "memberJoin");
    expect(vars.map((v) => v.token)).toEqual(["{user}", "{guild}", "{guild.memberCount}"]);
    expect(vars[0].description).toBe("User mention (e.g. @User)");
    expect(vars.find((v) => v.token === "{guild}")?.realKey).toBe("serverName");
  });
  it("includes event-only tokens like {ban.reason} for memberBanned", () => {
    expect(buildAutomationVariables(constants, "memberBanned").map((v) => v.token)).toContain("{ban.reason}");
  });
  it("excludes {ban.reason} for memberJoin (event scoping)", () => {
    expect(buildAutomationVariables(constants, "memberJoin").map((v) => v.token)).not.toContain("{ban.reason}");
  });
  it("returns [] for an unknown event type", () => {
    expect(buildAutomationVariables(constants, "nope")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `<DTEST> tests/client/shared/ui/variable-field/automationVariables.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `automationVariables.ts`**

```ts
import type { RealDataKey, VariableDescriptor, VariableGroup } from "./types";

const REAL_KEYS: Record<string, RealDataKey> = {
  "{user}": "userMention",
  "{user.name}": "userName",
  "{user.tag}": "userTag",
  "{user.id}": "userId",
  "{guild}": "serverName",
  "{guild.memberCount}": "memberCount",
};

const GROUPS: Record<string, VariableGroup> = {
  "{user}": "user", "{user.name}": "user", "{user.tag}": "user", "{user.id}": "user",
  "{channel}": "channel", "{channel.name}": "channel", "{channel.id}": "channel",
  "{role}": "role", "{role.name}": "role", "{role.id}": "role",
  "{guild}": "server", "{guild.memberCount}": "server",
  "{message.content}": "message", "{message.id}": "message", "{message.url}": "message",
  "{emoji}": "event", "{emoji.name}": "event", "{ban.reason}": "event",
  "{old.nickname}": "event", "{new.nickname}": "event", "{boost.since}": "event",
  "{timeout.until}": "event", "{voice.channel}": "event", "{voice.channel.name}": "event",
  "{thread.name}": "event", "{thread.id}": "event", "{timestamp}": "misc",
};

const SAMPLES: Record<string, string> = {
  "{user}": "@Ada", "{user.name}": "Ada", "{user.tag}": "Ada#0001", "{user.id}": "123456789012345678",
  "{channel}": "#general", "{channel.name}": "general", "{channel.id}": "112233445566778899",
  "{role}": "@Members", "{role.name}": "Members", "{role.id}": "223344556677889900",
  "{guild}": "Acme", "{guild.memberCount}": "1,234", "{timestamp}": "just now",
  "{message.content}": "Hello world", "{message.id}": "334455667788990011", "{message.url}": "https://discord.com/channels/…",
  "{emoji}": "🎉", "{emoji.name}": "tada", "{ban.reason}": "Spamming",
  "{old.nickname}": "OldNick", "{new.nickname}": "NewNick", "{boost.since}": "2 days ago",
  "{timeout.until}": "in 1 hour", "{voice.channel}": "General VC", "{voice.channel.name}": "General VC",
  "{thread.name}": "help-thread", "{thread.id}": "445566778899001122",
};

export function buildAutomationVariables(
  constants: { eventTypeVariables: Record<string, string[]>; templateVariables: Record<string, string> },
  eventType: string,
): VariableDescriptor[] {
  const tokens = constants.eventTypeVariables[eventType] ?? [];
  return tokens.map((token) => ({
    token,
    description: constants.templateVariables[token] ?? token,
    example: SAMPLES[token] ?? token,
    group: GROUPS[token] ?? "misc",
    realKey: REAL_KEYS[token],
  }));
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `<DTEST> tests/client/shared/ui/variable-field/automationVariables.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/variable-field/automationVariables.ts apps/dashboard/tests/client/shared/ui/variable-field/automationVariables.test.ts
git commit -m "feat(dashboard): build event-scoped automation variables"
```

---

### Task 8: Preview resolver

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/variable-field/resolvePreview.ts`
- Test: `apps/dashboard/tests/client/shared/ui/variable-field/resolvePreview.test.ts`

**Interfaces:**
- Produces: `function resolveTemplatePreview(template: string, values: Map<string, string>): string` — replaces every token present in `values`; unknown tokens are left visible; `{user}` and `{user.name}` are treated as distinct exact strings (no partial overlap).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveTemplatePreview } from "../../../../../src/client/shared/ui/variable-field/resolvePreview";

const values = new Map<string, string>([
  ["{user}", "@Ada"],
  ["{user.name}", "Ada"],
  ["{server}", "Acme"],
  ["{membercount}", "1,234"],
]);

describe("resolveTemplatePreview", () => {
  it("replaces known tokens with their values", () => {
    expect(resolveTemplatePreview("Hey {user}, welcome to {server}!", values)).toBe("Hey @Ada, welcome to Acme!");
  });
  it("does not let {user} clobber {user.name}", () => {
    expect(resolveTemplatePreview("{user} / {user.name}", values)).toBe("@Ada / Ada");
  });
  it("leaves unknown tokens visible", () => {
    expect(resolveTemplatePreview("member #{membercont}", values)).toBe("member #{membercont}");
  });
  it("replaces every occurrence", () => {
    expect(resolveTemplatePreview("{server} {server}", values)).toBe("Acme Acme");
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `<DTEST> tests/client/shared/ui/variable-field/resolvePreview.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `resolvePreview.ts`**

```ts
import { tokenize } from "./tokens";

export function resolveTemplatePreview(template: string, values: Map<string, string>): string {
  const known = new Set(values.keys());
  return tokenize(template, known)
    .map((seg) => (seg.type === "var" && seg.known ? values.get(seg.value)! : seg.value))
    .join("");
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `<DTEST> tests/client/shared/ui/variable-field/resolvePreview.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/variable-field/resolvePreview.ts apps/dashboard/tests/client/shared/ui/variable-field/resolvePreview.test.ts
git commit -m "feat(dashboard): add pure preview template resolver"
```

---

## Phase 2 — Components, hook, i18n chrome

### Task 9: `VariableEditor` component

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/variable-field/VariableEditor.tsx`
- Test: `apps/dashboard/tests/client/shared/ui/variable-field/VariableEditor.test.tsx`

**Interfaces:**
- Consumes: `tokenize` (Task 2), `detectUnknownTokens` (Task 3), `insertToken`/`getActiveQuery` (Task 4), `filterByQuery` (Task 5), `knownTokenSet` (Task 6); `Popover`/`PopoverAnchor`/`PopoverContent` from `../popover`; `cn` from `../lib/utils`; `useTranslation` from `react-i18next`.
- Produces: default export `VariableEditor` with props:
  ```ts
  interface VariableEditorProps {
    value: string;
    onChange: (value: string) => void;
    variables: VariableDescriptor[];
    multiline?: boolean;
    rows?: number;
    maxLength?: number;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    "aria-label"?: string;
    className?: string;
  }
  ```

**Behavior:** overlay-mirror highlighting (transparent native text + colored backdrop), `{`-triggered combobox (ArrowUp/Down/Enter/Tab/Escape), unknown-token warnings listed under the field via `t`. Uses `common` namespace keys added in Task 20 (`variableField.unknown`, `variableField.didYouMean`, `variableField.noMatches`).

- [ ] **Step 1: Write the failing component test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VariableEditor from "../../../../../src/client/shared/ui/variable-field/VariableEditor";
import type { VariableDescriptor } from "../../../../../src/client/shared/ui/variable-field/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.suggestion ? `${k}:${o.suggestion}` : k) }),
}));

const vars: VariableDescriptor[] = [
  { token: "{user}", example: "@Ada", group: "user", description: "User mention" },
  { token: "{user.name}", example: "Ada", group: "user", description: "Username" },
  { token: "{server}", example: "Acme", group: "server", description: "Server name" },
];

function Harness({ initial = "" }: { initial?: string }) {
  const [v, setV] = (globalThis as unknown as { React: typeof import("react") }).React.useState(initial);
  return <VariableEditor value={v} onChange={setV} variables={vars} aria-label="field" />;
}

describe("VariableEditor", () => {
  it("opens the suggestion list when typing '{' and inserts on Enter", async () => {
    const user = userEvent.setup();
    let current = "";
    const onChange = (val: string) => { current = val; };
    render(<VariableEditor value="" onChange={onChange} variables={vars} aria-label="field" />);
    const input = screen.getByLabelText("field");
    await user.click(input);
    await user.type(input, "{{");
    // listbox appears
    expect(screen.getByRole("listbox")).toBeTruthy();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(current).toContain("{user}");
  });

  it("shows an unknown-variable warning with a suggestion", () => {
    render(<VariableEditor value="hi {membercont}" onChange={() => {}} variables={[{ token: "{membercount}", example: "1,234", group: "server" }]} aria-label="field" />);
    expect(screen.getByText(/variableField\.didYouMean/)).toBeTruthy();
  });
});
```

Note on `user.type(input, "{{")`: in `@testing-library/user-event`, `{{` types a single literal `{`. The suggestion list opens on the resulting `{`.

- [ ] **Step 2: Run to confirm it fails**

Run: `<DTEST> tests/client/shared/ui/variable-field/VariableEditor.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `VariableEditor.tsx`**

```tsx
import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { Popover, PopoverAnchor, PopoverContent } from "../popover";
import { ScrollArea } from "../scroll-area";
import type { VariableDescriptor } from "./types";
import { tokenize } from "./tokens";
import { detectUnknownTokens } from "./validation";
import { insertToken, getActiveQuery } from "./caret";
import { filterByQuery } from "./filterVariables";
import { knownTokenSet } from "./registry";

interface VariableEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: VariableDescriptor[];
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

const SHARED =
  "w-full rounded-sm border border-transparent bg-surface-lowest px-3 text-sm text-text placeholder:text-outline focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[0_0_4px_rgba(163,166,255,0.10)] disabled:cursor-not-allowed disabled:opacity-50";
const INPUT_BOX = "h-9 py-1";
const AREA_BOX = "min-h-[60px] py-2";

export default function VariableEditor(props: VariableEditorProps) {
  const { value, onChange, variables, multiline, rows = 3, maxLength, placeholder, disabled, id } = props;
  const { t } = useTranslation("common");
  const known = React.useMemo(() => knownTokenSet(variables), [variables]);
  const fieldRef = React.useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [queryStart, setQueryStart] = React.useState(0);
  const [active, setActive] = React.useState(0);

  const matches = React.useMemo(() => (open ? filterByQuery(variables, query) : []), [open, query, variables]);
  const unknowns = React.useMemo(() => detectUnknownTokens(value, known), [value, known]);
  const segments = React.useMemo(() => tokenize(value, known), [value, known]);

  React.useEffect(() => {
    if (active >= matches.length) setActive(0);
  }, [matches.length, active]);

  function syncQueryFromCaret() {
    const el = fieldRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    const q = getActiveQuery(el.value, caret);
    if (q) {
      setQuery(q.query);
      setQueryStart(q.start);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  function commit(token: string) {
    const el = fieldRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    const { value: next, cursor } = insertToken(value, queryStart, caret, token);
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) {
    onChange(e.target.value);
    // defer so selectionStart reflects the new value
    requestAnimationFrame(syncQueryFromCaret);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commit(matches[active].token); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  }

  function handleScroll(e: React.UIEvent<HTMLElement>) {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }

  const listboxId = id ? `${id}-listbox` : undefined;

  return (
    <div>
      <Popover open={open && matches.length > 0}>
        <PopoverAnchor asChild>
          <div className={cn("relative", props.className)}>
            <div
              ref={backdropRef}
              aria-hidden="true"
              className={cn(
                SHARED,
                multiline ? AREA_BOX : INPUT_BOX,
                "pointer-events-none absolute inset-0 overflow-hidden border-transparent text-text",
                multiline ? "whitespace-pre-wrap break-words" : "whitespace-pre",
              )}
            >
              {segments.map((seg, i) =>
                seg.type === "var" ? (
                  <span key={i} className={seg.known ? "text-accent" : "text-danger underline decoration-danger/50"}>
                    {seg.value}
                  </span>
                ) : (
                  <span key={i}>{seg.value}</span>
                ),
              )}
              {value.endsWith("\n") ? "\n" : ""}
            </div>
            {multiline ? (
              <textarea
                ref={fieldRef}
                id={id}
                rows={rows}
                value={value}
                maxLength={maxLength}
                placeholder={placeholder}
                disabled={disabled}
                aria-label={props["aria-label"]}
                role="combobox"
                aria-expanded={open && matches.length > 0}
                aria-controls={listboxId}
                aria-autocomplete="list"
                className={cn(SHARED, AREA_BOX, "relative bg-transparent text-transparent caret-text whitespace-pre-wrap break-words")}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                onClick={syncQueryFromCaret}
                onBlur={() => setTimeout(() => setOpen(false), 100)}
              />
            ) : (
              <input
                ref={fieldRef}
                id={id}
                type="text"
                value={value}
                maxLength={maxLength}
                placeholder={placeholder}
                disabled={disabled}
                aria-label={props["aria-label"]}
                role="combobox"
                aria-expanded={open && matches.length > 0}
                aria-controls={listboxId}
                aria-autocomplete="list"
                className={cn(SHARED, INPUT_BOX, "relative bg-transparent text-transparent caret-text")}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                onClick={syncQueryFromCaret}
                onBlur={() => setTimeout(() => setOpen(false), 100)}
              />
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-72 p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <ScrollArea className="max-h-56">
            <ul role="listbox" id={listboxId} className="p-1">
              {matches.map((m, i) => (
                <li
                  key={m.token}
                  role="option"
                  aria-selected={i === active}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm",
                    i === active ? "bg-accent/15 text-text" : "text-text-muted",
                  )}
                  onMouseDown={(e) => { e.preventDefault(); commit(m.token); }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="font-mono text-accent">{m.token}</span>
                  <span className="truncate text-xs">{m.description ?? (m.labelKey ? t(m.labelKey) : "")}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {unknowns.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {unknowns.map((u) => (
            <li key={u.token} className="text-xs text-danger">
              {t("variableField.unknown", { token: u.token })}
              {u.suggestion ? " " + t("variableField.didYouMean", { suggestion: u.suggestion }) : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `<DTEST> tests/client/shared/ui/variable-field/VariableEditor.test.tsx`
Expected: PASS (2 tests). If the harness `React.useState` reference errors, replace the second test's `Harness` usage with the inline-`onChange` pattern already used in the first test (do not rely on a global React).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/variable-field/VariableEditor.tsx apps/dashboard/tests/client/shared/ui/variable-field/VariableEditor.test.tsx
git commit -m "feat(dashboard): add VariableEditor with autocomplete, highlighting, validation"
```

---

### Task 10: `VariableBrowser` component

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/variable-field/VariableBrowser.tsx`
- Test: `apps/dashboard/tests/client/shared/ui/variable-field/VariableBrowser.test.tsx`

**Interfaces:**
- Consumes: `filterByQuery` (Task 5); `Popover`/`PopoverTrigger`/`PopoverContent` from `../popover`; `Input` from `../input`; `Button` from `../button`; `ScrollArea` from `../scroll-area`; `useTranslation`.
- Produces: default export `VariableBrowser` with props `{ variables: VariableDescriptor[]; onInsert: (token: string) => void; label?: string }`. Renders a trigger button that opens a searchable, grouped list; clicking a row calls `onInsert(token)` and closes.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VariableBrowser from "../../../../../src/client/shared/ui/variable-field/VariableBrowser";
import type { VariableDescriptor } from "../../../../../src/client/shared/ui/variable-field/types";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const vars: VariableDescriptor[] = [
  { token: "{user}", example: "@Ada", group: "user", description: "User mention" },
  { token: "{server}", example: "Acme", group: "server", description: "Server name" },
];

describe("VariableBrowser", () => {
  it("opens, filters, and inserts a token", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(<VariableBrowser variables={vars} onInsert={onInsert} />);
    await user.click(screen.getByRole("button"));
    const search = screen.getByRole("searchbox");
    await user.type(search, "serv");
    await user.click(screen.getByText("{server}"));
    expect(onInsert).toHaveBeenCalledWith("{server}");
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `<DTEST> tests/client/shared/ui/variable-field/VariableBrowser.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `VariableBrowser.tsx`**

```tsx
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverTrigger, PopoverContent } from "../popover";
import { Button } from "../button";
import { Input } from "../input";
import { ScrollArea } from "../scroll-area";
import { Icon } from "../../components/Icon";
import type { VariableDescriptor } from "./types";
import { filterByQuery } from "./filterVariables";

interface VariableBrowserProps {
  variables: VariableDescriptor[];
  onInsert: (token: string) => void;
  label?: string;
}

export default function VariableBrowser({ variables, onInsert, label }: VariableBrowserProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const matches = React.useMemo(() => filterByQuery(variables, query), [variables, query]);

  function pick(token: string) {
    onInsert(token);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs">
          <Icon name="add" className="size-3.5" />
          {label ?? t("variableField.insert")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <Input
          type="search"
          role="searchbox"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("variableField.search")}
          className="mb-2"
        />
        <ScrollArea className="max-h-64">
          <ul className="space-y-0.5">
            {matches.length === 0 && (
              <li className="px-2 py-3 text-center text-xs text-text-muted">{t("variableField.noMatches")}</li>
            )}
            {matches.map((m) => (
              <li key={m.token}>
                <button
                  type="button"
                  onClick={() => pick(m.token)}
                  className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent/10"
                >
                  <span className="font-mono text-accent">{m.token}</span>
                  <span className="truncate text-xs text-text-muted">{m.description ?? (m.labelKey ? t(m.labelKey) : "")}</span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
```

**Note:** confirm `Button` accepts `variant`/`size` and `Icon` accepts `name="add"` (used elsewhere in the app). If the icon name differs, use an existing name such as `"plus"` per `Icon.tsx`'s map.

- [ ] **Step 4: Run to confirm pass**

Run: `<DTEST> tests/client/shared/ui/variable-field/VariableBrowser.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/variable-field/VariableBrowser.tsx apps/dashboard/tests/client/shared/ui/variable-field/VariableBrowser.test.tsx
git commit -m "feat(dashboard): add searchable VariableBrowser popover"
```

---

### Task 11: `usePreviewContext` hook

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/variable-field/usePreviewContext.ts`
- Test: `apps/dashboard/tests/client/shared/ui/variable-field/usePreviewContext.test.tsx`

**Interfaces:**
- Consumes: `useAuth` from `../../hooks/useAuth`, `useGuilds` from `../../hooks/useGuilds`, `buildRealData` (Task 6).
- Produces: `function usePreviewContext(guildId: string): PreviewRealData` — finds the guild by id in `useGuilds()`, reads the current user from `useAuth()`, returns `buildRealData(guild, user)`.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("../../../../../src/client/shared/hooks/useAuth", () => ({
  useAuth: () => ({ data: { userId: "7", username: "Ada", avatar: "def" } }),
}));
vi.mock("../../../../../src/client/shared/hooks/useGuilds", () => ({
  useGuilds: () => ({ data: [{ id: "42", name: "Acme", icon: "abc" }] }),
}));

import { usePreviewContext } from "../../../../../src/client/shared/ui/variable-field/usePreviewContext";

describe("usePreviewContext", () => {
  it("assembles real data from the matching guild and current user", () => {
    const { result } = renderHook(() => usePreviewContext("42"));
    expect(result.current.serverName).toBe("Acme");
    expect(result.current.userName).toBe("Ada");
  });
  it("falls back to defaults when the guild is not found", () => {
    const { result } = renderHook(() => usePreviewContext("999"));
    expect(result.current.serverName).toBe("My Server");
  });
});
```

**Note:** confirm the exact hook file names/exports (`useAuth`, `useGuilds`) and that `useGuilds` returns `{ data }`. Adjust the mock paths/shapes to match the real hooks (the exploration confirmed `useAuth()` → `{ userId, username, avatar }` and `useGuilds()` → `Guild[]`; verify whether they return the raw value or a `{ data }` query object and align `usePreviewContext` accordingly).

- [ ] **Step 2: Run to confirm it fails**

Run: `<DTEST> tests/client/shared/ui/variable-field/usePreviewContext.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `usePreviewContext.ts`**

```ts
import { useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useGuilds } from "../../hooks/useGuilds";
import { buildRealData } from "./registry";
import type { PreviewRealData } from "./types";

export function usePreviewContext(guildId: string): PreviewRealData {
  const auth = useAuth();
  const guilds = useGuilds();
  return useMemo(() => {
    const user = auth.data ? { userId: auth.data.userId, username: auth.data.username, avatar: auth.data.avatar } : undefined;
    const guild = (guilds.data ?? []).find((g) => g.id === guildId);
    return buildRealData(guild, user);
  }, [auth.data, guilds.data, guildId]);
}
```

**Adjust** the `.data` access to match the real return shapes verified in the Step 1 note (e.g. if `useAuth()` returns the user object directly rather than a query result).

- [ ] **Step 4: Run to confirm pass**

Run: `<DTEST> tests/client/shared/ui/variable-field/usePreviewContext.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/variable-field/usePreviewContext.ts apps/dashboard/tests/client/shared/ui/variable-field/usePreviewContext.test.tsx
git commit -m "feat(dashboard): add usePreviewContext hook"
```

---

### Task 12: `DiscordMessagePreview` component

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/variable-field/DiscordMessagePreview.tsx`
- Test: `apps/dashboard/tests/client/shared/ui/variable-field/DiscordMessagePreview.test.tsx`

**Interfaces:**
- Consumes: `resolveTemplatePreview` (Task 8), `buildTokenValues` (Task 6); `PreviewRealData`, `VariableDescriptor`.
- Produces: default export `DiscordMessagePreview` with props:
  ```ts
  interface DiscordEmbedInput { title?: string; description?: string; footer?: string; thumbnail?: string; color?: number }
  interface DiscordMessagePreviewProps {
    variables: VariableDescriptor[];
    real: PreviewRealData;
    content?: string;      // plain message content
    embed?: DiscordEmbedInput;
  }
  ```
  Resolves each text field via `resolveTemplatePreview(field, buildTokenValues(variables, real))` and renders a Discord-style bubble: avatar + username + timestamp; when `embed` has any content, a left color bar + title/description/footer/thumbnail.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DiscordMessagePreview from "../../../../../src/client/shared/ui/variable-field/DiscordMessagePreview";
import { welcomeVariables, buildRealData } from "../../../../../src/client/shared/ui/variable-field/registry";

const real = buildRealData({ id: "42", name: "Acme", icon: null }, { userId: "7", username: "Ada", avatar: null });

describe("DiscordMessagePreview", () => {
  it("renders resolved message content", () => {
    render(<DiscordMessagePreview variables={welcomeVariables} real={real} content="Hey {user}, welcome to {server}!" />);
    expect(screen.getByText("Hey @Ada, welcome to Acme!")).toBeTruthy();
  });
  it("renders an embed title and description", () => {
    render(
      <DiscordMessagePreview
        variables={welcomeVariables}
        real={real}
        embed={{ title: "Welcome to {server}!", description: "Member #{membercount}" }}
      />,
    );
    expect(screen.getByText("Welcome to Acme!")).toBeTruthy();
    expect(screen.getByText("Member #1,234")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `<DTEST> tests/client/shared/ui/variable-field/DiscordMessagePreview.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `DiscordMessagePreview.tsx`**

```tsx
import * as React from "react";
import type { PreviewRealData, VariableDescriptor } from "./types";
import { buildTokenValues } from "./registry";
import { resolveTemplatePreview } from "./resolvePreview";

interface DiscordEmbedInput {
  title?: string;
  description?: string;
  footer?: string;
  thumbnail?: string;
  color?: number;
}
interface DiscordMessagePreviewProps {
  variables: VariableDescriptor[];
  real: PreviewRealData;
  content?: string;
  embed?: DiscordEmbedInput;
}

function hexColor(color: number | undefined): string {
  if (color === undefined) return "#a3a6ff";
  return "#" + color.toString(16).padStart(6, "0");
}

export default function DiscordMessagePreview({ variables, real, content, embed }: DiscordMessagePreviewProps) {
  const values = React.useMemo(() => buildTokenValues(variables, real), [variables, real]);
  const resolve = React.useCallback((s?: string) => (s ? resolveTemplatePreview(s, values) : ""), [values]);

  const hasEmbed = !!(embed && (embed.title || embed.description || embed.footer || embed.thumbnail));
  const resolvedContent = resolve(content);
  const thumb = resolve(embed?.thumbnail);

  return (
    <div className="rounded-md bg-surface-container p-3 text-sm">
      <div className="flex gap-3">
        <img src={real.userAvatar} alt="" className="size-10 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-text">{real.userName}</span>
            <span className="text-[10px] text-text-muted">today</span>
          </div>
          {resolvedContent && <p className="whitespace-pre-wrap break-words text-text">{resolvedContent}</p>}
          {hasEmbed && (
            <div
              className="mt-1 flex gap-3 rounded-sm bg-surface-lowest p-3"
              style={{ borderInlineStart: `4px solid ${hexColor(embed?.color)}` }}
            >
              <div className="min-w-0 flex-1">
                {embed?.title && <div className="font-semibold text-text">{resolve(embed.title)}</div>}
                {embed?.description && (
                  <div className="whitespace-pre-wrap break-words text-text-muted">{resolve(embed.description)}</div>
                )}
                {embed?.footer && <div className="mt-2 text-[10px] text-text-muted">{resolve(embed.footer)}</div>}
              </div>
              {thumb && /^https?:\/\//.test(thumb) && <img src={thumb} alt="" className="size-16 rounded-sm object-cover" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `<DTEST> tests/client/shared/ui/variable-field/DiscordMessagePreview.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/variable-field/DiscordMessagePreview.tsx apps/dashboard/tests/client/shared/ui/variable-field/DiscordMessagePreview.test.tsx
git commit -m "feat(dashboard): add Discord-style message/embed preview"
```

---

### Task 13: Barrel export + i18n chrome keys

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/variable-field/index.ts`
- Modify: `packages/i18n/src/locales/en/common.json`

**Interfaces:**
- Produces: barrel re-exporting `VariableEditor` (default→named `VariableEditor`), `VariableBrowser`, `DiscordMessagePreview`, `usePreviewContext`, all registry members, `buildAutomationVariables`, and types.

- [ ] **Step 1: Write `index.ts`**

```ts
export { default as VariableEditor } from "./VariableEditor";
export { default as VariableBrowser } from "./VariableBrowser";
export { default as DiscordMessagePreview } from "./DiscordMessagePreview";
export { usePreviewContext } from "./usePreviewContext";
export {
  welcomeVariables,
  customCommandVariables,
  levelingVariables,
  tempvoiceVariables,
  knownTokenSet,
  buildRealData,
  buildTokenValues,
} from "./registry";
export { buildAutomationVariables } from "./automationVariables";
export type { VariableDescriptor, VariableGroup, PreviewRealData, RealDataKey } from "./types";
```

- [ ] **Step 2: Add chrome keys to `common.json`**

Add a `variableField` object under the appropriate top-level key in `packages/i18n/src/locales/en/common.json` (place alongside existing sibling keys; keep JSON valid):

```json
"variableField": {
  "insert": "Insert variable",
  "search": "Search variables…",
  "noMatches": "No matches",
  "unknown": "Unknown variable {{token}}",
  "didYouMean": "did you mean {{suggestion}}?",
  "preview": "Preview",
  "notAvailable": "{{token}} isn't available for {{event}}"
}
```

- [ ] **Step 3: Typecheck the module**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/dashboard exec tsc -p tsconfig.client.json --noEmit`
Expected: no errors from `variable-field/**`.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/variable-field/index.ts packages/i18n/src/locales/en/common.json
git commit -m "feat(dashboard): barrel export variable-field + i18n chrome keys"
```

---

## Phase 3 — Rollout

Each rollout task swaps native fields for `VariableEditor`, adds a preview + browser, removes static hint text, and ends with a typecheck. There are no per-file unit tests for the swaps (behavior is covered by Phase 1–2 tests); the deliverable gate is a clean typecheck + the full suite still green.

### Task 14: Welcome / Farewell / DM (`welcome.tsx`)

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/welcome.tsx`

**Interfaces:**
- Consumes: `VariableEditor`, `VariableBrowser`, `DiscordMessagePreview`, `usePreviewContext`, `welcomeVariables` from `../../../shared/ui/variable-field`.

- [ ] **Step 1: Import the module**

Add to the imports block:
```ts
import {
  VariableEditor,
  VariableBrowser,
  DiscordMessagePreview,
  usePreviewContext,
  welcomeVariables,
} from "../../../shared/ui/variable-field";
```

- [ ] **Step 2: Thread preview data into `EmbedEditor`**

In the `EmbedEditor` component, add a `real` prop of type `PreviewRealData` (import the type) and accept it from the parent. In the page component (which has `guildId`), compute `const real = usePreviewContext(guildId);` and pass `real={real}` to each `EmbedEditor`.

- [ ] **Step 3: Replace the four fields**

Replace the title `Input` (lines ~61-67) with:
```tsx
<VariableEditor
  id="embed-title"
  value={value.title ?? ""}
  onChange={(v) => onChange({ ...value, title: v || undefined })}
  variables={welcomeVariables}
  placeholder={t("embed.titlePlaceholder")}
  maxLength={256}
/>
```
Replace the description `Textarea` (lines ~70-77) with the same but `multiline rows={3}` and `title`→`description`, `maxLength={4096}`.
Replace the footer `Input` (lines ~95-101) → `VariableEditor` (single-line, `maxLength={2048}`, `footer`).
Replace the thumbnail `Input` (lines ~106-112) → `VariableEditor` (single-line, `thumbnail`, keep placeholder `"{user.avatar}"`).

- [ ] **Step 4: Replace static hint with the browser + add preview**

Delete the static `<p>` hint (lines ~124-127). Add, near the fields:
```tsx
<VariableBrowser variables={welcomeVariables} onInsert={(tok) => onChange({ ...value, description: (value.description ?? "") + tok })} />
```
And below the embed fields render:
```tsx
<DiscordMessagePreview
  variables={welcomeVariables}
  real={real}
  embed={{ title: value.title, description: value.description, footer: value.footer, thumbnail: value.thumbnail, color: value.color }}
/>
```
(Use the field names actually present on `EmbedConfig`; if `color` is absent, omit it.)

- [ ] **Step 5: Typecheck**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/dashboard exec tsc -p tsconfig.client.json --noEmit`
Expected: no new errors in `welcome.tsx`.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/client/routes/guild/\$guildId/welcome.tsx
git commit -m "feat(dashboard): variable editor + preview in welcome/farewell/DM"
```

---

### Task 15: Custom commands (`commands.tsx`)

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/commands.tsx`

- [ ] **Step 1: Import**
```ts
import {
  VariableEditor,
  VariableBrowser,
  DiscordMessagePreview,
  usePreviewContext,
  customCommandVariables,
} from "../../../shared/ui/variable-field";
```
Add `const real = usePreviewContext(guildId);` in the component body.

- [ ] **Step 2: Replace fields**

- `cmd-content` Textarea (lines ~495-504) → `VariableEditor multiline rows={4}` bound to `formContent`/`setFormContent` (keep `markDirty()`), `variables={customCommandVariables}`.
- `embed-title` Input (~510-518) → single-line `VariableEditor` bound to `formEmbedTitle`.
- `embed-desc` Textarea (~524-533) → `VariableEditor multiline rows={3}` bound to `formEmbedDescription`.
- `embed-footer` Input (~550-558) → single-line `VariableEditor` bound to `formEmbedFooter`.

Each `onChange` receives the string directly, e.g.:
```tsx
onChange={(v) => { setFormContent(v); markDirty(); }}
```

- [ ] **Step 3: Replace the VARIABLE_HELP tab hint & add browser + preview**

Keep the "Variables" tab table (it documents tokens) but also add a `VariableBrowser variables={customCommandVariables}` next to the content field for insert-at-cursor, and a `DiscordMessagePreview variables={customCommandVariables} real={real} content={formContent} embed={{ title: formEmbedTitle, description: formEmbedDescription, footer: formEmbedFooter }}` inside the dialog.

- [ ] **Step 4: Typecheck**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/dashboard exec tsc -p tsconfig.client.json --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**
```bash
git add apps/dashboard/src/client/routes/guild/\$guildId/commands.tsx
git commit -m "feat(dashboard): variable editor + preview in custom commands"
```

---

### Task 16: Scheduled messages (`scheduled.tsx`)

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/scheduled.tsx`

Scheduled messages fire on a timer (no triggering member), so use `welcomeVariables` (server-scoped subset is meaningful; `{user}`-style tokens resolve to sample values).

- [ ] **Step 1: Import** the module + `welcomeVariables`; add `const real = usePreviewContext(guildId);`.
- [ ] **Step 2: Replace fields:**
  - `msg-content` Textarea (~597-604) → `VariableEditor multiline rows={5}` bound to `form.textContent` via `updateForm({ textContent: v })`, `maxLength={2000}`.
  - `embed-title` (~614-619), `embed-description` (~623-629, multiline rows={4}), `embed-footer` (~640-646) → `VariableEditor`. Leave `embed-thumbnail` (~652-657) as-is (URL field) OR convert to single-line `VariableEditor` for consistency.
- [ ] **Step 3:** Add `VariableBrowser` by the content field and a `DiscordMessagePreview` in the dialog (`content={form.textContent}`, `embed={{ title: form.embedTitle, description: form.embedDescription, footer: form.embedFooter, thumbnail: form.embedThumbnail }}`).
- [ ] **Step 4: Typecheck** (same command). Expected: no new errors.
- [ ] **Step 5: Commit**
```bash
git add apps/dashboard/src/client/routes/guild/\$guildId/scheduled.tsx
git commit -m "feat(dashboard): variable editor + preview in scheduled messages"
```

---

### Task 17: Leveling announce (`leveling.tsx`)

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/leveling.tsx`

- [ ] **Step 1: Import** `VariableEditor`, `VariableBrowser`, `DiscordMessagePreview`, `usePreviewContext`, `levelingVariables`; add `const real = usePreviewContext(guildId);`.
- [ ] **Step 2: Replace** the announce `Textarea` (~516-526) with:
```tsx
<VariableEditor
  multiline
  value={settings.announceMessage}
  onChange={(v) => handleAnnounceMessageChange(v)}
  variables={levelingVariables}
  placeholder={t("settings.announceMessagePlaceholder")}
/>
```
Remove the static `<p>{t("settings.announceMessageVars")}</p>` hint; add `<VariableBrowser variables={levelingVariables} onInsert={(tok) => handleAnnounceMessageChange(settings.announceMessage + tok)} />`.
- [ ] **Step 3: Add inline preview:** `<DiscordMessagePreview variables={levelingVariables} real={real} content={settings.announceMessage} />`.
- [ ] **Step 4: Typecheck.** Expected: no new errors.
- [ ] **Step 5: Commit**
```bash
git add apps/dashboard/src/client/routes/guild/\$guildId/leveling.tsx
git commit -m "feat(dashboard): variable editor + preview in leveling announce"
```

---

### Task 18: TempVoice name template (`TempVoiceForm.tsx`)

**Files:**
- Modify: `apps/dashboard/src/client/features/tempvoice/components/TempVoiceForm.tsx`

- [ ] **Step 1: Import** `VariableEditor`, `usePreviewContext`, `tempvoiceVariables` from `../../../shared/ui/variable-field`; add `const real = usePreviewContext(guildId);`.
- [ ] **Step 2: Replace** the `nameTemplate` `Input` (~247-259) with a single-line `VariableEditor`:
```tsx
<VariableEditor
  id="tempvoice-name-template"
  value={nameTemplate}
  onChange={setNameTemplate}
  variables={tempvoiceVariables}
  placeholder={t("form.defaultNameTemplate")}
  maxLength={100}
/>
```
Keep the `{t("form.nameTemplateHint")}` line or replace with a `VariableBrowser`.
- [ ] **Step 3: Inline preview** (channel-name style — plain text is fine): render the resolved template, e.g.
```tsx
<p className="mt-1 text-xs text-text-muted">
  {t("common:variableField.preview")}: {nameTemplate.replace("{user}", real.userName)}
</p>
```
(or reuse `resolveTemplatePreview` + `buildTokenValues(tempvoiceVariables, real)` for correctness).
- [ ] **Step 4: Typecheck.** Expected: no new errors.
- [ ] **Step 5: Commit**
```bash
git add apps/dashboard/src/client/features/tempvoice/components/TempVoiceForm.tsx
git commit -m "feat(dashboard): variable editor + preview in tempvoice name template"
```

---

### Task 19: Automation — thread eventType + swap action fields (`ActionFields.tsx`, `NodeDetailPanel.tsx`, `WorkflowEditor.tsx`)

**Files:**
- Modify: `apps/dashboard/src/client/features/automation/components/ActionFields.tsx`
- Modify: `apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx`
- Modify: `apps/dashboard/src/client/features/automation/workflow/WorkflowEditor.tsx`

**Interfaces:**
- Consumes: `VariableEditor`, `buildAutomationVariables`; the already-fetched `constants` (`useConstants()`), the workflow `eventType`.
- Produces: `ActionFields` accepts a new `variables: VariableDescriptor[]` prop and renders `VariableEditor` for variable-bearing fields.

- [ ] **Step 1: Add a variable-field allowlist to `ActionFields.tsx`**

At the top of the module:
```ts
import { VariableEditor } from "../../../shared/ui/variable-field";
import type { VariableDescriptor } from "../../../shared/ui/variable-field";

const VARIABLE_FIELD_KEYS = new Set([
  "message",
  "embed.title",
  "embed.description",
  "embed.footer",
  "webhook.bodyTemplate",
  "nickname",
  "threadName",
]);
```

- [ ] **Step 2: Add `variables` to `ActionFieldsProps`**
```ts
interface ActionFieldsProps {
  fields: ActionFieldDescriptor[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  channels: Channel[];
  roles: Role[];
  variables: VariableDescriptor[];
}
```

- [ ] **Step 3: Render `VariableEditor` for variable-bearing text/textarea fields**

In the `text` and `textarea` branches, when `VARIABLE_FIELD_KEYS.has(field.key)`, render:
```tsx
<VariableEditor
  id={field.key}
  value={String(value ?? "")}
  onChange={(v) => onChange(field.key, v)}
  variables={variables}
  multiline={field.type === "textarea"}
  placeholder={field.placeholder}
  maxLength={field.maxLength}
/>
```
Otherwise keep the existing `<Input>`/`<Textarea>`.

- [ ] **Step 4: Thread `eventType` to `ActionPanel` → `ActionFields`**

In `NodeDetailPanel.tsx`, add `eventType: string` to `ActionPanelProps`. In `ActionPanel`, compute:
```ts
import { buildAutomationVariables } from "../../../shared/ui/variable-field";
const variables = buildAutomationVariables(constants, eventType);
```
Pass `variables={variables}` into `<ActionFields …/>` (the render around lines ~299-305).

In `WorkflowEditor.tsx`, where the action node renders `<NodeDetailPanel type="action" …/>` (lines ~592-605), add `eventType={eventType}` (the state variable already declared at ~line 101).

- [ ] **Step 5: Typecheck**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/dashboard exec tsc -p tsconfig.client.json --noEmit`
Expected: no new errors; `ActionFields` callers updated to pass `variables`.

- [ ] **Step 6: Commit**
```bash
git add apps/dashboard/src/client/features/automation/components/ActionFields.tsx apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx apps/dashboard/src/client/features/automation/workflow/WorkflowEditor.tsx
git commit -m "feat(automation): event-scoped variable editor in action fields"
```

---

### Task 20: Automation message preview (independent)

**Files:**
- Modify: `apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx`

Add a `DiscordMessagePreview` in `ActionPanel` for message-producing action types (`sendMessage`, `sendEmbed`, `sendDM`).

- [ ] **Step 1: Import** `DiscordMessagePreview`, `usePreviewContext` from `../../../shared/ui/variable-field`. In `ActionPanel`, `const real = usePreviewContext(guildId);`.
- [ ] **Step 2: Render** below `ActionFields`, gated on action type:
```tsx
{(action.type === "sendMessage" || action.type === "sendDM") && (
  <DiscordMessagePreview variables={variables} real={real} content={String((action as Record<string, unknown>).message ?? "")} />
)}
{action.type === "sendEmbed" && (
  <DiscordMessagePreview
    variables={variables}
    real={real}
    embed={{
      title: String((action as Record<string, unknown>)["embed.title"] ?? ""),
      description: String((action as Record<string, unknown>)["embed.description"] ?? ""),
      footer: String((action as Record<string, unknown>)["embed.footer"] ?? ""),
    }}
  />
)}
```
Adjust property access to the actual `ActionConfig` shape (embed fields may be nested under `action.embed` rather than dotted keys — verify and use the real shape).

- [ ] **Step 3: Typecheck.** Expected: no new errors.
- [ ] **Step 4: Commit**
```bash
git add apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx
git commit -m "feat(automation): Discord preview for message/embed/DM actions"
```

---

### Task 21: Feature-scope i18n descriptions + final verification

**Files:**
- Modify: `packages/i18n/src/locales/en/welcome.json`, `.../leveling.json`, `.../tempvoice.json`, `.../commands.json` (create keys referenced by registry `labelKey`s where missing)

- [ ] **Step 1: Add missing description keys**

For each registry `labelKey` not already present, add the English string. Welcome (`welcome.json`) needs a `variables` object:
```json
"variables": {
  "user": "Mentions the member",
  "userTag": "The member's tag (name#0001)",
  "userName": "The member's username",
  "userId": "The member's ID",
  "userAvatar": "The member's avatar URL",
  "server": "The server name",
  "serverId": "The server ID",
  "memberCount": "Current member count",
  "serverIcon": "The server icon URL"
}
```
Leveling (`leveling.json`): `"variables": { "user": "Mentions the member", "level": "The level reached" }`.
TempVoice (`tempvoice.json`): `"variables": { "user": "The member's name" }`.
Commands (`commands.json`): the registry reuses existing `variables.entries.*` keys — confirm they exist; add any missing.

- [ ] **Step 2: Run the FULL dashboard test suite**

Run: `docker compose --profile bot run --rm bot pnpm --filter @fluxcore/dashboard test`
Expected: all tests PASS (Phase 1–2 suites + smoke).

- [ ] **Step 3: Full client typecheck**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/dashboard exec tsc -p tsconfig.client.json --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**
```bash
git add packages/i18n/src/locales/en/welcome.json packages/i18n/src/locales/en/leveling.json packages/i18n/src/locales/en/tempvoice.json packages/i18n/src/locales/en/commands.json
git commit -m "feat(i18n): variable descriptions for welcome/leveling/tempvoice/commands"
```

---

## Self-Review

**Spec coverage:**
- Autocomplete on `{` → Tasks 4, 5, 9. Variable browser → Task 10. Inline highlighting → Task 9 (overlay). Unknown-variable validation → Tasks 3, 9. Event-scope awareness → Task 7 + 19 (via `eventTypeVariables`). Live Discord preview (hybrid) → Tasks 6, 8, 11, 12. Rollout to all fields → Tasks 14–20. i18n → Tasks 13, 21. Accessibility (combobox ARIA, aria-hidden overlay) → Task 9. Non-goal (no token renaming) honored — registry surfaces each field's existing tokens. All spec sections map to tasks.

**Placeholder scan:** No "TBD/TODO/implement later". Rollout tasks show the exact replacement JSX; a few carry explicit "verify the real shape" notes (guild/user hook return shape; `ActionConfig` embed nesting; `Icon` name) — these are verification instructions, not missing content.

**Type consistency:** `VariableDescriptor` (with optional `description`) is defined in Task 2 and used identically in Tasks 5–12, 19. `buildTokenValues`/`buildRealData`/`knownTokenSet` signatures match between Task 6 (definition) and Tasks 9, 11, 12 (use). `resolveTemplatePreview(template, Map)` matches between Task 8 and Task 12. `buildAutomationVariables(constants, eventType)` matches between Task 7 and Task 19. `insertToken`/`getActiveQuery` signatures match Task 4 ↔ Task 9.

**Known execution risks (flagged, not blockers):**
1. Guild/user hook return shape (`{ data }` vs raw) — Task 11 Step 1 note instructs verifying before finalizing.
2. `@fluxcore/systems` subpath resolution in the drift test — Task 6 note gives the `pnpm --filter @fluxcore/systems build` fallback.
3. Overlay-mirror alignment (font/padding parity) is visual; unit tests cover logic, not pixel alignment — verify visually via the running app after Task 14.
4. `Icon` name / `Button` variant props — Task 10 note instructs confirming against existing usage.
