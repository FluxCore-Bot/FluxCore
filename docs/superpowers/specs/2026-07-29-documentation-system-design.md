# FluxCore Documentation System — Design

**Date:** 2026-07-29
**Status:** Approved, ready for implementation planning
**Branch at design time:** `feat/delegated-dashboard-access`

## Problem

FluxCore has substantial functionality and almost no usable documentation.

- **End users** (Discord admins and members) have **nothing**. 38 slash commands and 18
  dashboard pages ship with zero user-facing documentation.
- **Self-hosters** have only the Quick Start and Production sections of `README.md`. There is
  no environment reference, no migration guide, no backup/restore procedure, no upgrade path,
  no troubleshooting.
- **Developers** have `docs/module-guide.md` (1074 lines, reasonable) and
  `docs/PROJECT_INDEX.md` — but the index is stale, and `docs/features/*.md` record *design
  intent from before implementation*, not what shipped.

Worse, the existing docs are actively wrong in two ways that will propagate into anything
generated from them.

### The repo's own docs cannot be trusted

**Wrong paths.** The apps were refactored to a feature-sliced layout; `CLAUDE.md` and
`docs/PROJECT_INDEX.md` were not updated.

| Documented (WRONG) | Actual |
|---|---|
| `apps/bot/src/commands/<module>/` | `apps/bot/src/features/<module>/commands/` |
| `apps/dashboard/src/server/routes/` | `apps/dashboard/src/server/features/` |
| `apps/dashboard/src/client/pages/` | `apps/dashboard/src/client/features/` |
| `packages/systems/src/<module>/` | unchanged — still correct |

**Wrong status.** `CLAUDE.md` and `docs/implementation-plan.md` mark Phases 2–4 "Not Started."
Verified against source on 2026-07-29, every one of them has shipped code:

| Module | system | bot cmds | dashboard API | dashboard page |
|---|---|---|---|---|
| Welcome & Farewell | ✅ | ✅ | ✅ | ✅ |
| Role Panels (reaction roles) | ✅ `rolePanel` | ✅ | ✅ | ✅ |
| Leveling | ✅ | ✅ | ✅ | ✅ |
| Tickets | ✅ | ✅ | ✅ | ✅ |
| Suggestions | ✅ | ✅ | ✅ | ✅ |
| Starboard | ✅ | — | ✅ | ✅ |
| Giveaways | ✅ | ✅ | ✅ | ✅ |
| Anti-Raid | ✅ `antiraid` | — | ✅ (`security`) | ✅ |
| Custom Commands | ✅ | — | ✅ | ✅ |
| Scheduled Messages | ✅ | — | ✅ | ✅ |

This evidence is directory-level: it proves *built*, not *complete or polished*.

**Consequence for this design:** the risk is not documenting vapor. It is the reverse — a
generation pass that trusts `CLAUDE.md` would bury ten shipped features under a "Planned"
banner and publish file paths that do not exist.

## Verified surface area

Counts verified against source on 2026-07-29:

| Thing | Count |
|---|---|
| Slash command files | 38 |
| Bot feature modules | 9 |
| Gateway event handlers | 21 |
| Dashboard API feature dirs | 18 |
| Dashboard client feature dirs | 19 |
| Dashboard guild pages (routes) | 18 |
| Shared systems dirs | 16 (incl. `queue`, infrastructure not a feature) |
| Prisma models | 41 |
| Env vars in `.env.example` | 16 |
| Locales | 48 |

Estimated output: **~70 pages** — ~40 user, ~12 self-hosting, ~15 developer, ~5 generated
reference — plus ~25 screenshot slots.

## Decisions

Settled with the user. Do not re-litigate.

| Decision | Choice |
|---|---|
| Framework | **Fumadocs** (Next.js + React + Tailwind, MDX). Docusaurus was chosen first and reversed. |
| Location | **`apps/docs/`** — not `docs/`, which holds unpublishable internal specs |
| Theming | **Obsidian Engine tokens** from `design.md`, not the stock theme |
| Scope | As-built **and** planned features, with planned clearly banner-marked |
| Screenshots | **Placeholders + a capture checklist** the user fills in later |
| Deployment | **Static export served by the existing Caddy** — no new prod container |
| Language | **English only** |
| Execution | **Manifest-driven**: scaffold → inventory → generation |

