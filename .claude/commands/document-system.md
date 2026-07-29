---
description: Orchestrates FluxCore's documentation system — regenerates the manifest, finds user-guide coverage gaps, dispatches docs-writer then docs-verifier per gap (with correction rounds), and reports what remains
argument-hint: "[feature-id]"
---

# /document-system

You are the orchestrator for FluxCore's documentation system. You own three
things none of the three subagents you dispatch are allowed to own:
regenerating the manifest, deciding what counts as "done," and never letting
a gap go unreported. Read this whole file before running anything — the
ordering and the stop conditions below are load-bearing, not suggestions to
reorder for convenience.

The governing content rules for every page (source-over-spec, no invention,
audience discipline, the six-section skeleton, the permission-gate wording,
the path guard) live in `docs/superpowers/prompts/docs-standing-rules.md`.
This file does not restate them — `docs-writer` and `docs-verifier` each
read that document in full on every invocation. Your job is orchestration:
get the right work in front of the right agent with the right inputs, and
refuse to call the run finished until the evidence says so.

## Read this first — a known, expected failure

`docs-inventory`, `docs-writer`, and `docs-verifier` (`.claude/agents/*.md`)
were authored in this same working session's history. Claude Code memoizes
its agent-definition loader (`getAgentDefinitionsWithOverrides`) and only
re-reads `.claude/agents/` on session start — there is no cache-invalidation
path available mid-session. **If you dispatch any of the three and get back
`Agent type '<name>' not found`, this is that cache, not a missing or broken
file.** Stop immediately. Do not attempt to perform the agent's job yourself
inline (writing or verifying a page without the agent is exactly the
narrow-scope, single-purpose guarantee these three agents exist to provide —
routing around a missing agent by improvising its work defeats the reason it
has its own file). Report plainly: which agent type failed to dispatch, that
this is the session-restart cache issue, and that the fix is to start a new
session (or run `/clear`) and re-invoke `/document-system`. Do not report
partial success for work you improvised as a substitute.

## Scope: `$ARGUMENTS`

`$ARGUMENTS` is empty for a full run (every coverage gap) or a single
feature id for a scoped run (e.g. `/document-system leveling`). Trim
whitespace; if what remains is empty, this is a full run. Otherwise it names
exactly one feature id to act on — validate it against the manifest in Step
1 before doing anything else with it (Step 3 below). Never guess a
correction to a typo'd id — report the mismatch and the list of valid ids
instead, the same way `docs-writer` itself refuses to proceed on an id it
can't find.

## Step 1 — regenerate the manifest (host, not Docker)

Run, via the `Bash` tool, on the host:

```bash
pnpm --filter @fluxcore/docs manifest
```

