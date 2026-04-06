# Logs Page - UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/logs.tsx`  
**Component:** `LogsPage`  
**i18n namespace:** `logs`

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle)
  Tabs (value=activeTab, "activity" | "events")
    TabsList
      TabsTrigger "activity" (Activity tab)
      TabsTrigger "events" (Events tab)
    TabsContent "activity"
      LogsTable
    TabsContent "events"
      div.space-y-8
        EventLogConfig
        EventLogBrowser
```

### Component Tree

```
LogsPage
  PageHeader (title, subtitle)
  Tabs (shadcn)
    TabsList
      TabsTrigger (x2)
    TabsContent "activity"
      LogsTable
        StatsCard (x3)
        Icon (search)
        Input (search)
        Select (date range)
        EmptyState (conditional)
        Table (shadcn)
          TableHeader, TableBody, TableRow, TableHead, TableCell
          Badge (status per row)
        Button (x2: previous, next -- pagination)
        TableSkeleton (loading)
    TabsContent "events"
      EventLogConfig
        Icon (settings)
        CategoryCard (x N categories)
          Icon (category icon)
          Switch (enable/disable)
          Select (channel)
          Badge (x events preview)
        TableSkeleton (loading)
      EventLogBrowser
        Icon (list)
        Badge (entry count)
        Select (category filter)
        Icon (search)
        Input (target ID search)
        EmptyState (conditional)
        Table (shadcn)
          Badge (category per row)
        Button (x2: previous, next -- pagination)
        TableSkeleton (loading)
