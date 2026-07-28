# TempVoice Config Redesign — Design

**Date:** 2026-07-27
**Status:** Approved (brainstorming complete, ready for implementation plan)
**Scope:** Dashboard client, plus one bundled one-word bot fix (see *Bundled fix*). No DB migration,
no API change.

## Problem

The TempVoice config page never explains the mechanic it configures. An admin lands on
`/guild/$guildId/tempvoice`, sees a field labelled "Hub Channel \*", and has no way to learn from the
page that *joining that channel is what spawns a temporary voice channel*, or that the spawned
channel deletes itself when it empties. The concept has to be known in advance.

This was diagnosed explicitly during brainstorming. Three other candidate problems were offered and
**rejected** as not the issue:

- the channel picker not being searchable,
- having to pre-create the hub channel in Discord,
- `{user}` template syntax being jargon.

The page has only three settings and that is not changing. The complaint is comprehension, not
volume.

## Scope

### In scope

Restructuring the dashboard config surface for the three existing settings — `hubChannelId`,
`categoryId`, `nameTemplate` — so the structure itself teaches the join-to-create lifecycle.

### Explicitly out of scope

- **The in-Discord owner panel.** `buildPanelButtons()` in
  `apps/bot/src/features/tempvoice/system/manager.ts` renders 13 emoji buttons across 4 rows with
  split opposites (Ban/Unban, Hide From/Unhide From). It is the more obviously complex surface and it
  is deliberately untouched.
- **New settings.** Channel defaults (user limit, bitrate, start locked), access limits (required
  role, cooldown, max per user), and panel-button toggles were each offered and each declined.
- **Backend.** `useTempVoice.ts`, the Fastify routes, Prisma schema, and the bot are unchanged.

## Approach

Chosen from three options: a **flow card**, where the three settings become three steps of the
temporary channel's lifecycle.

Rejected alternatives:

- **Guided wizard** — a modal with a concept screen then one field per step. Strongest first-run
  teaching, but four steps and a modal to change one field, it fits editing badly, and the concept
  screen becomes pure friction from the second hub onward.
- **Explainer strip** — a "How temp voice works" band above the current form. Cheapest, but a banner
  above a settings form is the most reliably skipped element on the page, and it leaves the fields
  themselves unexplained.

The flow card explains at the moment of decision, so it cannot be skipped, and one component serves
read and edit, so the saved-hub list documents the concept too.

## The flow

Four steps. The fourth deliberately has **no control**:

| Step | Label | Control |
|------|-------|---------|
| 1 | When someone joins this voice channel… | `DiscordSelect type="voice"` |
| 2 | …FluxCore makes them a channel named… | `VariableEditor` + resolved preview chip |
| 3 | …placed in… | `DiscordSelect type="category" allowNone` |
| 4 | …and it's deleted automatically once everyone leaves. | *none* |

Step 4 exists purely to close the mental model. The lifecycle's ending was the invisible half — the
page previously gave no indication that channels clean themselves up.

