# Searchable Event-Type Picker — Design Spec

**Date:** 2026-07-09
**Status:** Approved
**Branch:** `feat/rules-searchable-event-picker`

## Problem

The automation rule builder's trigger panel picks which Discord event fires a
rule from a plain Radix `<Select>` dropdown
([NodeDetailPanel.tsx](../../../apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx),
lines 198–209). There are 18 event types today and the list keeps growing, but
the dropdown has no search — you scroll to find an event.

The dashboard already has the pattern we want:
[discord-select.tsx](../../../apps/dashboard/src/client/shared/ui/discord-select.tsx)
is a Popover-based searchable picker (trigger button → auto-focused search input
→ filtered list → checkmark + empty state). It is hardwired to channels/roles.

## Goal

Give the event-type picker a search box, by **extracting the searchable-picker
shell from `DiscordSelect` into a reusable, data-agnostic `SearchableSelect`
component** and consuming it from both `DiscordSelect` and the event picker.

Chosen approach: **B — generalize into a reusable `SearchableSelect<T>`.**
(Approach A was a bespoke `EventTypeSelect`; C was a search input inside Radix
`Select`, rejected because Radix Select hijacks keyboard focus/typeahead.)

## Non-goals

- No change to `DiscordSelect`'s public API or appearance.
- No new dependency (no `cmdk`/Command — it is not installed).
- No backend, schema, API, or `constants.eventTypes` changes.
- No i18n retrofit of `DiscordSelect` (it keeps its current hardcoded strings).

## Components

### 1. `SearchableSelect` (new)

**File:** `apps/dashboard/src/client/shared/ui/searchable-select.tsx`

Purely presentational. Knows nothing about channels, roles, or events. It is the
Popover shell lifted out of `DiscordSelect` verbatim (same Tailwind classes and
SVGs, so consumers look unchanged): trigger `<button>` with selected
label/icon + chevron, `PopoverContent` sized to
`w-(--radix-popover-trigger-width)`, an auto-focused (RAF) search input that
clears on open, a `max-h-56` scrollable list with hover styles and a checkmark
on the selected row.

```ts
interface SearchableSelectOption {
  value: string;
  label: string;        // rendered + searched
  keywords?: string;    // extra searchable text (e.g. an event description)
  icon?: React.ReactNode; // optional leading icon, shown per-row and on trigger
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;          // default "None"
  disabled?: boolean;
  loading?: boolean;           // renders <SelectSkeleton />
  error?: boolean;             // renders disabled error button
  errorLabel?: string;         // default "Failed to load"
  emptyLabel?: string;         // options list is empty (no query)
  noResultsLabel?: string;     // query matched nothing; default "No results found"
  searchPlaceholder?: string;  // default "Search..."
  className?: string;
}
```

**Filter:** case-insensitive `includes` over `label + " " + (keywords ?? "")`.
**Selection:** clicking a row calls `onValueChange(value)` and closes the popover;
the `allowNone` row (when enabled) calls `onValueChange(null)` and closes.

### 2. `DiscordSelect` (refactor)

**File:** `apps/dashboard/src/client/shared/ui/discord-select.tsx`

Keep its data logic (`useChannels`/`useRoles`, `channelLabel`, type filtering).
Replace the inline Popover/search/list JSX with `<SearchableSelect>`:

- Map channels/roles → `options` (`{ value: id, label }`, no `icon`, so the
  emoji-prefixed labels render exactly as today).
- Pass `loading={isLoading}`, `error={isError}`, `allowNone`, `disabled`,
  `placeholder`, `className`.
- Pass `emptyLabel={isRole ? "No roles available" : "No channels available"}`
  and the existing `errorLabel` / search placeholder strings so its text and
  look are byte-for-byte unchanged.

Its exported `DiscordSelectProps` and behavior are untouched — no consumer changes.

### 3. Event picker (integration)

**File:** `apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx`
(`TriggerPanel`, lines 198–209)

Replace the `<Select>…</Select>` block with:

```tsx
<SearchableSelect
  value={eventType || null}
  onValueChange={(v) => v && onEventTypeChange(v)}
  placeholder={t("panel.selectEvent")}
  searchPlaceholder={t("panel.searchEvent")}
  noResultsLabel={t("panel.noEventResults")}
  options={eventOptions}
/>
```

where `eventOptions` is a `useMemo` over `constants.eventTypes`:

```ts
const eventOptions = useMemo(
  () =>
    Object.entries(constants.eventTypes).map(([value, info]) => ({
      value,
      label: info.label,
      keywords: info.description,
      icon: <Icon name={EVENT_ICONS[value] ?? "bolt"} size={16} />,
    })),
  [constants.eventTypes],
);
```

`EVENT_ICONS` comes from
`apps/dashboard/src/client/features/automation/lib/rule-icons.ts` (same map
[RuleList](../../../apps/dashboard/src/client/features/automation/components/RuleList.tsx)
uses). The description box already rendered below the picker (lines 211–217)
stays as-is. `allowNone` is omitted (false) — the picker always yields a string.

## i18n

`TriggerPanel` is fully translated (`useTranslation(["rules", "common"])`), so the
two new user-facing strings get keys in the `rules` namespace:

- `panel.searchEvent` → e.g. "Search events…"
- `panel.noEventResults` → e.g. "No events found"

Add them to `packages/i18n/src/locales/en/rules.json` **and sync `dist`** (the app
serves `dist/locales`; other locales fall back to `en`).

## Tests (mandatory)

- **New** `apps/dashboard/tests/client/shared/ui/searchable-select.test.tsx`
  (RTL + user-event, both already set up):
  - opens the list on trigger click;
  - renders all options; filters the list as the user types; shows
    `noResultsLabel` when nothing matches;
  - renders the `allowNone` row and emits `null` when picked;
  - `loading` renders the skeleton; `error` renders the error button;
  - selecting a row calls `onValueChange(value)` and closes the popover.
- **`DiscordSelect`**: check for an existing test; since we modify it, add a
  smoke test (renders selected label, filters options) if none exists.
- **Regression**: keep `NodeDetailPanel` / rules tests green.

## Scope summary

1 new component (`searchable-select.tsx`) · `discord-select.tsx` refactored to
consume it (API unchanged) · 1 swap in `TriggerPanel` + a `useMemo` mapping · 2
i18n keys (+ dist sync) · new `searchable-select` test + DiscordSelect smoke test.
No new dependencies. No backend/schema/API changes.