```

---

## Components Inventory

### PageHeader
- **Props:** `title={t("title")}`, `subtitle={t("subtitle")}`
- **No label or actions.**

### Tabs (shadcn)
- **Controlled state:** `activeTab` via `useState("activity")`
- **Two tabs:** `"activity"` and `"events"`
- **Labels:** `t("tabs.activity")` and `t("tabs.events")`

---

### LogsTable Component

**Source:** `components/LogsTable.tsx` (lines 24-182)

#### Stats Row
- **Grid:** `grid-cols-1 sm:grid-cols-3 gap-4`
- **StatsCard x3:**
  1. Execution Rate: `value="${successRate}%"`, `border-success`, `text-success`
  2. Total Failures: `value={failureCount}`, `border-danger`, `text-danger`
  3. Total Entries: `value={totalLogs.toLocaleString()}`, `border-accent`

#### Filter Row
- **Layout:** `flex flex-wrap items-center gap-3`
- **Search input:**
  - Wrapper: `relative w-full sm:w-64`
  - Icon: `absolute inset-s-3 top-1/2 -translate-y-1/2 text-text-muted` -- uses logical `inset-s-3`
  - Input: `ps-10 font-mono` -- monospace for rule name search
  - Resets page to 1 on change
- **Date range select:**
  - Width: `w-32`
  - Options: `1h`, `24h`, `7d`
  - Default: `7d`
  - Resets page to 1 on change
- **Client-side filtering:** `filteredLogs` computed with `useMemo` based on date range cutoff

#### Data Table
- **Container:** `overflow-x-auto rounded-lg bg-surface-low shadow-2xl glass-edge`
- **Table min-width:** `min-w-160` (640px)
- **Columns:** Timestamp, Rule Name, Event Type, Action, Status, Details
- **Column styling:**
  - Timestamp: `text-xs font-mono text-text-muted whitespace-nowrap`
  - Rule Name: `text-sm font-semibold`
  - Event Type: `text-sm text-text-muted`, uses constants label lookup
  - Action: `text-sm text-text-muted`, uses constants label lookup
  - Status: `text-center` with `<Badge variant={success ? "success" : "destructive"}>`
  - Details: `text-xs text-danger max-w-48 truncate` (shows error text or em-dash)
- **Header row:** `hover:bg-transparent` to prevent hover highlight

#### Pagination
- **Layout:** `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`
- **Info text:** `text-xs sm:text-sm` showing "from - to of total"
- **Buttons:** `variant="ghost" size="sm"` for previous/next
- **Disabled when:** First/last page
- **Page size:** 10

#### Loading State
- `<TableSkeleton rows={8} />`

#### Empty State
- `<EmptyState icon="description" title=... description=... />`

---

### EventLogConfig Component

**Source:** `components/EventLogConfig.tsx` (lines 29-170)

#### Header
- **Layout:** `flex items-center gap-2`
- **Icon:** settings, size 20, `text-accent`
- **Heading:** `text-lg font-semibold font-display` -- uses `font-display` (Space Grotesk)

#### Category Grid
- **Grid:** `gap-4 sm:grid-cols-2 lg:grid-cols-3`
- **One `CategoryCard` per category** from server data

#### CategoryCard
- **Container:** `rounded-lg bg-surface-low p-4 glass-edge space-y-3`
- **Header row:** `flex items-center justify-between`
  - Category icon + name (left): `Icon` + `text-sm font-semibold font-display`
  - Enable switch (right): `<Switch>`
- **Channel select:** Full-width `<Select>` for log channel assignment
- **Event badges:** First 4 events as `<Badge variant="secondary">`, then `+N more` as `<Badge variant="outline">`
- **Status line:** `text-xs text-text-muted` showing enabled/disabled + ignored channel count

#### Category Icon Mapping
```
message    -> "message-circle"
member     -> "users"
voice      -> "mic"
channel    -> "hash"
role       -> "shield"
server     -> "settings"
moderation -> "gavel"
```
**Note:** These icon names (`message-circle`, `users`, `mic`, `hash`, `shield`) appear to be Lucide icon names, but the `Icon` component uses Material Symbols. These may not render correctly if the Material Symbols font does not include these names. **Potential rendering issue.**

#### Interaction
- **Toggle switch:** `handleToggle` calls `onUpdate({ channelId, enabled: checked })` immediately.
- **Channel change:** `handleChannelChange` calls `onUpdate({ channelId, enabled })` immediately.
- **No save button** -- changes are auto-saved on interaction.
- **No debounce** -- every switch toggle and channel change triggers an API call.

#### Loading State
- `<TableSkeleton rows={4} />`

---

### EventLogBrowser Component

**Source:** `components/EventLogBrowser.tsx` (lines 34-182)

#### Header
- **Layout:** `flex items-center gap-2`
- **Icon:** list, size 20, `text-accent`
- **Heading:** `text-lg font-semibold font-display`
- **Entry count badge:** `ms-auto` positioned, `variant="outline" text-xs font-mono`

#### Filters
- **Layout:** `flex flex-wrap items-center gap-3`
- **Category select:**
  - Width: `w-44`
  - Options: empty string (all), message, member, voice, channel, role, server, moderation
  - Resets page to 1 on change
- **Target ID search:**
  - Wrapper: `relative w-full sm:w-56`
  - Icon: `absolute inset-s-3 top-1/2 -translate-y-1/2 text-text-muted`
  - Input: `ps-10 font-mono text-sm`
  - Resets page to 1 on change

#### Category Color Mapping
```
message    -> "text-blue-400"
member     -> "text-accent"
voice      -> "text-purple-400"
channel    -> "text-warning"
role       -> "text-warning"
server     -> "text-warning"
moderation -> "text-danger"
```
**Note:** `text-blue-400` and `text-purple-400` are **Tailwind default palette colors**, not design system tokens. This is inconsistent with the rest of the dashboard.

#### Data Table
- **Container:** `overflow-x-auto rounded-lg bg-surface-low shadow-2xl glass-edge`
- **Table min-width:** `min-w-160` (640px)
- **Columns:** Timestamp, Category, Event, Target, Executor
- **Column styling:**
  - Timestamp: `text-xs font-mono text-text-muted whitespace-nowrap`
  - Category: `<Badge variant="secondary">` with category-specific color class
  - Event: `text-sm font-mono`
  - Target: `text-sm text-text-muted font-mono` (shows ID or em-dash)
  - Executor: `text-sm text-text-muted font-mono` (shows ID or em-dash)
- **Server-side pagination** (unlike LogsTable which is client-side)

#### Pagination
- **Layout:** Same as LogsTable -- `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`
- **Info text:** Shows page number, total pages, and total count
- **Page size:** 25

#### Loading State
- `<TableSkeleton rows={8} />`

#### Empty State
- `<EmptyState icon="shield" title=... description=... />`

---

## Interaction Behavior

### Tab Switching
- **Controlled by:** `activeTab` state, default `"activity"`
- **No URL sync** -- tab state is lost on page reload (always starts on "activity").
- **No transition animation** between tabs beyond shadcn defaults.

### LogsTable Interactions
- **Search:** Filters `logs` by `ruleFilter` -- passed as query parameter to `useLogs(guildId, ruleFilter)`.
- **Date range:** Client-side filter using timestamp cutoff.
- **Pagination:** Client-side (`slice`-based) on the filtered results.
- **No row click handler** -- table rows are display-only.
- **No sorting** on table columns.

### EventLogConfig Interactions
- **Auto-save:** Toggle and channel changes immediately call `updateConfig.mutate()` (not `mutateAsync`).
- **No explicit save button.**
- **No undo/cancel** for changes.
- **No optimistic updates visible** in the code.

### EventLogBrowser Interactions
- **Category filter:** Server-side filter via `useLogEntries(guildId, filters)`.
- **Target ID search:** Server-side filter.
- **Pagination:** Server-side via `page` and `limit` params.
- **No row click handler** -- display only.

### Hover/Focus States
- **Table rows:** Default shadcn Table hover (typically `hover:bg-muted/50`).
- **Header rows:** Explicitly `hover:bg-transparent` to suppress hover.
- **Buttons:** Shadcn ghost button defaults.
- **Badges:** No hover interactions.

---

## Dynamic States

### Loading States
- **LogsTable:** `<TableSkeleton rows={8} />` when `isLoading` from `useLogs`.
- **EventLogConfig:** `<TableSkeleton rows={4} />` when `isLoading` from `useLogConfig`.
- **EventLogBrowser:** `<TableSkeleton rows={8} />` when `isLoading` from `useLogEntries`.
- **Note:** All three components handle their own loading independently.

### Empty States
- **LogsTable:** `<EmptyState icon="description">` when no filtered logs.
- **EventLogConfig:** Returns `null` when `!logConfigData` (no visual empty state -- just blank).
- **EventLogBrowser:** `<EmptyState icon="shield">` when no entries.

### Error States
- **No explicit error handling** in any of the three sub-components.
- **No error boundaries, alerts, or toast messages** for failed API calls.
- **`useLogConfig` returns null check** (line 37: `if (!logConfigData) return null`) -- silently renders nothing on error.

### Success States
- **No toast notifications** on EventLogConfig save -- auto-saves silently.
- **No success indicators** anywhere on this page.

---

## RTL Analysis

### Correct RTL Patterns
- **LogsTable search icon:** `inset-s-3` (line 82) -- logical property. **Correct.**
- **LogsTable search input:** `ps-10` (line 89) -- logical property. **Correct.**
- **EventLogBrowser search icon:** `inset-s-3` (line 89) -- logical property. **Correct.**
- **EventLogBrowser search input:** `ps-10` (line 99) -- logical property. **Correct.**
- **Entry count badge:** `ms-auto` (line 58) -- logical property. **Correct.**

### Potential RTL Issues
1. **Table column alignment:** `text-center` on Status column (LogsTable line 119) -- works in both directions. **No issue.**
2. **`max-w-48 truncate`** on error details column (LogsTable line 141) -- truncation is direction-neutral. **No issue.**
3. **CategoryCard layout:** `flex items-center justify-between` -- reverses naturally in RTL. **No issue.**
4. **Event badges `flex-wrap gap-1`** (EventLogConfig line 148) -- wraps naturally. **No issue.**
5. **`#` prefix in channel names** (EventLogConfig line 141, EventLogBrowser not applicable): `#{ch.name}` -- same minor concern as other pages with channel prefixes.
6. **Table `min-w-160`:** Forces horizontal scroll. In RTL, horizontal scrollbar direction should work if `overflow-x-auto` is used (it is). **No issue.**

