# FluxCore Documentation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the machinery that generates FluxCore's documentation — a Fumadocs site at `apps/docs/`, a source-derived manifest, and a `.claude` kit that writes and verifies pages — then prove it on one calibration page.

**Architecture:** A read-only inventory pass scans source and emits `apps/docs/_manifest.json`, which is the single source of truth for what must be documented. Page generation is driven off that manifest one page at a time, guarded by a hook that blocks any page referencing a file path that does not exist. Docs build to static output served by the existing Caddy.

**Tech Stack:** Fumadocs (Next.js + React + Tailwind, MDX), Node ESM scripts, Vitest, bash + jq hooks, Turborepo, Docker.

**Spec:** `docs/superpowers/specs/2026-07-29-documentation-system-design.md`

**Branch:** `docs/documentation-system` (already created, spec already committed as `50fe337`)

## Scope

This plan builds the **machinery plus one calibration page**. It does not contain a task per documentation page — ~70 near-identical tasks would be unreviewable, and the spec calls for calibrating on the first feature guide before committing to the full run. Bulk content is produced afterward by repeated `/document-system` invocations.

## Global Constraints

Every task's requirements implicitly include these. Copied from the spec.

- **All `pnpm add/install` runs inside Docker.** Host `node_modules` are root-owned. The `guard-pnpm.sh` PreToolUse hook enforces this and will block a bare `pnpm add`.
- **Source is truth.** `CLAUDE.md`, `docs/PROJECT_INDEX.md`, `docs/features/*.md`, and `docs/implementation-plan.md` are unverified inputs — useful for intent and naming, never citable as fact. All four are known wrong on paths, status, or both.
- **No invention.** Never state a command option, env var, default, or permission not read in source.
- **Verify Fumadocs against live documentation** before writing any Fumadocs config. Do not reproduce it from memory.
- **Docs prose is English only.** The 48-locale rule covers app i18n keys, not documentation.
- **Static export.** No new service in `docker-compose.prod.yml`.
- **No Playwright capture pipeline.** Screenshots are placeholders plus a manual checklist.
- **Strict TypeScript, no `any`, no `as` casts — including in test files.**
- **Style:** never write "simply", "just", "easy", or "obviously" in documentation prose.

## Verified facts (2026-07-29)

Use these; do not re-derive from `CLAUDE.md`.

| Thing | Count | Location |
|---|---|---|
| Slash command files | 38 | `apps/bot/src/features/<module>/commands/*.ts` |
| Bot feature modules | 9 | `apps/bot/src/features/*/` |
| Gateway event handlers | 21 | `apps/bot/src/events/*.ts` |
| Dashboard API features | 18 | `apps/dashboard/src/server/features/*/` |
| Dashboard client features | 19 | `apps/dashboard/src/client/features/*/` |
| Dashboard guild pages | 18 | `apps/dashboard/src/client/routes/guild/$guildId/*.tsx` |
| Shared systems | 16 | `packages/systems/src/*/` |
| Prisma models | 41 | `packages/database/prisma/schema.prisma` |
| Env vars | 16 | `.env.example` |
| Locales | 48 | `packages/i18n/src/locales/*/` |

Route names do not match feature names: `rules.tsx` is the `automation` feature, `logs.tsx` is `logging`.

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `apps/docs/package.json` | Workspace manifest, docs scripts |
| `apps/docs/next.config.mjs` | Next config, static export |
| `apps/docs/source.config.ts` | Fumadocs MDX source config |
| `apps/docs/app/**` | Next App Router pages, Fumadocs layout |
| `apps/docs/content/**` | The MDX documentation itself |
| `apps/docs/styles/obsidian.css` | Obsidian Engine tokens as CSS variables |
| `apps/docs/components/ScreenshotPlaceholder.tsx` | Renders an image slot, never a broken image |
| `apps/docs/scripts/manifest/status.mjs` | `deriveStatus()` — the shipped/planned/partial rule |
| `apps/docs/scripts/manifest/scan.mjs` | Source scanners producing manifest sections |
| `apps/docs/scripts/manifest/build.mjs` | CLI entry: writes `_manifest.json` + `SCREENSHOTS.md` |
| `apps/docs/scripts/check-coverage.mjs` | Asserts manifest↔page parity both directions |
| `apps/docs/scripts/verify-doc-paths.mjs` | `extractRepoPaths()` / `findMissingPaths()` |
| `apps/docs/tests/*.test.ts` | Vitest unit tests for all of the above |
| `apps/docs/vitest.config.ts` | Test config |
| `.claude/hooks/docs-path-guard.sh` | PreToolUse wrapper around `verify-doc-paths.mjs` |
| `.claude/hooks/docs-freshness.sh` | Stop hook: manifest commit vs `HEAD` |
| `.claude/agents/docs-inventory.md` | Phase 1 agent, read-only |
| `.claude/agents/docs-writer.md` | Phase 2 agent, one page |
| `.claude/agents/docs-verifier.md` | Adversarial claim checker |
| `.claude/commands/document-system.md` | `/document-system` orchestrator |
| `docs/superpowers/prompts/docs-standing-rules.md` | Shared rules block |

