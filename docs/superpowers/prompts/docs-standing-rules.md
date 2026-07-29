# Documentation Standing Rules

These rules govern every agent that writes into `apps/docs`: the three
documentation subagents and the slash command that dispatches them. They are
absolute, not guidance to weigh against convenience. Each one exists because
of a specific, verified failure already sitting in this repository — read the
evidence, don't just take the rule on faith.

---

## 1. Source is truth. `CLAUDE.md`, `docs/PROJECT_INDEX.md`, `docs/features/*.md`, and `docs/implementation-plan.md` are unverified inputs.

All four are known wrong, as of the repo state on 2026-07-29 (commit
`95a41fe`). Never cite any of them as fact. Never copy a path, a status, or a
claim from them into a docs page without checking it against the actual
source tree first.

**The file-layout claim, verified.** `CLAUDE.md` line 47 and line 264, and
`docs/PROJECT_INDEX.md`, both state commands live at
`apps/bot/src/commands/<module>/`. That layout does not exist. The repo was
refactored to a feature-sliced layout; every command file actually lives at
`apps/bot/src/features/<module>/commands/` — confirmed by listing
`apps/bot/src/features/`, which contains `moderation/commands/`,
`giveaways/commands/`, `leveling/commands/`, `tickets/commands/`,
`suggestions/commands/`, `tempvoice/commands/`, `utility/commands/`, and
`general/commands/`. The same split applies dashboard-side: API routes live
under `apps/dashboard/src/server/features/`, UI under
`apps/dashboard/src/client/features/` — not the flat `server/routes/` and
`client/pages/` paths `CLAUDE.md` describes.

**The "Not Started" claim, verified.** `CLAUDE.md`'s phase table and
`docs/implementation-plan.md` mark eleven modules "Not Started": Welcome &
Farewell, Reaction/Button/Dropdown Roles, Leveling, Tickets, Suggestions,
Starboard, Giveaways, Anti-Raid, Custom Commands, Scheduled Messages, and
Dashboard Permissions. `apps/docs/_manifest.json` — built from source
evidence, not from these documents — shows every one of them `"status":
"shipped"` (manifest ids: `welcome`, `rolePanel`, `leveling`, `tickets`,
`suggestions`, `starboard`, `giveaways`, `antiraid`, `customCommands`,
`scheduled`, `permissions`). Note the count: ten of these sit in the Phase
2–4 feature tables, and an eleventh — Dashboard Permissions — sits in the
separate Cross-Cutting table but carries the identical stale "Not Started"
marker while being fully shipped. Don't undercount by stopping at the
Phase 2–4 tables.

**`docs/features/*.md` self-reports the same lie.** These aren't neutral
specs waiting on an external status column — open one and it tells you
directly. `docs/features/welcome-farewell.md` and `docs/features/leveling.md`
both carry a `> **Status:** Not Started` line in their own header, for
features that have shipped. Treat every status line inside a
`docs/features/*.md` file as equally unverified; it is not a source of truth
merely because it lives closer to the feature.

Use these four documents only as a place to start looking — a pointer to
"there might be a welcome-message feature, go check" — never as the answer
itself.

**When a spec and source disagree on a shipped feature, source wins —
always, no exception.** A `docs/features/*.md` file describes intent at the
time it was written; the code is what actually runs today. This repo already
proves specs drift from schema over time; do not assume the copy you're
reading is the exception. Worked example (illustrative — constructed to show
the resolution procedure, not a live discrepancy found in this repo): if
`docs/features/leveling.md` stated a message-XP cooldown of "30 seconds" but
`packages/database/prisma/schema.prisma`'s `LevelingGuildSettings.xpCooldownSeconds`
field carries `@default(60)`, the page states **60 seconds**, sourced from
the schema, and does not mention the spec's number at all — not even as a
footnote ("previously planned as 30s"). A disagreement is not a detail to
preserve for history; it is evidence the spec is stale, and the page's job is
to be correct today, not to document the discrepancy.

---

## 2. No invention. Never state a command option, env var, default, or permission not read in source. Uncertain → read the file or omit it.

If you cannot point to the line of source that proves a claim, the claim
does not go in the page. This includes small things that feel safe to
infer: a flag's default value, whether an env var is required or optional,
what a slash-command option is called. Guessing from a plausible naming
convention is still guessing. Read the file. If you still can't find it,
leave it out rather than write something that merely sounds right.