---

## Responsive Analysis

### Mobile (< 640px)
- **Tabs:** TabsList renders horizontally -- may need scrolling if text is long in some locales.
- **LogsTable stats:** `grid-cols-1` -- single column stacked.
- **LogsTable search:** `w-full` -- full width.
- **LogsTable table:** `min-w-160` with `overflow-x-auto` -- horizontal scroll.
- **LogsTable pagination:** `flex-col gap-2` -- info above buttons.
- **EventLogConfig grid:** Single column (no grid classes before `sm:`).
- **EventLogBrowser search:** `w-full` -- full width.
- **EventLogBrowser table:** Same horizontal scroll pattern.

### Tablet (640px+)
- **LogsTable stats:** `sm:grid-cols-3` -- 3 columns.
- **LogsTable search:** `sm:w-64`.
- **LogsTable pagination:** `sm:flex-row sm:items-center sm:justify-between`.
- **EventLogConfig grid:** `sm:grid-cols-2` -- 2 columns.
- **EventLogBrowser search:** `sm:w-56`.

### Desktop (>= 1024px)
- **EventLogConfig grid:** `lg:grid-cols-3` -- 3 columns.
- **Tables:** Still require horizontal scroll at `min-w-160`.

### Missing Responsive Considerations
- **Tables have fixed min-width** -- always horizontal scroll on mobile. Consider a card-based layout for small screens.
- **No responsive column hiding** -- all columns show at all sizes.
- **Tab names** may truncate in narrow viewports for some locales.
- **EventLogBrowser category select** is `w-44` fixed -- may be too narrow for translated labels.

---

## Modals/Overlays

### None
- This page has **no modals or dialogs**.
- **No confirmation dialogs** for any action.
- **No detail views** for individual log entries.