**Modified:** `turbo.json` (docs tasks), `package.json` (docker-wrapped docs scripts), `.claude/settings.json` (two hooks).

Scripts are `.mjs` with pure exported functions so Vitest can test them without a Next.js runtime.

---

### Task 1: Scaffold `apps/docs` as a Fumadocs workspace

**Files:**
- Create: `apps/docs/package.json`, `apps/docs/next.config.mjs`, `apps/docs/source.config.ts`, `apps/docs/app/`, `apps/docs/content/index.mdx`, `apps/docs/tsconfig.json`
- Modify: `turbo.json`, `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: a buildable `@fluxcore/docs` workspace; `pnpm docs:build` emits static HTML

- [ ] **Step 1: Verify the current Fumadocs setup against live documentation**

Do this before writing any config. Fetch the official Fumadocs quick-start and confirm, for the current version:
- exact package names and versions to install
- whether `source.config.ts` is still the MDX config entry point
- the Tailwind 4 integration method
- the static-export configuration
- how search is configured for a **static** (non-server) deployment

Record what you find in a scratch note. If any of it contradicts this plan's later steps, **the live documentation wins** — update the step and note the deviation. Do not proceed on memory.

- [ ] **Step 2: Install dependencies inside Docker**

```bash
docker compose --profile bot run --rm --no-deps bot \
  pnpm --filter @fluxcore/docs add <packages verified in Step 1>
```

A bare `pnpm add` is blocked by `guard-pnpm.sh`.

- [ ] **Step 3: Configure static export**

In `apps/docs/next.config.mjs`, set the static export output mode confirmed in Step 1. Static export is a hard requirement — the site is served by the existing Caddy, and no service may be added to `docker-compose.prod.yml`.

- [ ] **Step 4: Add a single placeholder page**

Create `apps/docs/content/index.mdx` with a heading and one paragraph. This exists only to give the build something to render.

- [ ] **Step 5: Register the workspace with Turborepo**

Add to `turbo.json` under `tasks`:

```json
    "docs:build": {
      "dependsOn": ["^build"],
      "outputs": ["out/**", ".next/**"]
    },
    "docs:dev": {
      "cache": false,
      "persistent": true
    }
```

Add to root `package.json` under `scripts`, matching the existing Docker-wrapped pattern:

```json
    "docs:build": "docker compose --profile bot run --rm --no-deps bot pnpm turbo run docs:build --filter=@fluxcore/docs",
    "docs:dev": "docker compose --profile bot run --rm --no-deps -p 3001:3001 bot pnpm --filter @fluxcore/docs dev"
```

- [ ] **Step 6: Verify the build produces static output**

Run: `pnpm docs:build`
Expected: exits 0, and `apps/docs/out/index.html` exists.

```bash
test -f apps/docs/out/index.html && echo "STATIC OUTPUT OK" || echo "FAILED"
```

If this prints `FAILED`, the export mode from Step 3 is wrong. Fix it before continuing — every later task assumes static output works.

- [ ] **Step 7: Confirm search works on static output**

This is the spec's highest-priority open risk. Configure search per Step 1's findings, build, and confirm the search index file is emitted into `out/`. A 70-page site without search is close to unusable, and discovering this at page 60 is expensive.

If static search cannot be made to work, **stop and report** rather than proceeding — it changes the deployment decision.

- [ ] **Step 8: Commit**

```bash
git add apps/docs turbo.json package.json pnpm-lock.yaml
git commit -m "feat(docs): scaffold Fumadocs workspace with static export"
```

---

### Task 2: Apply Obsidian Engine tokens

**Files:**
- Create: `apps/docs/styles/obsidian.css`
- Modify: `apps/docs/app/layout.tsx` (import the stylesheet)

**Interfaces:**
- Consumes: Task 1's working build
- Produces: CSS custom properties consumed by all later pages

- [ ] **Step 1: Port the tokens**

Copy values verbatim from `design.md`. Do not invent or adjust any hex value.

```css
:root {
  --fc-background: #0e0e10;
  --fc-primary: #a3a6ff;
  --fc-primary-dim: #6063ee;
  --fc-secondary: #ac8aff;
  --fc-on-primary: #0f00a4;

  --fc-surface-lowest: #000000;
  --fc-surface-low: #131315;
  --fc-surface-container: #19191c;
  --fc-surface-high: #1f1f22;
  --fc-surface-hover: #262528;
  --fc-surface-bright: #2c2c2f;

  --fc-danger: #ff6e84;
  --fc-success: #57f287;
  --fc-warning: #fee75c;
  --fc-info: #60a5fa;
  --fc-discord: #5865f2;
  --fc-discord-text: #8b94ff;

  --fc-text: #f9f5f8;
  --fc-text-muted: #adaaad;

  --fc-border: #1f1f22;
  --fc-outline: #767577;
  --fc-outline-variant: #48474a;
  --fc-ring: #a3a6ff;
}
```

- [ ] **Step 2: Map tokens onto Fumadocs' theme variables**

Bind Fumadocs' own CSS variables (names confirmed in Task 1 Step 1) to the `--fc-*` values above. Fonts: Inter for body, Space Grotesk for labels, JetBrains Mono for code.

Two rules from `design.md` that are easy to get wrong:
- **Elevation is a surface shift, never a shadow.** Do not add box-shadows.
- **`--fc-discord` is fill-only.** It measures 4.19:1 as text and fails WCAG AA. Use `--fc-discord-text` for any Discord-colored text or icon.

- [ ] **Step 3: Verify contrast**

Check rendered body text against its background. `#f9f5f8` on `#0e0e10` must pass WCAG AA. Confirm no element uses `#5865F2` as a text color.