**Do not wrap this in `docker compose`/`docker exec`.** The manifest builder
shells out to `git` to stamp `generatedFromCommit`
(`apps/docs/scripts/manifest/build.mjs`), and the bot/docs containers have
no `git` binary and no `.git` mount — running it in Docker doesn't fail
loudly, it silently produces a manifest with `generatedFromCommit: null`,
which every downstream consumer of the manifest (including `docs-inventory`,
if anyone later runs it) is required to treat as permanently, unrecoverably
stale. This is the one command in this whole flow that is host-only for a
specific, verified reason — every other `pnpm --filter @fluxcore/docs *`
command below (`check-coverage`, and the `test` command mentioned for
completeness) is either also host-safe (pure Node `fs` reads, no `git`, no
DB) or is explicitly Docker-wrapped where it isn't
(`docker compose --profile bot run --rm bot pnpm --filter @fluxcore/docs
test` — not invoked by this command, only relevant if you separately choose
to run the subagents' output through the docs test suite).

`guard-pnpm.sh` only blocks `pnpm add/install/remove` outside Docker, not
`pnpm --filter ... manifest` or `check-coverage` — you will not be blocked
running either on the host.

**If this command exits non-zero or errors**, stop the whole run right here.
Every later step trusts this manifest; proceeding on a manifest that failed
to regenerate means every downstream claim about "what's covered" is
unverified. Report the failure and do not continue.

Regenerating the manifest here, unconditionally, on every invocation, is
also why this flow does not separately invoke `docs-inventory`:
`docs-inventory`'s entire job is auditing whether a manifest *might be*
stale without the ability to fix it — a real need for someone reading the
manifest cold, but this command never reads it cold. It regenerates first,
which is a strictly stronger freshness guarantee for the run that follows
than an audit of a manifest it didn't just build.

## Step 2 — find the gaps

Run, via `Bash`, also on the host (this is a pure Node `fs` script — no
`git`, no database, nothing Docker-only about it):

```bash
pnpm --filter @fluxcore/docs check-coverage
```

Read `apps/docs/scripts/check-coverage.mjs` yourself if you have any doubt
about the shape below — it is short and this is its actual, current
behavior, not a paraphrase:

- **Exit code is 1 when there is a gap in either direction, 0 when there is
  none.** A non-zero exit here is the expected "there is work to do" signal
  — it is not a command failure and must not abort the run. Only treat this
  step as having *actually* failed if the output isn't the structured report
  below (e.g. a stack trace, a thrown error, `manifest not found`) — that
  kind of failure means stop and report, same as Step 1.
- On success, stdout is a single line: `✓ Documentation coverage check
  passed (N feature page(s), M user-facing feature(s)).`
- On failure, stderr contains, in this exact structure:

  ```text
  ✗ Documentation coverage check failed:

    Manifest entries with no page:
      - guide/features/<id>.mdx
      ...
    Pages with no manifest entry:
      - guide/features/<file>.mdx
      ...
  ```

  Either list may be absent if that direction has no gap. Parse the
  `Manifest entries with no page:` block into your **missing-pages list**
  and the `Pages with no manifest entry:` block into your **orphan-pages
  list**. Each entry's `<id>` is the feature id (the `.mdx` filename minus
  extension); the full path for writing is
  `apps/docs/content/guide/features/<id>.mdx`.

**Audience exclusion is already handled — do not re-derive it.** The script
only ever asks for a page for features with `audience: "user"`; the five
current `audience: "developer"` features (`auth`, `discord`, `guilds`,
`i18n-accessibility`, `queue` as of this manifest — re-read the manifest's
actual `audience` fields each run rather than trusting this list, per the
standing rules) never appear in the missing-pages list, and you must not add
them to your work list even if someone scoped `$ARGUMENTS` to one of them
(handled explicitly in Step 3).

**Orphan pages are not this command's to fix.** None of the three subagents
can delete a file (`docs-writer` has `Write, Edit`, not delete; the other
two are read-only), and this command has no mandate to delete documentation
either. Carry the orphan-pages list through unmodified to the final report
as a finding for a human to act on — do not silently drop it, and do not
improvise a deletion yourself.

## Step 3 — build the work list

Start from the missing-pages list from Step 2.

**Full run (`$ARGUMENTS` empty):** the work list is every entry in
missing-pages, each mapped to its feature id and audience (`user` — the only
audience `check-coverage.mjs` ever asks for, confirmed above).

**Scoped run (`$ARGUMENTS` names an id):** look the id up in the manifest's
`features[]` yourself.

- **Not found at all:** stop, report the id was not found, and list every
  id that *is* present in `features[]` — mirroring `docs-writer`'s own stop
  condition for exactly this situation. Do not proceed.
- **Found, but `audience !== "user"`:** this feature is out of scope for
  this command by design, not a gap this command failed to close — report
  it plainly as "excluded (developer-audience; no user-guide page is
  expected for this id)" and end the run there. Do not invent an output
  path or an audience for it; `docs-writer` has no established convention
  for a developer-page path and guessing one is exactly the invention Rule
  2 forbids.
- **Found, `audience === "user"`, id is in missing-pages:** work list is
  that single entry.
- **Found, `audience === "user"`, id is NOT in missing-pages:** there is no
  gap — the page already exists and coverage already passes for it. Report
  this plainly ("already covered, nothing to do") rather than silently
  exiting with no output. Do not fabricate a "success" that implies work
  happened.

If the work list is empty for any reason above, skip straight to Step 5
(final report) — do not skip reporting just because there was nothing to
write.

## Step 4 — per gap: write, verify, correct

