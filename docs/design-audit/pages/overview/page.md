# Overview Page - UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/overview.tsx`  
**Component:** `OverviewPage`  
**i18n namespace:** `overview`

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle)
  div.grid.grid-cols-2.lg:grid-cols-4.gap-4          (Stats row)
    StatsCard x4 (actionRules, activeNow, executions, successRate)
  div.flex.gap-1                                       (Day selector + error badge)
    Button x2 (7d, 30d)
    span (conditional error badge)
  div.grid.lg:grid-cols-3.gap-4                        (Charts row)
    div.lg:col-span-2
      ExecutionChart
    div
      EventDistributionChart
  RecentActivityFeed
```

### Component Tree

```
OverviewPage
  PageHeader
  StatsCard (x4)
  Button (x2 - day selectors)
  ExecutionChart
    recharts AreaChart
      CustomTooltip
  EventDistributionChart
    recharts BarChart
      CustomTooltip
  RecentActivityFeed
    Icon (per item)
    Link (to logs page)
```

---

## Components Inventory

### PageHeader
- **Source:** `components/PageHeader.tsx` (lines 10-25)
- **Props passed:** `title={t("title")}`, `subtitle={t("subtitle")}`
- **No label or actions** passed on this page.
- **Layout:** Flex column on mobile, flex row on `sm:` with `items-end justify-between`.

### StatsCard (x4)
- **Source:** `components/StatsCard.tsx` (lines 12-28)
- **Props:**
  1. `label=t("stats.actionRules")`, `value=summary.totalRules`, `accentColor="border-accent"`
  2. `label=t("stats.activeNow")`, `value=summary.activeRules`, `accentColor="border-success"`, `valueClassName="text-success"`
  3. `label=t("stats.executions")`, `value=summary.totalExecutions.toLocaleString()`, `accentColor="border-secondary"`
  4. `label=t("stats.successRate")`, `value={summary.successRate}%`, `accentColor` conditionally `"border-success"` or `"border-danger"` at 90% threshold, `valueClassName` conditionally `"text-success"` or `"text-danger"`
- **Styling:** `border-s-2 ${accentColor} bg-surface-low px-3 py-3 rounded-lg min-h-18 sm:px-5 sm:py-4 sm:min-h-22 glass-edge`
- **Tooltip:** Not used on this page (no `tooltip` prop passed).
- **States:** No loading/error/disabled state -- relies on parent `isLoading` guard.

### Button (Day Selectors)
- **Source:** `components/ui/button` (shadcn)
- **Variants:** `variant={days === d ? "default" : "ghost"}`, `size="sm"`
- **Values iterated:** `[7, 30]` -- renders `7d` and `30d` labels.
- **Behavior:** `onClick={() => setDays(d)}` updates the `days` state.

### Error Badge (Conditional)
- **Rendered when:** `summary.recentErrors > 0` (line 68)
- **HTML:** `<span>` with classes `ms-auto flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1 text-xs font-medium text-danger`
- **Text:** `t("errorsInLast24h", { count: summary.recentErrors })`
- **RTL note:** Uses `ms-auto` (logical property -- correct).

### ExecutionChart
- **Source:** `components/overview/ExecutionChart.tsx` (lines 33-89)
- **Props:** `data={analytics.executionTrend}` -- array of `{ date, total, success, error }`
- **Library:** recharts `AreaChart` inside `ResponsiveContainer`
- **Chart details:**
  - Two areas: `success` (stroke `#57f287`) and `error` (stroke `#ff6e84`)
  - Linear gradients for fill: `successGradient` and `errorGradient` with 20% to 0% opacity
  - CartesianGrid: `strokeDasharray="3 3"`, stroke `rgba(255,255,255,0.05)`
  - XAxis: tick fill `rgba(249,245,248,0.4)`, fontSize 11, formats dates as `M/D`
  - YAxis: same tick styling, left margin offset `-20`
  - Custom tooltip with `bg-surface-high p-3 text-xs shadow-lg glass-edge`
- **Wrapper:** `rounded-lg bg-surface-low p-6 glass-edge` with heading "Execution Trend" using `section-label text-text-muted`
- **Fixed height:** `h-64` (256px)

### EventDistributionChart
- **Source:** `components/overview/EventDistributionChart.tsx` (lines 39-89)
- **Props:** `data={analytics.eventDistribution}`, `constants={constants}`
- **Library:** recharts `BarChart` (vertical layout)
- **Chart details:**
  - Slices data to max 8 items
  - `BAR_COLORS` array: 8 hardcoded hex colors (`#a3a6ff`, `#ac8aff`, `#57f287`, `#ff6e84`, `#ffa657`, `#79e8c8`, `#7dc4e4`, `#f5a97f`)
  - Bar radius `[0, 4, 4, 0]`, maxBarSize 24
  - Y-axis width 100, labels truncated at 12 chars
  - Custom tooltip: same surface-high styling as ExecutionChart