- [ ] **Step 4: Rebuild and eyeball**

Run: `pnpm docs:build`
Expected: exits 0. Open `apps/docs/out/index.html` and confirm the dark Obsidian palette renders.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/styles apps/docs/app
git commit -m "feat(docs): apply Obsidian Engine tokens to the docs theme"
```

---

### Task 3: Status-derivation rule

The single most important piece of logic in this system. It decides whether a feature is documented as working or buried under a "Planned" banner — and `CLAUDE.md` gets this wrong for ten shipped modules.

**Files:**
- Create: `apps/docs/scripts/manifest/status.mjs`
- Create: `apps/docs/tests/status.test.ts`
- Create: `apps/docs/vitest.config.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `deriveStatus(evidence: Evidence): "shipped" | "planned" | "partial"` where
  `Evidence = { system: string | null, botFeature: string | null, serverFeature: string | null, clientRoute: string | null, commands: string[], spec: string | null }`

- [ ] **Step 1: Write the vitest config**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Write the failing tests**

Create `apps/docs/tests/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveStatus } from "../scripts/manifest/status.mjs";

const empty = {
  system: null,
  botFeature: null,
  serverFeature: null,
  clientRoute: null,
  commands: [],
  spec: null,
};

describe("deriveStatus", () => {
  it("returns shipped when a system exists and commands are registered", () => {
    expect(
      deriveStatus({
        ...empty,
        system: "packages/systems/src/moderation",
        botFeature: "apps/bot/src/features/moderation",
        commands: ["ban", "kick"],
      }),
    ).toBe("shipped");
  });

  it("returns shipped when a system exists and a dashboard route exists", () => {
    expect(
      deriveStatus({
        ...empty,
        system: "packages/systems/src/starboard",
        serverFeature: "apps/dashboard/src/server/features/starboard",
        clientRoute: "/guild/$guildId/starboard",
      }),
    ).toBe("shipped");
  });

  it("returns planned when only a spec exists", () => {
    expect(deriveStatus({ ...empty, spec: "docs/features/economy.md" })).toBe(
      "planned",
    );
  });

  it("returns partial when source exists but nothing is user-reachable", () => {
    expect(
      deriveStatus({ ...empty, system: "packages/systems/src/queue" }),
    ).toBe("partial");
  });

  it("returns planned for a feature with no evidence at all", () => {
    expect(deriveStatus(empty)).toBe("planned");
  });

  it("ignores the spec when source proves the feature shipped", () => {
    // Regression guard: CLAUDE.md marks these "Not Started" while they ship.
    expect(
      deriveStatus({
        ...empty,
        system: "packages/systems/src/leveling",
        botFeature: "apps/bot/src/features/leveling",
        commands: ["rank"],
        spec: "docs/features/leveling.md",
      }),
    ).toBe("shipped");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/docs test`
Expected: FAIL — `deriveStatus` is not defined.

- [ ] **Step 4: Implement**

Create `apps/docs/scripts/manifest/status.mjs`:

```js
/**
 * Decide how a feature is documented, from source evidence alone.
 *
 * Never consult CLAUDE.md, docs/implementation-plan.md, or docs/features/*.md
 * for status. All three mark shipped modules "Not Started".
 */
export function deriveStatus(evidence) {
  const hasSource = Boolean(evidence.system || evidence.botFeature);
  const isReachable =
    evidence.commands.length > 0 || Boolean(evidence.clientRoute);

  if (hasSource && isReachable) return "shipped";
  if (!hasSource && evidence.spec) return "planned";
  if (!hasSource) return "planned";
  return "partial";
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/docs test`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/scripts/manifest/status.mjs apps/docs/tests/status.test.ts apps/docs/vitest.config.ts
git commit -m "feat(docs): derive feature status from source evidence"
```

---

### Task 4: Manifest scanners and builder

**Files:**
- Create: `apps/docs/scripts/manifest/scan.mjs`, `apps/docs/scripts/manifest/build.mjs`
- Create: `apps/docs/tests/scan.test.ts`

**Interfaces:**
- Consumes: `deriveStatus` from Task 3
- Produces: `scanCommands(repoRoot)`, `scanEnvVars(repoRoot)`, `scanDashboardPages(repoRoot)`, `buildManifest(repoRoot)`; CLI writes `apps/docs/_manifest.json`

- [ ] **Step 1: Write failing tests for the extractors**

Create `apps/docs/tests/scan.test.ts`. These run against the real repo, so they double as drift detectors.

```ts
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { scanCommands, scanEnvVars, scanDashboardPages } from "../scripts/manifest/scan.mjs";

const repoRoot = resolve(__dirname, "../../..");

describe("scanCommands", () => {
  it("finds every command file in the feature-sliced layout", () => {
    const commands = scanCommands(repoRoot);
    expect(commands.length).toBe(38);
  });

  it("records the module a command belongs to", () => {
    const ban = scanCommands(repoRoot).find((c) => c.name === "ban");
    expect(ban).toBeDefined();
    expect(ban?.module).toBe("moderation");
  });

  it("records the permission gate read from source", () => {
    const ban = scanCommands(repoRoot).find((c) => c.name === "ban");
    expect(ban?.defaultMemberPermissions).toBe("BanMembers");
  });
});

describe("scanEnvVars", () => {
  it("finds every variable declared in .env.example", () => {
    expect(scanEnvVars(repoRoot).length).toBe(16);
  });

  it("includes DISCORD_TOKEN", () => {
    expect(scanEnvVars(repoRoot).map((v) => v.name)).toContain("DISCORD_TOKEN");
  });
});