### Rationale for the load-bearing ones

**`apps/docs/`, not `docs/`.** `docs/` contains 100+ internal specs, security remediation
plans, and audit reports that must never be published. A separate workspace makes the publish
boundary structural rather than a matter of remembering to exclude things. `pnpm-workspace.yaml`
globs `apps/*`, so the workspace registers automatically.

**Static export.** The prod stack already runs Caddy. Static output adds no service, no
runtime, and no attack surface to a project whose entire pitch is self-hosting. Knock-on:
Fumadocs' Orama search must use its **static index** path, not the default Next route handler.

**Placeholders over Playwright.** Live dashboard captures contain real guild names, member
names, avatars, and moderation cases — a privacy leak on a public site. Placeholders also
remove the dependency on a running stack and a real Discord guild, so documentation generation
never blocks on infrastructure.

**English only.** The 48-locale rule governs app i18n keys. It does not extend to ~70 pages of
prose, and scaffolding Fumadocs i18n for 48 languages would be dead weight.

**Manifest-driven.** 70 pages do not fit one context window. Without a manifest, "did we
document everything?" can only be answered by reading every file.

## Architecture

### Phase 0 — Scaffold

Create `apps/docs/` as a Fumadocs workspace, themed with Obsidian tokens, wired into
Turborepo, configured for static export.

**Hard requirement:** Fumadocs package names, MDX configuration, Tailwind integration, and the
static-search setup must be **verified against live Fumadocs documentation at implementation
time**, not reproduced from model knowledge. Fumadocs moves faster than any training cutoff,
and hallucinated scaffold code poisons every downstream phase.

`pnpm add` runs **inside Docker** — host `node_modules` are root-owned.

### Phase 1 — Inventory

A single read-only agent reads **source only** and emits `apps/docs/_manifest.json`, stamped
with the commit it was derived from.

Top-level keys: `features`, `commands`, `apiRoutes`, `dashboardPages`, `envVars`,
`prismaModels`, `events`, `locales`.

A feature entry, using a real example:

```jsonc
{
  "id": "moderation",
  "status": "shipped",              // evidence-derived; never read from CLAUDE.md
  "evidence": {
    "system": "packages/systems/src/moderation",
    "botFeature": "apps/bot/src/features/moderation",
    "serverFeature": "apps/dashboard/src/server/features/moderation",
    "clientRoute": "/guild/$guildId/moderation",
    "prismaModels": ["ModCase", "Warning"],
    "spec": "docs/features/moderation.md"
  },
  "commands": ["ban", "kick", "warn", "timeout", "..."],
  "userGuidePage": "guide/features/moderation.mdx"
}
```

**Status rule**, stated so it cannot be fudged. *Corrected 2026-07-29 during implementation —
see below.*

- **has source** — any of: a system directory, a bot-feature directory, a dashboard server
  feature, or a dashboard client route
- **is reachable** — a registered command, or an existing dashboard route
- `shipped` — has source **and** is reachable
- `planned` — no source at all
- `partial` — has source but is not reachable; the page must state what works and what does not

**Audience** is derived alongside status: `audience = isReachable ? "user" : "developer"`.
Entries that are real infrastructure with no user-facing surface — `queue`, `auth`, `guilds`,
`discord` — are documented in the developer section only and never appear in the user guide.
Deriving this avoids the hand-maintained list the whole system exists to eliminate.

> **Why the rule was corrected.** As first written, *has source* counted only a system or
> bot-feature directory. Dashboard-only features have neither, so the first generated manifest
> marked `permissions`, `settings`, and `overview` as `planned` — `permissions` being the
> delegated dashboard access shipped a week earlier. That is exactly the failure this design
> exists to prevent, arrived at from the opposite direction. The verification gate missed it
> because it only checked the ten modules `CLAUDE.md` misreports, all of which happen to have
> `packages/systems/` directories. The gate now asserts the general form: **no feature with a
> client route or any commands may be marked `planned`.**