Step 2's preview renders as a channel chip (`🔊 Ahmad's Channel`) styled like step 1's picker, not as
the current grey text line, so template syntax resolves into something recognisably a Discord
channel.

## Three states, one component

**Empty** — the flow rendered as a filled-in worked example with a "Create your first hub" CTA,
replacing the current "No configurations yet" empty state. An admin learns the mechanic before
creating anything.

The example is **not** dimmed with opacity. Muted-but-AA-compliant token colours at full opacity,
with non-interactivity signalled structurally (dashed borders on the fake controls, no focus ring,
`inert`). Teaching content must meet 4.5:1; it cannot be decorative.

It also needs a caption (`empty.exampleCaption`, new) marking it as an example. Visually the dashed
controls carry that meaning, but a screen-reader user hearing "When someone joins this voice
channel… Join to Create" with no framing would reasonably conclude a hub is already configured.

**Collapsed** — each saved hub compresses to a one-line chain reusing the same step numbers and
channel chips, so ten hubs still fit on screen while the concept stays visible.

**Editing** — clicking Edit expands that card in place into the full vertical flow. No modal, no page
jump, other hubs stay put. Add appends a new card already expanded. Only one card is ever expanded.

In-place editing over a dialog keeps read and edit as one component and avoids focus-trap and
unsaved-changes machinery.

## Components

`TempVoiceForm.tsx` (282 lines, currently holds the list, the form, fetching, validation, submit, and
delete) is deleted and replaced:

| File | ~Lines | Responsibility |
|------|--------|----------------|
| `TempVoiceHubList.tsx` | 90 | Orchestrator: fetches configs, owns which card is expanded, holds mutations, enforces the 10-hub cap |
| `HubCard.tsx` | 110 | One hub — summary or editor by mode; owns its three draft fields and their errors |
| `HubFlow.tsx` | 70 | Presentational scaffold: numbered circle, label-above-control, connecting rail |
| `HubSummary.tsx` | 45 | The collapsed one-line chain |
| `ChannelChip.tsx` | 25 | 🔊/📁 name chip |

All under `apps/dashboard/src/client/features/tempvoice/components/`.

`HubFlow` is a separate file specifically because the editor *and* the empty state both render it.
That shared scaffold is what stops the empty state drifting into a lookalike.

**State ownership.** The orchestrator owns `expanded: number | "new" | null` — this is what enforces
one-card-open-at-a-time. Each `HubCard` owns only its own draft, seeded from props on entering edit
mode. Nothing else is lifted.

## Shared-component change

`DiscordSelect` gains an optional `excludeIds?: string[]` prop, filtering options before render. It
has no such prop today. The change is additive and no existing call site is affected.

This is used to hide hub channels already claimed by another config. **Convenience only** — the
server is the real guard (`routes.ts` returns 400 "This channel is already a temp voice hub"), and a
duplicate can still land when a hub is added in another tab, so the error is handled rather than
merely prevented.

## Data flow

Unchanged. `useTempVoiceConfigs` / `useCreateTempVoice` / `useUpdateTempVoice` / `useDeleteTempVoice`
stay exactly as they are. `useChannels` is already a react-query hook, so `DiscordSelect` and
`HubSummary` share one cached fetch rather than issuing two.

## Error handling

The current code renders a single `error` string in two places, inside and outside the form. Instead:

- **Validation** — errors render under the offending step; focus moves to the first invalid control.
- **API 400s** (duplicate hub, cap reached, invalid channel, template too long) — an Alert inside the
  expanded card; the card stays expanded so the input is not lost.
- **Delete** — an Undo toast, not a confirm dialog. Deletion is currently instant with no
  confirmation at all; the Undo toast matches the pattern already established on the Automation rules
  page rather than inventing a second destructive-action idiom.
- **Initial load** — existing `FormSkeleton`.

## i18n

The `tempvoice` namespace in `packages/i18n/src/locales/<lang>/tempvoice.json` is rewritten across all
48 locales, with real translations up front — no English placeholders.

Every existing key is accounted for below — none are left dangling and none are silently reused with
a changed meaning:

| Existing key | Fate |
|---|---|
| `label`, `title`, `subtitle` | Kept as-is |
| `form.hubChannel`, `form.category`, `form.nameTemplate` | **Removed** — replaced by `flow.step1`–`step3`, which carry the label text |
| `form.nameTemplateHint` | **Removed** — the flow itself explains the substitution |
| `form.addConfig`, `form.editConfig` | **Removed** — expanded cards have no heading |
| `form.selectHub` | → `fields.hubPlaceholder` |
| `form.sameAsHub` | → `fields.categoryNone` |
| `form.defaultNameTemplate` | → `fields.templatePlaceholder` |
| `form.save`, `form.saving`, `form.cancel` | → `editor.save`, `editor.saving`, `editor.cancel` |
| `form.edit`, `form.delete` | → `list.edit`, `list.delete` |
| `hubs.configured` | → `list.heading` |
| `hubs.add` | → `list.add` |
| `hubs.hubLabel`, `hubs.templateLabel`, `hubs.categorySuffix` | **Removed** — the summary chain replaces these concatenated fragments |
| `empty.noConfigs`, `empty.noConfigsDesc` | **Removed** — the worked example replaces the "nothing here" copy |
| `empty.addFirst` | → `empty.cta` ("Create your first hub") |
| `toast.created`, `toast.updated`, `toast.removed` | Kept |

Added: `flow.step1`–`flow.step4`; `list.counter` (`{{used}}`/`{{max}}`); `summary.sameCategory` and
`summary.deletedWhenEmpty`; `empty.exampleCaption`; `toast.undo`; `errors.*` for the field-level
validation messages.

Two constraints from prior incidents in this repo:

- **The four step labels are whole sentences, never concatenated fragments.** `"…placed in…"` is one
  translatable string and the control follows the label, so translators can move or drop the ellipsis
  without fighting the layout. This is also the constraint that bounds the fill-in-the-blank idea —
  controls never sit mid-clause, because word order differs across the 48 locales and inverts under
  RTL.
- **The hub counter interpolates `{{used}}` and `{{max}}`, never `count`.** i18next treats `count` as
  the plural trigger; a variable named `count` without every plural category silently breaks Arabic,
  Russian, and others.

Locale files are edited in `src/locales` (the app serves `dist/locales`). `JSON.stringify(obj, null, 2)`
is not format-preserving in this repo — several files are semi-compact or carry `\u` escapes — so
edits must be text-excising rather than round-tripped, gated on zero unintended insertions.

## RTL

- The rail and step numbers use logical properties (`ms-`/`me-`), not `ml-`/`left`.
- The collapsed chain's separator is a Lucide chevron with `rtl:-scale-x-100`, not a literal `→`,
  which does not flip with direction. Lucide icons are never filled.

## Accessibility

- The flow is a real `<ol>` with one `<li>` per step, so screen readers announce position ("1 of 4").
  The numbered circles become `aria-hidden` decoration.
- Each step label is a genuine `<label htmlFor>`, not a placeholder.
- Focus moves to step 1's picker when a card expands, and returns to the Edit button that opened it
  on cancel.
- Edit and Delete get ≥44px hit areas; the current `size="sm"` buttons are under that.
- Empty-state text meets 4.5:1 (see above).

**To verify during implementation, not assumed:** `VariableEditor` gained an `aria-live` region
during the automation a11y audit. The preview chip needs its resolved name announced, but a second
live region would double-announce. Reuse whatever `VariableEditor` already exposes rather than adding
one.

## Bundled fix

The bot resolves the template with `template.replace("{user}", …)` in `manager.ts`, which replaces
only the **first** occurrence. `resolveTemplatePreview` in the dashboard tokenizes and replaces
**all** of them. So `{user} & {user}` previews as "Ahmad & Ahmad" but really creates "Ahmad & {user}".

Harmless while the preview is an ignorable grey line; this design promotes it to a hero chip, which
makes the divergence user-visible. One-word fix (`replaceAll`) on the bot side, as a separate commit
in this branch.

## Testing

Server route tests at `apps/dashboard/tests/server/features/tempvoice/tempvoice.test.ts` are untouched
and stay green — the API does not change. There are no client tests for TempVoice today, so all of
these are new, at `apps/dashboard/tests/client/features/tempvoice/`. No `any`, no `as`.

| Test | Asserts |
|------|---------|
| `HubFlow` | Four `<li>` steps; step 4 renders no form control |
| `HubCard` collapsed | Summary shows resolved name and category |
| `HubCard` expanded | Controls seeded from the config |
| Validation | Empty hub → error under step 1, focus lands there |
| Duplicate hub 400 | Alert inside the card; card stays expanded |
| Cap | At 10 hubs, Add is hidden |
| `excludeIds` | Used hub channels absent from picker options |
| Empty state | Worked example and CTA render |
| Delete | Undo toast restores the hub |
| `tempvoice` i18n parity | All 48 locales match English keys; no value left identical to English |

The parity test is new and worth adding because **nothing currently guards this** — the only parity
test in the repo covers the `palette` block of `common.json`. Model it on
`apps/dashboard/tests/client/shared/command-palette/i18n-parity.test.ts`, which already catches both
missing keys and untranslated values.

## Verification caveats

- `pnpm typecheck` does not look at `apps/dashboard/tests/**` — both tsconfigs are src-only. Type
  errors in test files surface only when the suite runs.
- `pnpm test` is currently red on main for unrelated bot reasons (guildMemberAdd/ready tests reach a
  real Postgres). Compare against merge-base rather than claiming a green suite.