- **Empty state:** Centered `text-sm text-text-muted` "No event data yet"
- **Wrapper:** Same as ExecutionChart -- `rounded-lg bg-surface-low p-6 glass-edge`

### RecentActivityFeed
- **Source:** `components/overview/RecentActivityFeed.tsx` (lines 32-85)
- **Props:** `data={analytics.recentActivity}`, `guildId`, `constants`
- **Header:** Flex with "Recent Activity" heading and "View all logs" link (`text-xs text-accent hover:underline`)
- **Link:** `<Link to="/guild/$guildId/logs">` -- navigates to logs page
- **Item layout:** Each item has:
  - Status icon in a circle (`h-7 w-7 rounded-full`) with success/danger coloring
  - Rule name (truncated, `text-sm font-medium`)
  - Event type arrow action type (truncated, `text-xs text-text-muted`)
  - Time ago label (font-mono, `text-[11px] text-text-tertiary`)
- **Empty state:** `py-8 text-center text-sm text-text-muted` "No activity recorded yet"
- **Hover:** `hover:bg-surface-high/50` on each item row

### PageSkeleton (Loading State)
- **Source:** `components/PageSkeleton.tsx` (lines 3-16)
- **Layout:** `space-y-8` with Skeleton placeholders (`h-9 w-64`, `h-4 w-96`, `h-48 w-full`, `h-32 w-full`)

---

## Interaction Behavior

### Day Selector Buttons
- **Click:** Sets `days` state to 7 or 30, which triggers `useAnalytics(guildId, days)` refetch.
- **Active state:** `variant="default"` (filled button)
- **Inactive state:** `variant="ghost"` (transparent)
- **No disabled state** -- both are always clickable.

### "View all logs" Link
- **Click:** Client-side navigation to `/guild/$guildId/logs`
- **Hover:** `hover:underline`
- **No focus ring** visible in the classes.

### Activity Feed Items
- **Hover:** `hover:bg-surface-high/50` background transition
- **No click handler** -- items are display-only (not clickable).

---

## Dynamic States

### Loading State
- **Condition:** `isLoading || !analytics` (line 21)
- **Renders:** `<PageSkeleton />` -- generic skeleton with two rectangle blocks
- **No per-section loading** -- entire page is skeleton or fully loaded.

### Empty State
- **ExecutionChart:** No explicit empty state -- renders an empty chart.
- **EventDistributionChart:** Shows "No event data yet" centered text when `chartData.length === 0`.
- **RecentActivityFeed:** Shows "No activity recorded yet" centered text when `data.length === 0`.

### Error State
- **No explicit error handling** at the page level. The `useAnalytics` hook error is not caught or displayed.
- **Error badge:** Shows conditional `recentErrors` count badge, but this is data-driven, not an error state.

### Success State
- **No toast or success indicators** on this page -- it is read-only.

---

## RTL Analysis

### Correct RTL Patterns
- **Error badge:** Uses `ms-auto` (line 69) -- logical property, correct.
- **Tooltip entry dot:** Uses `me-1.5` (line 24 of ExecutionChart) -- logical property, correct.

### Potential RTL Issues

1. **ExecutionChart XAxis date format (line 58-60):** Uses `M/D` format via JavaScript date formatting. This is locale-agnostic but not internationally formatted -- consider `Intl.DateTimeFormat` for RTL locales.

2. **ExecutionChart YAxis left margin (line 41):** `margin={{ top: 4, right: 4, bottom: 0, left: -20 }}` -- uses physical `left`/`right` in the recharts margin object. Recharts does not support logical properties, so in RTL the negative margin will still be on the physical left side. **Issue: chart may have wrong spacing in RTL.**

3. **EventDistributionChart bar radius (line 78):** `radius={[0, 4, 4, 0]}` -- this means top-left=0, top-right=4, bottom-right=4, bottom-left=0. In a horizontal bar chart with RTL, the bars grow from right-to-left, so the rounded corners would appear on the wrong end. **Issue: bar radius direction not mirrored for RTL.**

4. **RecentActivityFeed arrow text (line 73):** `{" -> "}` -- this Unicode arrow is directional. In RTL it should ideally be `{" <- "}` or use a mirrored icon. **Minor issue.**

5. **`timeAgo` function (lines 22-29):** Hardcoded English suffixes (`"just now"`, `"m ago"`, `"h ago"`, `"d ago"`). **Not i18n-translated.**

6. **ExecutionChart hardcoded strings:**
   - Line 36: `"Execution Trend"` -- not translated.
   - Line 25 of CustomTooltip: `"Success"` and `"Errors"` -- not translated.

7. **EventDistributionChart hardcoded strings:**
   - Line 52: `"Top Events"` -- not translated.
   - Line 34 of CustomTooltip: `"executions"` -- not translated.
   - Line 57: `"No event data yet"` -- not translated.