**Hedging is invention wearing a disguise, and it is banned too.** Writing
"appears to default to 60 seconds," "likely requires Manage Messages," or
"should be available to everyone" satisfies a naive reading of "don't
invent" — nothing was stated as bare fact — while still putting an unverified
claim in front of the reader. The hedge doesn't make the claim safe, it just
makes it sound cautious. Banned constructions: "appears to," "likely,"
"probably," "seems to," "should" (as in "should work this way"), "presumably."
If you're tempted to write one of these, that's the signal to go read the
source instead — the sentence you produce after reading it will need no
hedge, because it will be a fact.

---

## 3. Status comes from `_manifest.json`, which derives it from evidence — including the `audience` field.

`apps/docs/_manifest.json` is generated by scanning the actual source tree
(`packages/systems`, `apps/bot/src/features`, `apps/dashboard/src/server/features`,
`apps/dashboard/src/client` routes, registered commands, and known specs) and
computing a status per feature: `shipped`, `partial`, or `planned`. It is the
only status source these rules permit. Read it before writing a status claim
anywhere.

Each entry also carries `"audience": "user" | "developer"`. As of the
generating commit, five features are `audience: "developer"`: `auth`,
`discord`, `guilds`, `i18n-accessibility`, and `queue` — all `status:
"partial"`, all dashboard-infrastructure directories with no guild-facing
page or command. **These features are documented in the developer section
only.** They must never appear in the user guide — not in a feature list,
not in a cross-link, not in an aside. A user-guide page that mentions
`queue` or `auth` internals has leaked implementation detail the reader
cannot act on and was never promised.

If you rebuild or re-read the manifest and the developer-audience set has
changed, follow what you actually see in the file — this list is a snapshot,
not a permanent enumeration.

**`status: "partial"` is not a rounding error toward "shipped" — it needs its
own page treatment, and it is the entire current developer-audience set.**
All five developer-audience features (`auth`, `discord`, `guilds`,
`i18n-accessibility`, `queue`) carry `status: "partial"` — this is not a rare
edge case a page can quietly ignore. A `partial` page must name, explicitly,
both what exists and what doesn't: e.g. for `queue`, that
`packages/systems/src/queue` provides the shared implementation, but the
manifest records no `botFeature`, no `serverFeature`, no `clientRoute`, and
no commands — so nothing in the bot or dashboard surfaces it to an end user
yet; it exists only as a library other code can import.
Do not describe a `partial` feature in prose that reads as if it were whole
("Queue management lets you...") — that sentence is true of a `shipped`
feature and false, by omission, of a `partial` one. State the gap in the same
sentence as the capability, not two paragraphs later where a skimming reader
will miss it.

---

## 4. Audience discipline.

Three audiences, three different things they're allowed to see:

- **User pages** — no file paths, no code internals. A server admin reading
  how to configure the leveling system does not need to know it lives at
  `packages/systems/src/leveling`.
- **Self-hosting pages** — no React/TypeScript internals. A self-hoster needs
  Docker commands, env vars, and migration steps — not component structure
  or hook internals.
- **Developer pages** — assume the repo is open in front of the reader. File
  paths, function names, and internal architecture are appropriate and
  expected here.

If a sentence you're writing for a user or self-hosting page would only make
sense to someone with the source checked out, it belongs on a developer page
instead — or it doesn't belong in the docs at all.

**Exclusion rules alone are hollow-compliance bait.** "Leveling is
configurable in the dashboard" contains no file path and no code — and tells
the reader nothing they can act on. Each audience's page must also *contain*
specific things, or it doesn't count as written:

| Audience | Must contain |
| --- | --- |
| User | Where in the dashboard the setting lives (page name and nav location), the exact label/control the reader clicks, and the observable effect of changing it — e.g. "Guild Settings → Leveling → Cooldown (seconds) controls how often a member can earn XP from messages; raising it slows leveling." |
| Self-hosting | The literal command(s) to run (Docker-wrapped, per Rule 8), every env var the step requires with what it's for, and the observable success/failure signal — what output or state means "this worked." |
| Developer | The file path(s) implementing the behavior, the function or exported symbol a maintainer would edit, and how the piece connects to the rest of the system (what calls it, what it writes to). |

A page that satisfies the exclusions in the bullets above but no row of this
table is not done.

---

## 5. Every command page states the exact permission gate read from that command's `setDefaultMemberPermissions` call.

Not a paraphrase, not "admin-only" as a guess — the literal
`PermissionFlagsBits` value from the command's own `SlashCommandBuilder`
chain. Verified example: `apps/bot/src/features/moderation/commands/ban.ts`
declares

```ts
.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
```

so the `/ban` command page states its gate as **Ban Members**, not "requires
moderator permissions" or any other rewording.