### Select Dropdowns
- **LogsTable:** 1 Select (date range)
- **EventLogConfig:** 1 Select per CategoryCard (log channel)
- **EventLogBrowser:** 1 Select (category filter)
- All use shadcn Select with Radix popover positioning.

### Tooltips
- **StatsCard** supports tooltip prop but it is not used here.
- **No other tooltips** on the logs page.

---

## Design System Compliance

### Color Tokens

| Usage | Value Used | Expected Token | Status |
|-------|-----------|---------------|--------|
| Stats card borders | `border-success`, `border-danger`, `border-accent` | Design tokens | Compliant |
| Stats card values | `text-success`, `text-danger` | Design tokens | Compliant |
| Search icon | `text-text-muted` | Design token | Compliant |
| Table bg | `bg-surface-low` | Design token | Compliant |
| Table shadow | `shadow-2xl` | Tailwind utility | Compliant |
| Success badge | `variant="success"` | shadcn variant | Compliant |
| Failure badge | `variant="destructive"` | shadcn variant | Compliant |
| Error details | `text-danger` | Design token | Compliant |
| Category "message" | `text-blue-400` | Should use design token | **Hardcoded Tailwind** |
| Category "voice" | `text-purple-400` | Should use design token | **Hardcoded Tailwind** |
| Category "member" | `text-accent` | Design token | Compliant |
| Category "channel/role/server" | `text-warning` | Design token | Compliant |
| Category "moderation" | `text-danger` | Design token | Compliant |
| Config heading icon | `text-accent` | Design token | Compliant |
| Section headings | `font-display` (Space Grotesk) | Design system font | Compliant |
| CategoryCard status text | `text-text-muted` | Design token | Compliant |

### Typography

| Usage | Classes | Status |
|-------|---------|--------|
| Section headings | `text-lg font-semibold font-display` | Compliant |
| Table headers | Via shadcn `TableHead` | Compliant |
| Timestamps | `text-xs font-mono text-text-muted` | Compliant |
| Rule names | `text-sm font-semibold` | Compliant |
| Event types | `text-sm text-text-muted` or `text-sm font-mono` | Compliant |
| IDs | `text-sm text-text-muted font-mono` | Compliant (mono for IDs) |
| Pagination info | `text-xs sm:text-sm` | Compliant |
| Category names | `text-sm font-semibold font-display` | Compliant |
| Badge text | `text-xs` | Compliant |
| Entry count | `text-xs font-mono` | Compliant |

### Spacing
- Page: `space-y-8` (32px)
- Tab content (events): `space-y-8` (32px)
- Stats grid: `gap-4` (16px)
- Filter row: `gap-3` (12px)
- Table section: `space-y-5` (20px -- LogsTable), `space-y-4` (16px -- EventLogBrowser/Config)
- CategoryCard: `p-4 space-y-3`
- Pagination: `gap-1` for buttons, `gap-2` for container

### Border/Radius
- Tables: `rounded-lg` with `glass-edge`
- CategoryCards: `rounded-lg` with `glass-edge`
- Badges: via shadcn (rounded-full or rounded-md depending on variant)
- All consistent with design system.

### Hardcoded Values Summary
1. **`text-blue-400`** (EventLogBrowser line 25) -- Tailwind default, not a design token.
2. **`text-purple-400`** (EventLogBrowser line 27) -- Tailwind default, not a design token.
3. **CATEGORY_ICONS** (EventLogConfig lines 19-27) -- icon names appear to be Lucide-style (`message-circle`, `users`, `hash`, `mic`) rather than Material Symbols. May not render.

### Hardcoded Strings (Not Translated)
**EventLogConfig.tsx:**
- Category icon mapping keys are internal identifiers -- no issue.
- Category event labels use `t()` with `defaultValue: category` fallback -- correct pattern.

**EventLogBrowser.tsx:**
- No hardcoded user-visible strings -- all use `t()`.

**LogsTable.tsx:**
- No hardcoded user-visible strings -- all use `t()`.

### Structural Inconsistencies
1. **Two different pagination patterns:**
   - LogsTable: Client-side pagination (loads all data, slices)
   - EventLogBrowser: Server-side pagination (sends page/limit)
   - Inconsistent approach on the same page.

2. **Two different data sources for "events":**
   - The "Events" tab shows both EventLogConfig and EventLogBrowser, which use different hooks (`useLogConfig` and `useLogEntries`).
   - Both have the same heading text `t("events.title")` -- they would display the same translated string as their heading, which is confusing.

3. **No error handling** across all three sub-components -- failed API calls are silently ignored.

4. **EventLogConfig auto-saves** while LogsTable/EventLogBrowser are read-only. The auto-save pattern has no error feedback.
