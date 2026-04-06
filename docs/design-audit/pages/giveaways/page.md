# Giveaways Page UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/giveaways.tsx`
**Component:** `GiveawaysPage`
**Lines:** 460

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle)
  div.grid.grid-cols-1.gap-4.sm:grid-cols-3       [Stats row]
    StatsCard (activeGiveaways)
    StatsCard (pastGiveaways)
    StatsCard (totalEntries)
  Tabs (defaultValue="active")
    TabsList
      TabsTrigger "active"
      TabsTrigger "past"
      TabsTrigger "create"
    TabsContent "active"
      Card.bg-surface.p-6
        [Loading | Table + Pagination | Empty]
    TabsContent "past"
      Card.bg-surface.p-6
        [Loading | Table + Pagination | Empty]
    TabsContent "create"
      Card.bg-surface.p-6
        h3 + p + Form (prize, channel, duration+unit, winners, requiredRole) + Separator + Button
```

### Component Tree

- `PageHeader` -- title, subtitle only
- `StatsCard` x3 -- activeGiveaways, pastGiveaways, totalEntries
- `Tabs` > `TabsList` > `TabsTrigger` x3
- `TabsContent` x3 each containing `Card`
- `Table` x2 -- active giveaways (6 cols), past giveaways (6 cols)
- `Badge` -- time remaining in active, no badge used in past
- `Button` variant="destructive" -- end giveaway per active row
- `Button` variant="outline" -- reroll per past row
- `Button` -- create giveaway
- `Button` variant="outline" size="sm" -- pagination (x2 per table)
- `Input` x4 -- prize, channel, duration value, winners count, required role
- `Select` -- duration unit (m/h/d/w)
- `Label` -- all form inputs
- `Separator` -- before submit button in create form

---

## Components Inventory

| Component | Variant/Props | Count | Notes |
|-----------|--------------|-------|-------|
| `PageHeader` | title, subtitle | 1 | No actions |
| `StatsCard` | label, value | 3 | No accentColor, no valueClassName, no tooltip |
| `Tabs` | defaultValue="active" | 1 | Uncontrolled |
| `TabsTrigger` | value | 3 | active, past, create |
| `Card` | className="bg-surface p-6" | 3 | One per tab |
| `Table` | -- | 2 | Active (6 cols), past (6 cols) |
| `Badge` | variant="outline" | per active row | Time remaining display |
| `Button` | variant="destructive" size="sm" | per active row | End giveaway |
| `Button` | variant="outline" size="sm" | per past row + 4 pagination | Reroll + pagination |
| `Button` | default | 1 | Create giveaway |
| `Input` | type="text" | 3 | Prize, channel, required role |
| `Input` | type="number" | 2 | Duration value (w-24), winners count (w-24) |
| `Select` | -- | 1 | Duration unit |
| `Label` | htmlFor | 5 | Form inputs |
| `Separator` | -- | 1 | Before create button |

### Conditional Rendering

- **Active table vs empty**: based on `activeData.giveaways.length > 0`
- **Past table vs empty**: based on `pastData.giveaways.length > 0`
- **Active pagination**: only when `activeTotalPages > 1`
- **Past pagination**: only when `pastTotalPages > 1`
- **Past winners display**: conditional -- shows truncated IDs if winners exist, else `t("common:labels.none")`

---

## Interaction Behavior

### Hover/Focus/Active/Disabled States

- **End giveaway button**: `disabled={endGiveaway.isPending}` -- `variant="destructive"` provides red styling
- **Reroll button**: `disabled={rerollGiveaway.isPending}`
- **Create button**: `disabled={createGiveaway.isPending}`
- **Pagination buttons**: disabled at boundaries
- All shadcn components have built-in focus ring states

### Click Handlers

| Element | Handler | Side Effect |
|---------|---------|-------------|
| End giveaway | `handleEnd(g.id)` | Mutation + toast |
| Reroll giveaway | `handleReroll(g.id)` | Mutation + toast |
| Create button | `handleCreate()` | Validation + mutation + toast + form reset |
| Pagination (active) | `setActivePage(...)` | Page state change |
| Pagination (past) | `setPastPage(...)` | Page state change |

### Form Validation

- **Prize**: must be non-empty after trim; error via generic `toast.error(t("toast.createFailed"))`
- **Channel**: must be non-empty after trim; same generic error
- **Duration value**: `parseFloat`, must be finite and >0; same generic error
- **Winners count**: `parseInt`, must be finite, 1-20; same generic error
- **Required role**: optional, split by comma if provided
- **All validation failures** use the same generic error message `t("toast.createFailed")` -- no specific error messages

### `formatTimeRemaining` Helper (Lines 37-53)

Standalone function formatting remaining time:
- Returns `"Ended"` if diff <= 0 -- **hardcoded English string**
- Returns `"Xd Yh"`, `"Xh Ym"`, `"Xm"`, `"Xs"` -- **all hardcoded English abbreviations**

---

## Dynamic States

### Loading States

- **Active tab**: `<p className="text-text-muted">{t("loading")}</p>` -- plain text
- **Past tab**: `<p className="text-text-muted">{t("loading")}</p>` -- plain text
- **Stats cards**: show "..." while loading

### Empty States

- **Active giveaways**: `<p className="text-text-muted">{t("empty")}</p>` -- plain text, no icon or CTA
- **Past giveaways**: `<p className="text-text-muted">{t("empty")}</p>` -- same key, plain text
- Both empty states share the same `t("empty")` key -- no differentiation between "no active" and "no past"

### Error States

- All via `toast.error()` -- no inline errors
- Generic error messages for all validation failures

### Success States

- `toast.success()` for create/end/reroll + form reset on create

---

## RTL Analysis

### Hardcoded LTR Styles

| Location | Class/Style | Issue |
|----------|------------|-------|
| None found | -- | No `ml-*`/`mr-*`, `pl-*`/`pr-*`, `text-left`/`text-right` used |

### Missing Logical Properties

- No margin/padding direction issues
- All spacing uses `gap-*` or symmetric padding

### Icon Direction

- No `Icon` components used in this page (unlike other pages)

### Overall RTL Assessment

**Acceptable.** No directional issues. However, the page also does not use `ms-*`/`me-*` because it does not need them. The `formatTimeRemaining` function returns English-only strings which are a separate i18n concern.

---

## Responsive Analysis

### Breakpoint Usage

| Breakpoint | Usage | Lines |
|-----------|-------|-------|
| `sm:grid-cols-3` | Stats row | 177 |
| `sm:flex-row sm:items-end` | Duration + unit form fields | 393 |

### Mobile Behavior

- Stats: 1 col mobile -> 3 cols sm+
- **Active giveaways table**: 6 columns (#, prize, winners, entries, endsIn, action) -- no horizontal scroll wrapper
- **Past giveaways table**: 6 columns (#, prize, winners, entries, ended, action) -- no scroll wrapper
- Create form: fields stack vertically; duration/unit row stacks on mobile via `flex-col`/`sm:flex-row`

### Potential Issues

1. **Both tables have 6 columns** with no horizontal scroll wrapper -- will overflow on mobile
2. **Winner IDs in past table** use `g.winnerIds.map((id) => id.slice(0, 8)).join(", ")` -- truncated but may still be wide with many winners
3. **No `md:` or `lg:` breakpoints**

---

## Modals/Overlays

**None.** No Dialog or overlay components used. The create form is a tab panel, not a modal.

---

## Design System Compliance

### Color Tokens

| Usage | Value | Compliant? |
|-------|-------|-----------|
| `bg-surface` | Card backgrounds | Yes |
| `text-text-muted` | Secondary text, loading, empty states | Yes |

### Typography

| Usage | Classes | Compliant? |
|-------|---------|-----------|
| Section title | `text-lg font-semibold` | Yes |
| Description | `text-sm text-text-muted` | Yes |
| Table ID | `font-mono text-xs font-bold` | Yes |
| Table prize | `font-medium` | Yes |

### Spacing

| Pattern | Classes | Notes |
|---------|---------|-------|
| Page rhythm | `space-y-8` | Consistent |
| Card padding | `p-6` | Standard |
| Stats gap | `gap-4` | Standard |
| Form sections | `space-y-4` | Slightly tighter than other pages' `space-y-6` |
| Form field gap | `gap-3` | Consistent |

### Hardcoded Values

| Location | Value | Concern |
|----------|-------|---------|
| `className="w-24"` | Duration and winners inputs | Acceptable |
| `className="w-32"` | Duration unit select | Acceptable |
| `className="w-16"` | Table ID column | Acceptable |
| `className="w-24"` | Table action column | Acceptable |
| `maxLength={256}` | Prize input | Acceptable |

### Hardcoded Strings (i18n Violations)

| Location | String | Should Be |
|----------|--------|-----------|
| Line 49 | `"Ended"` | Should use `t("statuses.ended")` or `t("timeRemaining.ended")` |
| Line 49 | `` `${days}d ${hours % 24}h` `` | **Hardcoded English time format** -- should use i18n formatter |
| Line 50 | `` `${hours}h ${minutes % 60}m` `` | Same |
| Line 51 | `` `${minutes}m` `` | Same |
| Line 52 | `` `${seconds}s` `` | Same |
| Line 249 | `` Page ${activePage} of ${activeTotalPages} (${activeData.total} total) `` | **Hardcoded English** -- should use `t("pagination.pageInfo", {...})` |
| Line 334 | `` Page ${pastPage} of ${pastTotalPages} (${pastData.total} total) `` | Same |
| Line 388 | `"e.g. 123456789012345678"` | Placeholder -- borderline |
| Line 416 | `SelectItem value="w"` uses `t("common:time.days")` | **Bug** -- weeks unit `"w"` labeled as "days" instead of "weeks" |

### Missing Design System Usage

- **No `glass-edge` class** on Cards
- **No skeleton loading** -- plain text loading states
- **Empty states** are identical plain text for both tabs -- no visual treatment
- **No Icon component** used anywhere on this page (unlike all other audited pages)
- **Destructive button** for ending giveaways is appropriate but no confirmation dialog
- **Stats `totalEntries` value** computed inline with `.reduce()` -- may show incorrect value if not all giveaways loaded (only first page)

---

## Findings Summary

### Critical Issues

1. **`formatTimeRemaining` returns hardcoded English strings** -- `"Ended"`, `"3d 12h"`, `"2h 30m"`, etc. These are not i18n-compatible and will show English in all locales
2. **Pagination text is hardcoded English** (lines 249, 334) -- `` Page ${activePage} of ${activeTotalPages} `` bypasses i18n
3. **Duration unit bug** -- `SelectItem value="w"` (weeks) uses `t("common:time.days")` label instead of a weeks translation key (line 416)

### Other Issues

4. **Both tables lack horizontal scroll** wrappers for mobile
5. **No confirmation before ending a giveaway** -- destructive action with no undo
6. **All validation failures use the same generic error** `t("toast.createFailed")` -- no field-specific messages
7. **`totalEntries` stat is inaccurate** -- only counts entries from the first page of active giveaways, not all
8. **Empty states** share the same i18n key and have no visual treatment
9. **No skeleton loading** states
10. **No Icon component** used -- page feels less visually consistent with other dashboard pages
11. **Winner IDs** shown truncated to 8 chars with no tooltip or expand -- provides incomplete information
12. **`maxLength={256}`** on prize but no character counter (unlike scheduled messages page)

### Strengths

1. **Separate pagination** for active and past tabs -- good UX
2. **Duration input** with unit selector -- intuitive time input
3. **Reroll functionality** for ended giveaways -- complete lifecycle
4. **Required role** as optional comma-separated input -- flexible