**No-gate commands need the practical consequence stated, not a fact-shaped
non-answer.** "No explicit permission gate is declared in source" is true
and useless — the reader asked "who can run this?", not "does the code call
a method?". `@discordjs/builders`' own doc comment on
`setDefaultMemberPermissions` says the method "sets the default permissions a
member should have in order to run the command" and that you can pass `'0'`
to disable the command by default; the converse holds when the method is
never called at all — no permission requirement is set, so the command is
invocable by any member who can see the channel where it's used. Verified
example: `apps/bot/src/features/general/commands/ping.ts` builds `/ping`
with `.setName("ping").setDescription(...)` and never calls
`.setDefaultMemberPermissions(...)`. Its command page states: "No permission
gate is set in source — any member who can see the channel can run `/ping`."
That is the required phrasing, not a shorter paraphrase that drops the
practical consequence. Read the file for every command page; do not
extrapolate a category's permission from one example command in the same
folder.

---

## 6. Never write "simply", "just", "easy", or "obviously."

They shame the reader when the step fails — and steps fail. A reader stuck on
a "simple" instruction now feels stupid on top of stuck. State the step
plainly and let its accuracy do the work instead.

---

## 7. English only.

Documentation prose is English only, full stop. This is deliberately
different from the rest of the repo: FluxCore's dashboard has a 48-locale
i18n system for in-app UI strings (`packages/i18n`, `apps/dashboard`
translation keys), and that rule does not extend here. Do not translate docs
pages, and do not treat an untranslated docs page as unfinished work the way
an untranslated UI key would be.

---

## 8. Every install command shown to a reader runs through Docker.

FluxCore is Docker-first (see `CLAUDE.md`'s Hard Constraints: host
`node_modules` are root-owned, so `pnpm add`/`pnpm install` must run inside
Docker). Any command a docs page tells a reader to type — install, dev,
test, migrate — must be the Docker-wrapped form actually used in this repo
(`docker compose ...`, `pnpm dev`/`pnpm test` as defined by the repo's own
`docker-compose` orchestration), never a bare host-side `pnpm install` or
`npm install`. This applies to self-hosting pages and developer pages alike.

---

## 9. Planned features get `<Callout type="warn">` and a link to their spec, marked spec-derived.

A feature whose manifest `status` is `planned` gets a Fumadocs
`<Callout type="warn">` at the top of its page stating plainly that it is not
built yet, plus a link to its spec file — resolved from that feature's
`spec` field in the manifest, cross-referenced against the manifest's own
`specs` list (e.g. `docs/features/starboard.md` is the format real entries
take there; the feature actually pointing to it is `shipped`, not `planned`,
as of this commit — use it only as a path-format example, not as an example
of a planned page). Label the content pulled from that spec as spec-derived —
it describes an intent, not a shipped behavior, and the reader needs to be
able to tell the difference at a glance. If a `planned` feature's manifest
entry has `spec: null` — genuinely possible, since `deriveStatus` returns
`planned` for a feature with no evidence at all regardless of whether a spec
exists — the Callout still runs, but say plainly that no spec exists yet
rather than fabricating a link. As of the generating commit no feature in
the manifest carries `status: "planned"` (everything scanned is `shipped` or
`partial`) — but the rule stands for whenever one appears, including
forward-looking work like the Economy System `CLAUDE.md` lists under
"Scheduled (Later)," which as of this commit has no spec file at
`docs/features/` at all — confirmed by listing the directory — so if it
becomes the manifest's first `planned` entry, its Callout is the `spec: null`
case, not a spec link.

---

## Required page skeleton (feature guide, minimum)

Roughly 70 pages, three audiences, multiple subagents writing them — without
a shared shape, every page invents its own, and "consistent docs" stops being
true the moment two subagents pick different structures. Every feature guide
page (user or self-hosting; developer pages follow the same spine but their
sections carry code, not walkthroughs) opens with these sections, in this
order, and does not skip one:

| # | Section | Content |
| --- | --- | --- |
| 1 | Title + one-line summary | What the feature does, in one sentence, no jargon. |
| 2 | Status callout (if not `shipped`) | Per Rule 9 (`planned`) or the partial-disclosure paragraph (Rule 3, `partial`). Omit entirely for `shipped` — a callout on a working feature is noise. |
| 3 | Prerequisites | What must be true first (a role configured, a channel set, a permission the reader needs) — per Rule 4's "must contain" table for the page's audience. |
| 4 | How to configure / use it | The dashboard path or command, per the audience table in Rule 4. |
| 5 | What each setting/option does | One entry per control, each with its observable effect — not just its name. |
| 6 | Related pages | Cross-links, respecting Rule 3's audience wall — a user page never links to a developer-only feature like `queue`. |