8. **RecentActivityFeed hardcoded strings:**
   - Line 37: `"Recent Activity"` -- not translated.
   - Line 44: `"View all logs"` -- not translated.
   - Line 49: `"No activity recorded yet"` -- not translated.

---

## Responsive Analysis

### Mobile (< 640px)
- **Stats grid:** `grid-cols-2` -- 2 columns on mobile (good).
- **StatsCard:** `px-3 py-3 min-h-18` -- compact padding.
- **Charts grid:** Single column (no `lg:` breakpoint active), stacked vertically.
- **Day selector:** Flex row, wraps naturally.
- **PageHeader:** Column layout (`flex-col`), title stacks above subtitle.

### Tablet (640px - 1024px)
- **Stats grid:** Still `grid-cols-2` until `lg:`.
- **StatsCard:** `sm:px-5 sm:py-4 sm:min-h-22` -- slightly larger.
- **Charts:** Still single column until `lg:`.
- **PageHeader:** `sm:flex-row sm:items-end sm:justify-between` -- side-by-side.

### Desktop (>= 1024px)
- **Stats grid:** `lg:grid-cols-4` -- 4 columns.
- **Charts grid:** `lg:grid-cols-3` with ExecutionChart spanning `lg:col-span-2` (2/3) and EventDistribution taking 1/3.

### Missing Breakpoints
- No `xl:` or `2xl:` breakpoints -- layout is the same from 1024px+.
- **Charts have fixed height `h-64`** (256px) at all breakpoints -- may feel cramped on large screens.

---

## Modals/Overlays

### Tooltips
- **StatsCard** supports tooltip prop but it is not used on this page.
- **ExecutionChart** has a recharts `<Tooltip>` (custom rendered).
- **EventDistributionChart** has a recharts `<Tooltip>` (custom rendered).
- **Positioning:** recharts handles tooltip positioning internally (follows cursor).
- **Close behavior:** Disappears when cursor leaves data point.

### No Dialogs/Dropdowns
- This page has no modals, dialogs, dropdown menus, or other overlays.

---

## Design System Compliance

### Color Tokens

| Usage | Value Used | Expected Token | Status |
|-------|-----------|---------------|--------|
| Stats card borders | `border-accent`, `border-success`, `border-secondary`, `border-danger` | Design system tokens | Compliant |
| Stats card values | `text-success`, `text-danger` | Design system tokens | Compliant |
| Error badge bg | `bg-danger/10` | Design system token with opacity | Compliant |
| Error badge text | `text-danger` | Design system token | Compliant |
| Chart success color | `#57f287` | Should use `var(--color-success)` | **Hardcoded** |
| Chart error color | `#ff6e84` | Should use `var(--color-danger)` | **Hardcoded** |
| Chart grid stroke | `rgba(255,255,255,0.05)` | Should use token-based | **Hardcoded** |
| Chart tick fill | `rgba(249,245,248,0.4)` | Should use `text-text-muted` or token | **Hardcoded** |
| Bar chart colors | 8 hardcoded hex values | Should derive from design tokens | **Hardcoded** |
| Surface backgrounds | `bg-surface-low`, `bg-surface-high` | Design system tokens | Compliant |
| Activity status icons | `bg-success/10 text-success`, `bg-danger/10 text-danger` | Design system tokens | Compliant |
| Time ago text | `text-text-tertiary` | Design system token | Compliant |

### Typography

| Usage | Classes | Expected | Status |
|-------|---------|----------|--------|
| Stats label | `section-label text-text-muted` | Design system utility | Compliant |
| Stats value | `font-mono text-xl font-bold sm:text-2xl` | Mono for numbers | Compliant |
| Chart heading | `section-label text-text-muted` | Design system utility | Compliant |
| Tooltip title | `font-label font-semibold text-text` | `font-label` = Space Grotesk | Compliant |
| Tooltip body | `text-text-muted` | Design system token | Compliant |
| Feed rule name | `text-sm font-medium text-text` | Standard body | Compliant |
| Feed time | `font-mono text-[11px] text-text-tertiary` | Mono for timestamps | Compliant |

### Spacing
- Outer: `space-y-8` (32px vertical gap)
- Stats grid: `gap-4` (16px)
- Charts grid: `gap-4` (16px)
- Day selector: `gap-1` (4px) -- tight, appropriate for button group
- Chart internal padding: `p-6` (24px)

### Border/Radius
- StatsCard: `rounded-lg` + `border-s-2` accent border
- Chart wrappers: `rounded-lg`
- Error badge: `rounded-full`
- Activity status icon: `rounded-full`
- Activity item: `rounded-md`
- All use `glass-edge` custom class for surface panels

### Hardcoded Values Summary
- **6 chart colors** are hardcoded hex values instead of CSS custom properties
- **3 rgba() values** in chart configuration instead of token references
- **8 English strings** not run through i18n in sub-components (ExecutionChart, EventDistributionChart, RecentActivityFeed)