describe("scanDashboardPages", () => {
  it("finds every guild page route", () => {
    expect(scanDashboardPages(repoRoot).length).toBe(18);
  });

  it("maps route filenames to feature ids where they differ", () => {
    const pages = scanDashboardPages(repoRoot);
    expect(pages.find((p) => p.route.endsWith("/rules"))?.featureId).toBe("automation");
    expect(pages.find((p) => p.route.endsWith("/logs"))?.featureId).toBe("logging");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/docs test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the scanners**

Create `apps/docs/scripts/manifest/scan.mjs`. Read command metadata by parsing the `SlashCommandBuilder` chain — `.setName()`, `.setDescription()`, each `.add*Option()` block, and `.setDefaultMemberPermissions(PermissionFlagsBits.X)` — from files matching `apps/bot/src/features/*/commands/*.ts`, excluding `*.test.ts`.

Route-to-feature mismatches are not derivable from filenames. Encode them explicitly:

```js
// Client route filenames do not always match feature directory names.
const ROUTE_FEATURE_OVERRIDES = {
  rules: "automation",
  logs: "logging",
};
```

`scanEnvVars` parses `.env.example` for `^[A-Z_0-9]+=` and captures the preceding comment line as the description.

- [ ] **Step 4: Run to verify the tests pass**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/docs test`
Expected: PASS.

If a count assertion fails, **do not edit the expected number to match**. A changed count means either the scanner is wrong or the repo genuinely changed — determine which, and only then update the test with a note.

- [ ] **Step 5: Implement the CLI builder**

Create `apps/docs/scripts/manifest/build.mjs` — assembles all scanner output plus `deriveStatus`, stamps `generatedFromCommit` via `git rev-parse HEAD`, and writes `apps/docs/_manifest.json`.

Add to `apps/docs/package.json`: `"manifest": "node scripts/manifest/build.mjs"`.

- [ ] **Step 6: Generate the manifest and sanity-check it**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/docs manifest`

Then confirm the ten modules `CLAUDE.md` calls "Not Started" are **not** marked planned:

```bash
node -e '
const m = require("./apps/docs/_manifest.json");
const shouldShip = ["welcome","rolePanel","leveling","tickets","suggestions","starboard","giveaways","antiraid","customCommands","scheduled"];
const wrong = m.features.filter(f => shouldShip.includes(f.id) && f.status === "planned");
console.log(wrong.length === 0 ? "STATUS OK" : "WRONG: " + wrong.map(f=>f.id).join(", "));
'
```

Expected: `STATUS OK`.

- [ ] **Step 7: Commit**

```bash
git add apps/docs/scripts/manifest apps/docs/tests/scan.test.ts apps/docs/_manifest.json apps/docs/package.json
git commit -m "feat(docs): generate the documentation manifest from source"
```

---

### Task 5: Path guard — block fabricated file paths

The mechanical answer to the primary failure mode of generated documentation. This is the guard that would have caught the stale `apps/bot/src/commands/` paths still sitting in `CLAUDE.md`.

**Files:**
- Create: `apps/docs/scripts/verify-doc-paths.mjs`, `apps/docs/tests/verify-doc-paths.test.ts`, `.claude/hooks/docs-path-guard.sh`
- Modify: `.claude/settings.json`

**Interfaces:**
- Consumes: nothing
- Produces: `extractRepoPaths(content: string): string[]`, `findMissingPaths(paths: string[], repoRoot: string): string[]`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { extractRepoPaths, findMissingPaths } from "../scripts/verify-doc-paths.mjs";

const repoRoot = resolve(__dirname, "../../..");

describe("extractRepoPaths", () => {
  it("extracts backticked repo paths", () => {
    expect(extractRepoPaths("See `apps/bot/src/index.ts` for details")).toEqual([
      "apps/bot/src/index.ts",
    ]);
  });

  it("extracts markdown link targets", () => {
    expect(extractRepoPaths("[the schema](packages/database/prisma/schema.prisma)")).toEqual([
      "packages/database/prisma/schema.prisma",
    ]);
  });

  it("ignores URLs", () => {
    expect(extractRepoPaths("see https://example.com/apps/bot/src/x.ts")).toEqual([]);
  });

  it("deduplicates repeated paths", () => {
    expect(extractRepoPaths("`apps/bot/src/index.ts` and `apps/bot/src/index.ts`")).toEqual([
      "apps/bot/src/index.ts",
    ]);
  });
});

describe("findMissingPaths", () => {
  it("returns nothing when every path exists", () => {
    expect(findMissingPaths(["apps/bot/src/index.ts"], repoRoot)).toEqual([]);
  });

  it("flags the stale pre-refactor command path", () => {
    // The exact error CLAUDE.md still contains.
    expect(findMissingPaths(["apps/bot/src/commands/moderation/ban.ts"], repoRoot)).toEqual([
      "apps/bot/src/commands/moderation/ban.ts",
    ]);
  });

  it("accepts directory paths", () => {
    expect(findMissingPaths(["packages/systems/src/"], repoRoot)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/docs test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
import { existsSync } from "node:fs";
import { join } from "node:path";

const PATH_PATTERN = /(?:^|[\s`("[])((?:apps|packages|docs|scripts)\/[\w.$/-]+)/g;

export function extractRepoPaths(content) {
  const withoutUrls = content.replace(/https?:\/\/\S+/g, "");
  const found = new Set();
  for (const match of withoutUrls.matchAll(PATH_PATTERN)) {
    found.add(match[1]);
  }
  return [...found];
}

export function findMissingPaths(paths, repoRoot) {
  return paths.filter((p) => !existsSync(join(repoRoot, p)));
}
```

- [ ] **Step 4: Run to verify the tests pass**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/docs test`
Expected: PASS.

- [ ] **Step 5: Write the hook wrapper**

Create `.claude/hooks/docs-path-guard.sh`, matching the style of `guard-pnpm.sh`:

```bash
#!/bin/bash
# PreToolUse hook: Blocks writes to apps/docs/** that reference nonexistent repo paths.
# Documentation that cites a path which does not exist costs the reader their trust.

set -eo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

case "$FILE_PATH" in
  */apps/docs/*) ;;
  *) exit 0 ;;
esac

CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // empty')
[ -z "$CONTENT" ] && exit 0

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

MISSING=$(echo "$CONTENT" | node "$REPO_ROOT/apps/docs/scripts/verify-doc-paths.mjs" --stdin 2>/dev/null || echo "")

if [ -n "$MISSING" ]; then
  jq -n --arg missing "$MISSING" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("BLOCKED: this page references repo paths that do not exist:\n" + $missing + "\n\nThe apps were refactored to a feature-sliced layout. Commands live in apps/bot/src/features/<module>/commands/, dashboard API in apps/dashboard/src/server/features/, dashboard UI in apps/dashboard/src/client/features/. Verify against the source tree, not CLAUDE.md.")
    }
  }'
  exit 0
fi

exit 0
```

Add a `--stdin` CLI branch to `verify-doc-paths.mjs` that reads stdin, runs both functions, and prints one missing path per line.

- [ ] **Step 6: Test the hook end to end**

```bash
chmod +x .claude/hooks/docs-path-guard.sh
echo '{"tool_input":{"file_path":"/repo/apps/docs/content/x.mdx","content":"see `apps/bot/src/commands/moderation/ban.ts`"}}' \
  | .claude/hooks/docs-path-guard.sh
```
Expected: JSON with `"permissionDecision": "deny"`.

```bash
echo '{"tool_input":{"file_path":"/repo/apps/docs/content/x.mdx","content":"see `apps/bot/src/index.ts`"}}' \
  | .claude/hooks/docs-path-guard.sh
```
Expected: no output, exit 0.

- [ ] **Step 7: Register the hook**

Add to `.claude/settings.json` under `PreToolUse`:

```json
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/docs-path-guard.sh",
            "timeout": 10,
            "statusMessage": "Verifying documented paths exist..."
          }
        ]
      }
```

- [ ] **Step 8: Commit**

```bash
git add apps/docs/scripts/verify-doc-paths.mjs apps/docs/tests/verify-doc-paths.test.ts .claude/hooks/docs-path-guard.sh .claude/settings.json
git commit -m "feat(docs): block documentation that cites nonexistent paths"
```

---

### Task 6: Coverage assertion

**Files:**
- Create: `apps/docs/scripts/check-coverage.mjs`, `apps/docs/tests/check-coverage.test.ts`

**Interfaces:**
- Consumes: `_manifest.json` from Task 4
- Produces: `findCoverageGaps(manifest, pagePaths): { missingPages: string[], orphanPages: string[] }`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { findCoverageGaps } from "../scripts/check-coverage.mjs";

const manifest = {
  features: [
    { id: "moderation", status: "shipped", userGuidePage: "guide/features/moderation.mdx" },
    { id: "leveling", status: "shipped", userGuidePage: "guide/features/leveling.mdx" },
  ],
};

describe("findCoverageGaps", () => {
  it("reports nothing when every feature has its page and no extras exist", () => {
    expect(
      findCoverageGaps(manifest, [
        "guide/features/moderation.mdx",
        "guide/features/leveling.mdx",
      ]),
    ).toEqual({ missingPages: [], orphanPages: [] });
  });

  it("reports a manifest entry with no page", () => {
    expect(findCoverageGaps(manifest, ["guide/features/moderation.mdx"]).missingPages).toEqual([
      "guide/features/leveling.mdx",
    ]);
  });

  it("reports a page with no manifest entry", () => {
    expect(
      findCoverageGaps(manifest, [
        "guide/features/moderation.mdx",
        "guide/features/leveling.mdx",
        "guide/features/economy.mdx",
      ]).orphanPages,
    ).toEqual(["guide/features/economy.mdx"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/docs test`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
export function findCoverageGaps(manifest, pagePaths) {
  const expected = manifest.features.map((f) => f.userGuidePage);
  const actual = new Set(pagePaths);
  return {
    missingPages: expected.filter((p) => !actual.has(p)),
    orphanPages: pagePaths.filter((p) => !expected.includes(p)),
  };
}
```

Add a CLI branch that walks `apps/docs/content/guide/features/`, calls `findCoverageGaps`, prints both lists, and exits 1 if either is non-empty. Add `"check-coverage": "node scripts/check-coverage.mjs"` to `apps/docs/package.json`.

- [ ] **Step 4: Run to verify the tests pass**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/docs test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/scripts/check-coverage.mjs apps/docs/tests/check-coverage.test.ts apps/docs/package.json
git commit -m "feat(docs): assert manifest and page parity in both directions"
```

---

### Task 7: Freshness hook

**Files:**
- Create: `.claude/hooks/docs-freshness.sh`
- Modify: `.claude/settings.json`

**Interfaces:**
- Consumes: `_manifest.json`'s `generatedFromCommit`
- Produces: a Stop-hook warning; never blocks

- [ ] **Step 1: Write the hook**

```bash
#!/bin/bash
# Stop hook: Warns when source changed after the manifest was generated.

set -euo pipefail

INPUT=$(cat)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
MANIFEST="$REPO_ROOT/apps/docs/_manifest.json"

[ -f "$MANIFEST" ] || exit 0

STAMPED=$(jq -r '.generatedFromCommit // empty' "$MANIFEST")
[ -z "$STAMPED" ] && exit 0

CURRENT=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo "")
[ "$STAMPED" = "$CURRENT" ] && exit 0

CHANGED=$(git -C "$REPO_ROOT" diff --name-only "$STAMPED" HEAD 2>/dev/null \
  | grep -E '^(apps/(bot|dashboard)/src/|packages/systems/src/|\.env\.example)' || true)

[ -z "$CHANGED" ] && exit 0

COUNT=$(echo "$CHANGED" | wc -l | tr -d ' ')

jq -n --arg count "$COUNT" '{
  hookSpecificOutput: {
    hookEventName: "Stop",
    additionalContext: ("📄 DOCS FRESHNESS: " + $count + " documented source file(s) changed since apps/docs/_manifest.json was generated. Regenerate it (pnpm --filter @fluxcore/docs manifest) and re-run /document-system for affected features.")
  }
}'
exit 0
```

- [ ] **Step 2: Test both branches**

```bash
chmod +x .claude/hooks/docs-freshness.sh
echo '{}' | .claude/hooks/docs-freshness.sh
```
Expected with a current manifest: no output.

Then temporarily set `generatedFromCommit` to an older commit and re-run.
Expected: JSON containing `DOCS FRESHNESS`. Restore the real value afterward.

- [ ] **Step 3: Register the hook**

Add to the existing `Stop` hooks array in `.claude/settings.json`, alongside `memory-reminder.sh` and `test-reminder.sh`:

```json
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/docs-freshness.sh",
            "timeout": 10,
            "statusMessage": "Checking documentation freshness..."
          }
```

- [ ] **Step 4: Commit**

```bash
git add .claude/hooks/docs-freshness.sh .claude/settings.json
git commit -m "feat(docs): warn when source outpaces the docs manifest"
```

---

### Task 8: Standing-rules prompt

**Files:**
- Create: `docs/superpowers/prompts/docs-standing-rules.md`

**Interfaces:**
- Consumes: nothing
- Produces: a rules block the three agents and the slash command all reference

- [ ] **Step 1: Write the rules document**

Contents, stated as absolutes:

1. **Source is truth.** `CLAUDE.md`, `docs/PROJECT_INDEX.md`, `docs/features/*.md`, and `docs/implementation-plan.md` are unverified inputs. All four are known wrong: the first two document a pre-refactor file layout, and the first and fourth mark ten shipped modules "Not Started."
2. **No invention.** Never state a command option, env var, default, or permission not read in source. Uncertain → read the file or omit it.
3. **Status comes from `_manifest.json`**, which derives it from evidence.
4. **Audience discipline.** User pages: no file paths, no code internals. Self-hosting pages: no React/TypeScript internals. Developer pages: assume the repo is open.
5. **Every command page states the exact permission gate** read from that command's `setDefaultMemberPermissions` call.
6. **Never write "simply", "just", "easy", or "obviously."** They shame the reader when a step fails.
7. **English only.**
8. **Every install command shown to a reader runs through Docker.**
9. **Planned features** get `<Callout type="warn">` and a link to their spec, marked spec-derived.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/prompts/docs-standing-rules.md
git commit -m "docs(prompts): add standing rules for documentation agents"
```

---

### Task 9: The three subagents

**Files:**
- Create: `.claude/agents/docs-inventory.md`, `.claude/agents/docs-writer.md`, `.claude/agents/docs-verifier.md`

**Interfaces:**
- Consumes: Task 8's standing rules
- Produces: three agent types invocable by name

- [ ] **Step 1: Write `docs-inventory`**

Frontmatter must restrict tools to `Read, Grep, Glob, Bash`. Read-only is load-bearing: an inventory agent that can write is one that will "fix" a discrepancy instead of recording it.

Body: run the manifest builder, verify its output against spot-checked source, report discrepancies rather than correcting them.

- [ ] **Step 2: Write `docs-writer`**

Tools: `Read, Grep, Glob, Write, Edit`.

Body: takes one manifest slice, writes exactly one page. Inlines the standing rules. States the feature-guide skeleton: what it does → how to turn it on → dashboard walkthrough → related slash commands → recipes → troubleshooting.

- [ ] **Step 3: Write `docs-verifier`**

Tools: `Read, Grep, Glob`.

Body: adversarial. Given a page and its manifest slice, find every claim source does not support. Default to flagging when uncertain. Report a list; do not edit. Fabrication is the primary failure mode of generated documentation.

- [ ] **Step 4: Verify the agents are registered**

Confirm all three appear in the available agent types list. If the harness needs a restart to pick them up, note that.

- [ ] **Step 5: Commit**

```bash
git add .claude/agents
git commit -m "feat(docs): add inventory, writer and verifier agents"
```

---

### Task 10: `/document-system` command

**Files:**
- Create: `.claude/commands/document-system.md`

**Interfaces:**
- Consumes: `_manifest.json`, the three agents, `check-coverage.mjs`
- Produces: `/document-system [feature-id]`

- [ ] **Step 1: Write the command**

Flow: regenerate the manifest → diff against pages on disk via `check-coverage.mjs` → for each gap, dispatch `docs-writer` then `docs-verifier` → re-run the coverage check → report what remains. With an argument, act on that one feature.

- [ ] **Step 2: Verify it appears as a slash command**

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/document-system.md
git commit -m "feat(docs): add /document-system orchestrator"
```

---

### Task 11: Screenshot placeholders and checklist

**Files:**
- Create: `apps/docs/components/ScreenshotPlaceholder.tsx`
- Modify: `apps/docs/scripts/manifest/build.mjs` (also emit `SCREENSHOTS.md`)

**Interfaces:**
- Consumes: `manifest.dashboardPages`
- Produces: `<ScreenshotPlaceholder src alt route />`; `apps/docs/SCREENSHOTS.md`

- [ ] **Step 1: Write the component**

Renders the image when the file exists at build time, and a labelled placeholder box otherwise — captioned with the route to visit. Never renders a broken image. Styled with Obsidian tokens (`--fc-surface-container`, dashed `--fc-outline-variant` border).

- [ ] **Step 2: Emit the checklist**

Extend `build.mjs` to write `apps/docs/SCREENSHOTS.md` — one row per dashboard page: target filename, route to visit, what the frame should show, viewport (1440×900), theme (dark).

The file must open with a privacy warning:

> **Before capturing:** these screenshots go on a public site. Capture against a demo guild with synthetic members, or scrub guild names, member names, avatars, and moderation case details before committing. Real member data must never reach `apps/docs/public/`.

- [ ] **Step 3: Regenerate and verify**

Run: `docker compose --profile bot run --rm --no-deps bot pnpm --filter @fluxcore/docs manifest`
Expected: `apps/docs/SCREENSHOTS.md` lists 18 dashboard pages and opens with the privacy warning.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/components apps/docs/scripts/manifest/build.mjs apps/docs/SCREENSHOTS.md
git commit -m "feat(docs): add screenshot placeholders and capture checklist"
```

---

### Task 12: Calibration page

The point of this task is measurement, not content. It answers whether the ~70-page estimate holds before anyone commits to the full run.

**Files:**
- Create: `apps/docs/content/guide/features/moderation.mdx`

**Interfaces:**
- Consumes: everything above
- Produces: one finished page, plus a calibration report

- [ ] **Step 1: Generate the page**

Run `/document-system moderation`. Moderation is the right sample: 15 commands, a dashboard page, and shared system logic — the most complex feature, so it bounds the estimate from above.

- [ ] **Step 2: Confirm the guards actually fired**

The path guard must have been exercised. If it never triggered, verify it is wired correctly by deliberately writing a bad path and confirming the deny.

- [ ] **Step 3: Run the verifier**

Dispatch `docs-verifier` against the page. Every flagged claim must be either corrected or removed. Do not accept "probably fine."

- [ ] **Step 4: Build**

Run: `pnpm docs:build`
Expected: exits 0, page renders in `out/`.

- [ ] **Step 5: Record the calibration**

Append to the plan or a scratch note: wall-clock time, token cost, how many claims the verifier flagged, and how many screenshot slots the page needed. Extrapolate to the remaining features and compare against the ~70-page estimate.

**If the extrapolation materially exceeds the estimate, stop and report before continuing.** Revising scope is the user's call.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/content/guide/features/moderation.mdx
git commit -m "docs(guide): add the moderation feature guide"
```

---

## After this plan

Bulk generation is repeated `/document-system` runs, informed by Task 12's calibration. Recommended order: shipped feature guides → command reference → self-hosting → developer → roadmap.

Two follow-ups the spec puts out of scope but which should be tracked:
- **Fix `CLAUDE.md` and `docs/PROJECT_INDEX.md`.** Their wrong paths and wrong status table are the root cause of most of this plan's defensive machinery.
- **Decide the manifest regeneration cadence.** `docs-freshness.sh` warns but does not block; under active development the manifest will drift.

## Self-Review

**Spec coverage.** Every spec section maps to a task: Phase 0 scaffold → Task 1; theming → Task 2; status rule → Task 3; manifest → Task 4; path guard → Task 5; coverage assertion → Task 6; freshness hook → Task 7; standing rules → Task 8; three subagents → Task 9; slash command → Task 10; screenshots → Task 11; calibration → Task 12. The IA's four sidebars are realized by content generation, which is deliberately out of this plan's scope and covered in "After this plan."

**Placeholder scan.** No TBD/TODO. Every code step carries real code. Task 1 defers Fumadocs specifics to live verification — that is a deliberate instruction to verify, not an unfilled blank, and the spec requires it.

**Type consistency.** `deriveStatus(evidence)` (Task 3) is consumed by `build.mjs` (Task 4) with the same `Evidence` shape. `extractRepoPaths`/`findMissingPaths` (Task 5) are used by the hook wrapper in the same task. `findCoverageGaps(manifest, pagePaths)` (Task 6) is consumed by `/document-system` (Task 10). `userGuidePage` is the field name in both the Task 4 manifest and the Task 6 coverage check. `generatedFromCommit` is written in Task 4 and read in Task 7.
