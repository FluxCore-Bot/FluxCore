# Security Page UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/security.tsx`
**Component:** `SecurityPage`
**Lines:** 460

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle)
  Card.bg-surface.p-6                              [Master toggle]
    div.flex.items-center.justify-between
      h3 + p
      Switch (enabled)
  Tabs (defaultValue="join-rate")
    TabsList
      TabsTrigger "join-rate"
      TabsTrigger "account-age"
      TabsTrigger "anti-nuke"
      TabsTrigger "lockdown"
      TabsTrigger "events"
    TabsContent "join-rate"
      Card.bg-surface.p-6
        h3 + p + Separator + grid (threshold, window, action)
    TabsContent "account-age"
      Card.bg-surface.p-6
        h3 + p + Separator + grid (minAge, action)
    TabsContent "anti-nuke"
      Card.bg-surface.p-6
        div (title + Switch) + Separator + grid (threshold)
    TabsContent "lockdown"
      Card.bg-surface.p-6
        div (title + Switch) + Separator + (whitelistedRoles, logChannel)
    TabsContent "events"
      Card.bg-surface.p-6
        h3 + p + Separator + [Events list + pagination | empty]
  div.flex.gap-3                                   [Save button]
    Button (save)
```

### Helper Components (Inline)

1. **`ActionSelect`** (lines 28-53) -- Custom inline component wrapping a native `<select>` element
2. **`RaidEventRow`** (lines 79-113) -- Custom event display row with Badge, details, timestamp

### Component Tree

- `PageHeader` -- title, subtitle only
- `Card` x6 -- master toggle + 5 tab contents
- `Switch` x3 -- master enabled, antiNukeEnabled, lockdownOnRaid
- `Tabs` > `TabsList` > `TabsTrigger` x5
- `TabsContent` x5
- `Input` x6 -- joinThreshold, joinWindow, accountAgeMinDays, antiNukeThreshold, whitelistedRoleIds, logChannelId
- `Label` x6 -- for all inputs
- `ActionSelect` (native `<select>`) x2 -- joinAction, accountAgeAction
- `Separator` x5 -- in each tab content section
- `Badge` -- in each RaidEventRow
- `Button` x3 -- save, pagination prev/next (in events tab)
- `RaidEventRow` -- per event in events list

---

## Components Inventory

| Component | Variant/Props | Count | Notes |
|-----------|--------------|-------|-------|
| `PageHeader` | title, subtitle | 1 | No actions, no label |
| `Card` | className="bg-surface p-6" | 6 | Master toggle + 5 tabs |
| `Switch` | checked, onCheckedChange | 3 | enabled, antiNukeEnabled, lockdownOnRaid |
| `Tabs` | defaultValue="join-rate" | 1 | Uncontrolled |
| `TabsTrigger` | value | 5 | join-rate, account-age, anti-nuke, lockdown, events |
| `Input` | type="number" | 4 | Threshold/window/age/nuke threshold |
| `Input` | type="text" | 2 | Whitelist roles, log channel |
| `Label` | htmlFor | 6 | All inputs |
| `Separator` | className="mb-6" | 5 | Section dividers |
| `Badge` | variant varies | per event | destructive, secondary, outline, default |
| `Button` | default | 1 | Save |
| `Button` | variant="outline" size="sm" | 2 | Pagination |
| **Native `<select>`** | -- | 2 | **ActionSelect component** |

### `ActionSelect` Component (Lines 28-53)

This is a **custom native `<select>`** element, not using shadcn's `Select` component:

```tsx
<select
  className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