For every `{id, outputPath, audience: "user"}` in the work list, run this
sub-flow. Different features' sub-flows are independent (distinct output
files, no shared state) and MAY be dispatched in parallel — batch multiple
`docs-writer` calls for different ids in one message if there are several,
per the `Agent` tool's own guidance on independent work. **Within one
feature's sub-flow, the steps are strictly sequential** — `docs-verifier`
reads the file `docs-writer` just wrote, so it cannot start until that
specific `docs-writer` call has returned. Use `run_in_background: false` on
every dispatch below so each step's result is in hand before the next one
launches.

1. **Dispatch `docs-writer`.** Invoke the `Agent` tool with
   `subagent_type: "docs-writer"`. The prompt must state, as explicit,
   unambiguous fields — these are the three required inputs the agent will
   halt without, so do not bury them in prose:
   - Feature id: `<id>`
   - Output path: `apps/docs/content/guide/features/<id>.mdx`
   - Audience: `user`

2. **Dispatch `docs-verifier`.** Invoke the `Agent` tool with
   `subagent_type: "docs-verifier"`, `run_in_background: false`, giving it
   the page path and the feature id (its two required inputs). Read its
   report in full — it is an evidence log, not a verdict; the section that
   matters here is "Flagged claims."

3. **If `docs-verifier` retained zero flags:** this page is done. Record it
   as **written, verified clean**.

4. **If `docs-verifier` flagged anything:** a flagged page is not done, and
   a flag that gets logged and ignored makes the verifier decorative — that
   is explicitly not acceptable. Re-dispatch `docs-writer` for the *same*
   `{id, outputPath, audience}`, and additionally include, verbatim, the
   "Flagged claims" section from the verifier's report, prefixed with:
   "A verification pass flagged the following claims in this page — for
   each one, either fix it using source you read this run, or remove it;
   do not re-assert a flagged claim without new source backing it." Then
   re-dispatch `docs-verifier` on the corrected page (step 2 again).

   **Cap this correction loop at 2 additional rounds (3 `docs-writer` calls
   total per page).** If `docs-verifier` still retains a flag after the
   3rd `docs-writer` pass, stop looping on this page. Record it as
   **written, unresolved** and carry its exact remaining flagged claims
   into the final report — this is a failure state for this page, not a
   detail to omit because the loop had to end somewhere.

Every id that started in the work list must end Step 4 in exactly one of:
**written & verified clean**, **written & unresolved (with the flags that
remain)**, or (for the developer-audience / not-found / already-covered
cases resolved in Step 3) its Step-3 disposition. An id present in the work
list at the start of Step 4 and absent from this accounting at the end of it
is the specific failure this command exists to make impossible — if you
notice one, that is a bug in this run, not a detail to smooth over in the
report.

## Step 5 — re-run coverage, and use its output as your evidence

Run Step 2's command again:

```bash
pnpm --filter @fluxcore/docs check-coverage
```

This is not optional and not a formality. Your final report's claim about
what's covered must be backed by this command's actual output from this
run, not by an assumption that every dispatched `docs-writer` call
succeeded. Quote the literal output (the `✓ ...` line, or the full
`✗ ...` block with both lists) in your report.

## Step 6 — final report

Report, in this order:

1. **Scope of this run** — full run, or the one feature id, with its Step-3
   disposition if it wasn't a normal write.
2. **Manifest regeneration** — pass/fail (Step 1).
3. **Starting coverage gap** — the missing-pages and orphan-pages lists from
   Step 2, as found.
4. **Per-feature outcome** — every id from the work list, each labeled
   written & verified clean / written & unresolved (with its remaining
   flagged claims, if any) / excluded (developer-audience) / already
   covered / not found. No id silently absent.
5. **Final coverage check output** — the literal output from Step 5, quoted.
6. **Orphan pages** — carried through unmodified from Step 2/5, flagged for
   human action; this command does not delete pages.
7. **Overall verdict** — state plainly whether the run is fully clean (Step
   5's output is the `✓` line and every Step-4 id resolved
   "verified clean") or not. **Do not report the run as a success if any
   page is in the "written & unresolved" state, if Step 5's final output is
   still the `✗` block, or if an `Agent type ... not found` error stopped
   the run early** — any of those is a partial or failed run, and must be
   labeled as such, not rounded up.