**Naming traps the manifest resolves.** Route names do not match feature names, and the
mismatches are not derivable from filenames — they must be encoded explicitly. Confirmed during
implementation: `rules` → `automation`, `logs` → `logging`, `roles` → `rolePanel`,
`security` → `antiraid`, `commands` → `customCommands`, `actions` → `automation`. Case also
diverges across sources: the dashboard uses `tempvoice` while `packages/systems` uses
`tempVoice`, which split into two feature entries — one falsely `planned` — until unified.

**Manifest generation runs on the host, not in Docker.** `build.mjs` uses only Node built-ins,
so no `pnpm install` is involved and the Docker rule — which exists for `node_modules`
ownership — does not apply. The `bot` container has no `git` binary and no `.git` mount, so
`git rev-parse HEAD` cannot work there. Tests still run in Docker.

### Phase 2 — Generation

The manifest drives a loop: one focused unit of work per page, each given only its manifest
slice and the source files that slice names. Each page is then checked by an adversarial
verifier.

### Information architecture

Four sidebars.

**① Using FluxCore** — Discord admins and members

- Getting started: what it is · inviting the bot · required permissions and intents · first-run checklist
- Dashboard tour: logging in · picking a server · layout and navigation · command palette · who can access it (delegated permissions)
- **Feature guides**, one per shipped feature, all on an identical skeleton: what it does → how to turn it on → dashboard walkthrough → related slash commands → recipes → troubleshooting
- Command reference — generated, grouped by module: syntax, options, required permission, example
- FAQ and troubleshooting

**② Self-Hosting**
Requirements · creating the Discord application (token, OAuth redirect, intents, scopes) · dev
install · generated env-var reference · Docker secrets · database migrations and `db:generate` ·
registering slash commands · production deploy (`docker-compose.prod.yml`, Caddy, TLS, domains) ·
backup service and restore drill · upgrading · operations (logs, health, pgadmin profile) ·
troubleshooting · security-hardening checklist

**③ Developing**
Architecture and data flow · Docker-first workflow and Turborepo · generated repository map ·
*"Add a feature module end-to-end"* (schema → system → bot command → API route → dashboard page
→ i18n → tests) · bot command/event/handler architecture · dashboard API, auth and the
permissions model · shared systems and the cache-sync pipeline · generated schema reference (41
models) · design system · i18n across 48 locales · testing (factories, mocking rules) ·
contributing

**④ Roadmap** — only what evidence proves unbuilt. Each page carries `<Callout type="warn">`
and links to its spec, marked spec-derived. Expected to be nearly empty.

## The `.claude` kit

### Subagents

Three, because the three jobs have different risk profiles.

**`docs-inventory`** — Phase 1. **Read-only tools only** (Read, Grep, Glob, read-only Bash).
Read-only is load-bearing: an inventory agent that can write is one that can "fix" a
discrepancy instead of recording it.

**`docs-writer`** — Phase 2. Writes exactly one page from one manifest slice plus the source
files that slice names. Small context, runs many times.

**`docs-verifier`** — adversarial. Its only job is finding claims a page makes that source does
not support. Fabrication is the primary failure mode of generated documentation: a
plausible-sounding flag that does not exist is worse than no documentation, because it costs
the reader their trust and their afternoon.

### Slash command

**`/document-system [feature-id]`** — reads the manifest, diffs it against pages on disk,
dispatches writers for what is missing or stale, runs the coverage assertion. With an argument,
regenerates one page.

### Hooks

**`docs-path-guard.sh`** — PreToolUse on Write/Edit under `apps/docs/**`. Extracts every
`apps/…` and `packages/…` path from the content and **blocks the write if any does not exist on
disk**. This is the mechanical answer to fabrication, and precisely the guard that would have
caught the stale `apps/bot/src/commands/` paths in `CLAUDE.md`.