A page missing section 1, 2 (when required), or 4 is not publishable. A page
that has all six headings but section 4 restates the feature summary instead
of naming the actual control, per Rule 4's table, is not either — heading
presence isn't compliance, content is.

---

## The path guard: what it blocks and how to work with it

`.claude/hooks/docs-path-guard.sh` runs on every write under `apps/docs/**`
and denies the write if the content cites a repo path that does not exist.
You will be blocked by this. It is not a bug to route around — it is the
mechanical enforcement of Rule 1, catching exactly the class of error
`CLAUDE.md`'s stale `apps/bot/src/commands/` paths represent.

How a cited path resolves:

- A **bare path** (no leading `./` or `../`) is a repo-root claim, checked
  against the repo root — e.g. `apps/bot/src/features/moderation/commands/ban.ts`.
- A path starting with **`./` or `../`** resolves against the directory of
  the file being written, not the repo root and not the guard's own working
  directory.
- A `../` chain that would leave the repo entirely is always treated as
  missing.
- Inside `apps/docs/package.json` specifically, a bare path is checked
  against the package directory first, then the repo root — because
  `pnpm`/`npm` run scripts execute with the package directory as `cwd`.

**Known limitation: code fences are not exempt.** A relative import shown
inside a fenced code block — for example `import { x } from "../lib/foo"` in
a snippet illustrating usage — is checked exactly like prose, against the
page's own directory. This will come up constantly when documenting import
statements or example snippets, because the snippet's "current file" is
whatever real file you're documenting, not the docs page. If the import path
in the snippet is illustrative rather than a literal copy-pasteable path,
don't write it as a bare relative import the guard can parse as a real
claim — or use the escape marker below.

**Being blocked usually means the path is wrong, not that the guard is
wrong.** Before reaching for the escape marker, re-verify the path against
the actual source tree — the guard has already been right about this once in
this repo's history (see Rule 1). Only use the marker when the path is
*deliberately* not real: a file the reader is instructed to create, or a
made-up example path used for illustration.

The escape marker:

```
<!-- docs-path-guard: allow path/one, path/two reason: "why these are intentionally not real" -->
```

A marker with no reason exempts nothing — the guard requires the `reason:`
clause to be present and non-empty. Write the actual reason; a placeholder
reason is a lie the guard will happily accept but the next reader won't.

---

## Summary for quick reference

| Situation | Rule |
| --- | --- |
| About to cite `CLAUDE.md`, `PROJECT_INDEX.md`, `docs/features/*.md`, or `docs/implementation-plan.md` as fact | Don't. Verify against source or the manifest instead. (Rule 1) |
| A spec and source disagree on a shipped feature | Source wins, unconditionally. Don't mention the spec's number even as history. (Rule 1) |
| About to state an option, default, env var, or permission | Point to the source line first, or omit the claim. (Rule 2) |
| About to write "appears to," "likely," "probably," "seems to," or "should" about an unread fact | Don't — that's the signal to go read the source instead. (Rule 2) |
| Writing a feature's status | Read `apps/docs/_manifest.json`; check `audience` before it goes in the user guide. (Rule 3) |
| Writing a `partial`-status page | State what exists and what's missing in the same sentence — never describe it as whole. (Rule 3) |
| Writing for users or self-hosters | No file paths, no framework internals — and see Rule 4's "must contain" table for what has to be present instead. (Rule 4) |
| A command has no `setDefaultMemberPermissions` call | State the practical consequence — invocable by any member who can see the channel — not just "no gate declared." (Rule 5) |
| Documenting a slash command's permission | Quote the literal `setDefaultMemberPermissions` value from source. (Rule 5) |
| About to write "simply"/"just"/"easy"/"obviously" | Don't. (Rule 6) |
| Choosing a language | English only, prose is not subject to the 48-locale i18n rule. (Rule 7) |
| Showing an install/dev/test command | Docker-wrapped form only. (Rule 8) |
| Documenting a `planned` feature | `<Callout type="warn">` + spec link (or an explicit "no spec exists yet" if `spec` is `null`), labeled spec-derived. (Rule 9) |
| Starting a new feature-guide page | Follow the six-section skeleton — heading presence alone isn't compliance. (Page skeleton) |
| Write blocked by `docs-path-guard.sh` | Re-check the path first; escape marker only for deliberately-fake paths, with a real reason. |