>
```

**This violates the shadcn/ui component rule.** The classes manually replicate shadcn `SelectTrigger` styling but miss:
- The dropdown portal behavior
- The custom chevron icon
- The consistent SelectContent/SelectItem styling
- Keyboard navigation patterns

### `RaidEventRow` Component (Lines 79-113)

Custom row component with:
- `div.flex.items-center.justify-between.rounded-md.border.border-border.bg-surface-high/30.px-4.py-3`
- Left side: `Badge` + details (reason, action, userIds count, account age)
- Right side: timestamp

### Conditional Rendering

- **Loading state**: Full early return with PageHeader + loading text (lines 183-193)
- **Events list vs empty**: Based on `eventsData.events.length > 0`
- **Events pagination**: Only when `eventsData.total > 20`
- **Event detail spans**: Conditional based on `event.details.reason`, `.action`, `.userIds`, `.ageDays`

---

## Interaction Behavior

### Hover/Focus/Active/Disabled States

- **Save button**: `disabled={updateConfig.isPending}`; label changes to "Saving..." when pending
- **Pagination buttons**: disabled at boundaries
- **Switch components**: standard shadcn toggle
- **Native `<select>`**: browser-default focus behavior + `focus-visible:ring-1 focus-visible:ring-accent`
- **Inputs**: standard shadcn `focus-visible:ring`

### Click Handlers

| Element | Handler | Side Effect |
|---------|---------|-------------|
| Save button | `handleSave()` | Collects all form state, mutation + toast |
| Pagination prev | `setEventsPage(p => Math.max(1, p - 1))` | Page change |
| Pagination next | `setEventsPage(p => p + 1)` | Page change |
| Switch (enabled) | `setEnabled(...)` | Local state only (saved on Save click) |
| Switch (antiNuke) | `setAntiNukeEnabled(...)` | Local state only |
| Switch (lockdown) | `setLockdownOnRaid(...)` | Local state only |

### Form Validation

- **No client-side validation** -- all inputs pass through `parseInt(..., 10) || defaultValue` on save
- Thresholds default to hardcoded fallbacks: joinThreshold=10, joinWindow=10, accountAgeMinDays=0, antiNukeThreshold=3
- No min/max validation on save (HTML `min`/`max` attributes exist on inputs but not enforced in handler)

### Form State Pattern

**This page uses a different pattern than others**: It maintains local form state synced from server via `useEffect` (lines 137-151), then submits all changes at once via a Save button. This is a "form submit" pattern vs the "auto-save on change" pattern used in leveling.

The `useEffect` dependency array is `[config]` only -- no cleanup or comparison, so it re-syncs on every config refetch.

---

## Dynamic States

### Loading States

- **Full-page early return** (lines 183-193): Shows `PageHeader` + `<p className="text-text-muted">{t("common:actions.loading")}</p>`
- **No skeleton components**
- **No loading state for events tab** -- events load in background

### Empty States

- **Events tab**: `<p className="text-sm text-text-muted">{t("events.empty")}</p>` -- plain text only

### Error States

- `toast.error()` on save failure
- `ApiError` message extraction pattern

### Success States

- `toast.success(t("toast.saved"))` on save

---

## RTL Analysis

### Hardcoded LTR Styles

| Location | Class/Style | Issue |
|----------|------------|-------|
| Line 82 | `px-4 py-3` | OK -- logical padding not needed for horizontal symmetry |
| Line 92 | `ms-2` | **Correct** -- logical margin-inline-start |
| Line 97 | `ms-2` | **Correct** |
| Line 103 | `ms-2` | **Correct** |
| Line 394 | `w-64` on logChannel input | OK -- width constraint |

### Missing Logical Properties

- No `ml-*`/`mr-*` used -- all margins use `ms-*` or gap utilities
- No `text-left`/`text-right` used
- No `pl-*`/`pr-*` used

### Overall RTL Assessment

**Good.** Uses `ms-2` for inline spacing in RaidEventRow. No hardcoded LTR directional properties.

---

## Responsive Analysis

### Breakpoint Usage

| Breakpoint | Usage | Lines |
|-----------|-------|-------|
| `sm:grid-cols-2` | Join rate settings grid | 234 |
| `sm:grid-cols-2` | Account age settings grid | 290 |
| `sm:grid-cols-2` | Anti-nuke settings grid | 337 |

### Mobile Behavior

- All setting grids stack to 1 column on mobile
- Master toggle card: `flex items-center justify-between` -- works on all sizes
- Anti-nuke and lockdown cards: header with Switch -- `flex items-center justify-between`, works on all sizes
- Events list: `flex items-center justify-between` on each row -- may wrap on very narrow screens
- **No stats row** -- this page does not have StatsCard components

### Potential Issues

1. **RaidEventRow layout** -- `flex items-center justify-between` with variable-length content may cause overlap on narrow mobile screens
2. **No `md:` or `lg:` breakpoints** -- only `sm:` used

---

## Modals/Overlays

**None.** This page uses no Dialog, Popover, or other overlay components. All configuration is inline in tab panels with a global Save button.

---

## Design System Compliance

### Color Tokens

| Usage | Value | Compliant? |
|-------|-------|-----------|
| `bg-surface` | Card backgrounds | Yes |
| `bg-surface-high/30` | Event row background | Yes -- uses opacity modifier |
| `text-text-muted` | Secondary text, timestamps, descriptions | Yes |
| `border-border` | Event row borders, ActionSelect borders | Yes |
| `focus-visible:ring-accent` | ActionSelect focus ring | Yes -- matches accent token |
| `text-danger` | Not used in this page | -- |

### Typography

| Usage | Classes | Compliant? |
|-------|---------|-----------|
| Section titles | `text-lg font-semibold` | Yes |
| Descriptions | `text-sm text-text-muted` | Yes |
| Input hints | `text-xs text-text-muted` | Yes |
| Event details | `text-sm`, `text-xs text-text-muted` | Yes |
| Timestamp | `text-xs text-text-muted` | Yes |

### Spacing

| Pattern | Classes | Notes |
|---------|---------|-------|
| Page rhythm | `space-y-8` | Consistent |
| Card padding | `p-6` | Standard |
| Section separator | `Separator className="mb-6"` | Consistent |
| Setting grids | `gap-6` | Slightly larger than other pages' `gap-4` |
| Input spacing | `className="mt-1"` | Consistent within this page |

### Hardcoded Values

| Location | Value | Concern |
|----------|-------|---------|
| `w-64` | Log channel input width | Acceptable |
| `bg-surface-high/30` | Event row opacity | Uses Tailwind opacity modifier -- acceptable |
| `h-9` in ActionSelect | Height matching shadcn | Manual replication -- fragile |

### Missing Design System Usage

1. **Native `<select>` in `ActionSelect`** (lines 40-52) -- violates shadcn/ui rule. Hand-replicates styling with raw CSS classes instead of using `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`
2. **No StatsCard row** -- unlike other pages, this page has no stats overview
3. **No loading skeleton** -- uses early return with plain text
4. **`glass-edge` class** not used on any Card
5. **Event row** is a custom component that could benefit from being a reusable pattern

---

## Findings Summary

### Critical Issues

1. **Native `<select>` element in `ActionSelect`** (lines 28-53) -- directly violates CLAUDE.md rule: "ALWAYS use shadcn/ui components... Never reimplement or use raw HTML/Radix directly when a shadcn wrapper is available." Must be replaced with `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`.

### Other Issues

2. **No client-side validation** beyond HTML attributes -- parseInt fallbacks silently accept invalid values
3. **`useEffect` sync** with `[config]` dependency may cause input flicker -- user's unsaved changes reset when config refetches (e.g., after React Query background refetch)
4. **No stats overview** -- unlike other pages, missing the StatsCard row for consistency
5. **No skeleton loading** -- full early return shows minimal loading indicator
6. **Events empty state** is plain text -- no icon or CTA
7. **Events pagination** only shown when `total > 20` -- hardcoded page size not configurable
8. **Save button at bottom** can be below the fold; no floating/sticky save bar
9. **No unsaved changes indicator** -- users cannot tell if they have pending changes

### Strengths

1. **Form submit pattern** is appropriate for this configuration page -- collect all changes, save at once
2. **Good RTL compliance** using `ms-2` logical margins
3. **Badge variants** for event types are semantically meaningful (destructive for critical events)
4. **Event detail rendering** is thorough with conditional spans for various detail types