**`docs-freshness.sh`** — Stop. Compares the manifest's recorded commit against `HEAD`; warns
when files under a feature's source dirs changed but its page did not.

The existing `guard-pnpm.sh` already covers the Fumadocs install.

### settings.json

Adds the two hooks, plus a permissions allowlist for read-only survey commands (`find`, `grep`,
`ls`, `git log`, `pnpm docs:*`) so a 70-page run is not interrupted by permission prompts.

## The prompt

Deliberately **not one blob** — a shared standing-rules block plus three phase prompts. A
single prompt covering scaffold, inventory, and 70 pages is the failure mode this design exists
to avoid.

Standing rules:

- **Source is truth.** `CLAUDE.md`, `docs/PROJECT_INDEX.md`, `docs/features/*.md`, and
  `docs/implementation-plan.md` are *unverified inputs* — useful for intent and naming, never
  citable as fact. All four are known wrong.
- **No invention.** Never state a command option, env var, default, or permission not read in
  source. Uncertain → read the file or omit it.
- **Status is evidence-derived**, by the rule above.
- **Audience discipline.** User pages contain no file paths and no code internals.
  Self-hosting pages contain no React/TypeScript internals. Developer pages assume the reader
  has the repo open.
- **Every command page states the exact permission gate** read from that command's source.
- **Style:** no "simply", "just", "easy", "obviously" — they shame the reader when the step fails.
- **English only. Docker-first for every install command shown.**
- **Verify Fumadocs API against live docs** before writing any config.

## Screenshots

No capture automation. Pages reference images through a consistent convention and render a
`<ScreenshotPlaceholder>` component so nothing appears broken.

Phase 1 additionally emits **`apps/docs/SCREENSHOTS.md`** from `manifest.dashboardPages`: for
each shot, the target filename, the route to visit, what the frame should show, viewport, and
theme.

The checklist must carry a privacy warning at the top: capture against a demo guild with
synthetic data, or scrub member names, avatars, and case details before committing.

## Testing

The project's testing rules apply to the code this design adds — the two hooks, the coverage
assertion script, and any manifest-generation script.

- **Hooks:** unit tests over the path-extraction and existence-check logic, including the case
  that would have caught `apps/bot/src/commands/`. Both a blocking case and a passing case.
- **Coverage assertion:** tests for orphans in both directions — a manifest entry with no page,
  and a page with no manifest entry.
- **Manifest generation:** if implemented as a script rather than agent-authored, tests over
  the status-derivation rule — one fixture per `shipped` / `planned` / `partial`.
- **Docs prose itself is not unit-tested.** Its correctness gate is the `docs-verifier` pass
  plus `docs-path-guard.sh`.

Build verification: `apps/docs` must build to static output in CI before any page work is
considered done.

## Out of scope

- Translating docs prose into the 48 app locales
- A Playwright capture pipeline
- Publishing/hosting configuration beyond static export served by existing Caddy
- Rewriting `docs/module-guide.md` — it is an input to developer pages, superseded gradually
- Fixing `CLAUDE.md` and `docs/PROJECT_INDEX.md`. **Recommended as a separate follow-up.** They
  should be corrected, but bundling that into this work mixes a docs-site build with a repo
  metadata fix.

## Open risks

**Fumadocs version drift.** Mitigated by the verify-against-live-docs rule, but the scaffold
phase carries real risk of churn if the API moved.

**Static export vs. Orama search.** Fumadocs' default search assumes a Next route handler.
The static path exists but must be confirmed working before content generation scales up —
a search-less docs site of 70 pages is close to unusable.

**Manifest staleness.** `docs-freshness.sh` warns but does not block. Under active feature
development the manifest will drift; regeneration cadence is a process question, not a
technical one.

**Estimate confidence.** ~70 pages is derived from verified counts, but per-page depth is
unvalidated until several real pages exist. The first feature guide should be treated as a
calibration sample before committing to the full run.
