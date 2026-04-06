# Tickets Page UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/tickets.tsx`
**Component:** `TicketsPage`
**Lines:** 527

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle)
  div.grid.grid-cols-1.gap-4.sm:grid-cols-2.lg:grid-cols-4   [Stats row]
    StatsCard (totalTickets)
    StatsCard (open)
    StatsCard (claimed)
    StatsCard (panels)
  Tabs (defaultValue="tickets")
    TabsList
      TabsTrigger "tickets"
      TabsTrigger "panels"
      TabsTrigger "settings"
    TabsContent "tickets"
      Card.bg-surface.p-6
        Filter bar (Label + 4x Button)
        [Loading | Table + Pagination | Empty]
    TabsContent "panels"
      Card.bg-surface.p-6
        h3 + p + [Loading | Table | Empty] + Separator + Create form
    TabsContent "settings"
      Card.bg-surface.p-6
        h3 + [Loading | Settings form | null]
```

### Component Tree

- `PageHeader` -- title, subtitle only
- `StatsCard` x4 -- totalTickets, open, claimed, panels
- `Tabs` > `TabsList` > `TabsTrigger` x3
- `TabsContent` x3 each containing `Card`
- **Active Tickets tab**: Filter buttons, Table (7 columns), pagination
- **Panel Builder tab**: Panel table (5 columns), create panel form
- **Settings tab**: Staff roles input, transcript channel input, maxOpenPerUser, autoCloseHours, namingFormat, save button

---

## Components Inventory

| Component | Variant/Props | Count | Notes |
|-----------|--------------|-------|-------|
| `PageHeader` | title, subtitle | 1 | No actions |
| `StatsCard` | label, value | 4 | No accentColor, no valueClassName, no tooltip |
| `Tabs` | defaultValue="tickets" | 1 | Uncontrolled |
| `TabsTrigger` | value | 3 | tickets, panels, settings |
| `Card` | className="bg-surface p-6" | 3 | One per tab |
| `Table` | -- | 2 | Tickets (7 cols), panels (5 cols) |
| `Badge` | variant varies | multiple | Status badges, category badges, deploy status |
| `Button` | variant="default"/"outline" size="sm" | 4 | Status filter buttons |
| `Button` | variant="ghost" size="sm" | varies | Close ticket, send/delete panel |
| `Button` | variant="outline" size="sm" | 2 | Pagination |
| `Button` | default | 2 | Create panel, save settings |
| `Input` | type="text" | 5 | Panel name/channel, staff roles, transcript channel, naming format |
| `Input` | type="number" className="w-24" | 2 | maxOpenPerUser, autoCloseHours |
| `Label` | htmlFor | 7 | All form inputs |
| `Separator` | -- | 5 | Between sections |
| `Icon` | various | 4 | close, description, send, delete |

### Conditional Rendering

- **Close button**: only shown when `ticket.status !== "closed"`
- **Transcript link**: only shown when `ticket.transcriptUrl` exists
- **Pagination**: only when `totalPages > 1`
- **Settings form**: only when `settings` is truthy
- **Panel table vs empty**: based on `panels.length > 0`
- **Category badges**: `panel.categories.map(...)` with conditional emoji prefix

---

## Interaction Behavior

### Hover/Focus/Active/Disabled States

- **Filter buttons**: `variant={statusFilter === s ? "default" : "outline"}` -- active filter uses default (filled) variant
- **Close ticket button**: `disabled={closeTicketMutation.isPending}`
- **Send panel button**: `disabled={sendPanel.isPending}`
- **Delete panel button**: `disabled={deletePanel.isPending}`
- **Create panel button**: `disabled={createPanel.isPending}`
- **Save settings button**: `disabled={updateSettings.isPending}`
- **Pagination buttons**: disabled at boundaries
- **Transcript link**: `className="ms-1 text-primary hover:underline"` -- standard link hover

### Click Handlers

| Element | Handler | Side Effect |
|---------|---------|-------------|
| Filter buttons | `setStatusFilter(s); setPage(1)` | Resets to page 1 on filter change |
| Close ticket | `handleCloseTicket(ticketId)` | Mutation + toast |
| Create panel | `handleCreatePanel()` | Validation + mutation + toast + form reset |
| Delete panel | `handleDeletePanel(panelId)` | Mutation + toast |
| Send panel | `handleSendPanel(panelId)` | Mutation + toast |
| Save settings | `handleSaveSettings()` | Collects inputs + mutation + toast |
| Number inputs | `handleNumberSetting(key, value)` | Immediate mutation on change |
| Naming format | `handleNamingFormatChange(value)` | Immediate mutation on change |
| Pagination | `setPage(...)` | Page state change |

### Form Validation

- **Create panel**: name and channel must be non-empty after trim; error via `toast.error()`
- **Number settings**: `parseInt`, must be finite, >=0; silently rejects invalid values (no error toast)
- **Staff roles**: split by comma, trim, filter empty
- **Hardcoded category**: `{ name: "general", label: "Open Ticket" }` -- non-configurable via form

### Mixed State Patterns

This page uses **two different patterns simultaneously**:
1. **Auto-save on change**: `handleNumberSetting` and `handleNamingFormatChange` fire mutations on every keystroke
2. **Manual save**: Staff roles and transcript channel use local state + Save button

This inconsistency is confusing -- some fields save immediately while others require clicking Save.

---

## Dynamic States

### Loading States

- **Tickets tab**: `<p className="text-text-muted">{t("loading")}</p>` -- plain text
- **Panels tab**: `<p className="text-text-muted">{t("loading")}</p>` -- plain text
- **Settings tab**: `<p className="text-text-muted">{t("common:actions.loading")}</p>` -- plain text
- **Stats cards**: show "..." while loading

### Empty States

- **Tickets**: `<p className="text-text-muted">{t("empty.tickets")}</p>` -- plain text only
- **Panels (in description)**: `<p className="mb-4 text-sm text-text-muted">{t("empty.panels")}</p>` -- same text used for description AND empty state

### Error States

- All via `toast.error()` -- no inline errors
- API error extraction pattern consistent

### Success States

- Toast notifications for all successful operations

---

## RTL Analysis

### Hardcoded LTR Styles

| Location | Class/Style | Issue |
|----------|------------|-------|
| Line 283 | `ms-1` on transcript link | **Correct** -- logical margin-inline-start |
| Line 354 | `me-1` on category badges | **Correct** -- logical margin-inline-end |

### Missing Logical Properties

- No `ml-*`/`mr-*` used
- No `text-left`/`text-right` used
- No `pl-*`/`pr-*` used

### Overall RTL Assessment

**Good.** Uses `ms-1` and `me-1` logical properties correctly. No hardcoded directional styles.

---

## Responsive Analysis

### Breakpoint Usage

| Breakpoint | Usage | Lines |
|-----------|-------|-------|
| `sm:grid-cols-2` | Stats row (mobile -> 2 cols) | 182 |
| `lg:grid-cols-4` | Stats row (lg -> 4 cols) | 182 |
| `sm:flex-row sm:items-end` | Create panel form | 396 |

### Mobile Behavior

- Stats: 1 col mobile -> 2 cols sm -> 4 cols lg (best responsive stats pattern among audited pages)
- **Tickets table**: 7 columns (#, user, subject, status, assignee, created, actions) -- **no horizontal scroll wrapper; will overflow badly on mobile**
- **Panels table**: 5 columns -- will also overflow on mobile
- Create panel form stacks on mobile via `flex-col`/`sm:flex-row`
- Settings form: `flex items-center justify-between` for number inputs -- functional on mobile

### Potential Issues

1. **Tickets table overflow** -- most problematic table among all audited pages (7 columns with IDs)
2. **Panels table overflow** -- 5 columns including category badges
3. **No `md:` breakpoint** -- jumps from `sm:` to `lg:` for stats only

---

## Modals/Overlays

**None.** No Dialog or overlay components used. All interactions are inline.

---

## Design System Compliance

### Color Tokens

| Usage | Value | Compliant? |
|-------|-------|-----------|
| `bg-surface` | Card backgrounds | Yes |
| `text-text-muted` | Secondary text, loading, empty states | Yes |
| `text-danger` | Close ticket icon, delete panel icon | Yes |
| `text-primary` | Transcript link | Yes |

### Typography

| Usage | Classes | Compliant? |
|-------|---------|-----------|
| Section titles | `text-lg font-semibold` | Yes |
| Sub-heading | `text-sm font-semibold` | Yes |
| Body/description | `text-sm text-text-muted` | Yes |
| Table IDs | `font-mono text-xs` | Yes |
| Ticket number | `font-mono text-xs font-bold` | Yes |
| Date cells | `text-xs` | Yes |
| Hint text | `text-xs text-text-muted` | Yes |

### Spacing

| Pattern | Classes | Notes |
|---------|---------|-------|
| Page rhythm | `space-y-8` | Consistent |
| Card padding | `p-6` | Standard |
| Filter bar gap | `gap-3` (label area), `gap-2` (buttons) | Consistent |
| Section gap | `space-y-6` | Settings sections |
| Separator margin | `my-6` | Consistent |

### Hardcoded Values

| Location | Value | Concern |
|----------|-------|---------|
| `className="w-48"` | Panel name/channel inputs | Acceptable |
| `className="w-24"` | Number inputs | Acceptable |
| `className="w-64"` | Naming format input | Acceptable |
| `className="w-16"` | Table column widths | Acceptable |
| `className="w-24"` | Table action column | Acceptable |

### Hardcoded Strings (i18n Violations)

| Location | String | Should Be |
|----------|--------|-----------|
| Line 103 | `"Open Ticket"` (hardcoded category label) | Should use `t("panelBuilder.defaultCategoryLabel")` |
| Line 103 | `"general"` (hardcoded category name) | Should use constant or i18n key |
| Line 297-298 | `Page {page} of {totalPages} ({ticketData.total} total)` | **Hardcoded English** -- should use `t("pagination.pageInfo", {...})` |
| Line 437 | `"e.g. 123456789, 987654321"` | Placeholder -- borderline; placeholders are often not translated |
| Line 455 | `"e.g. 123456789"` | Same |
| Line 510 | `Variables: {"{number}"} (zero-padded), {"{username}"}` | **Hardcoded English** -- should be an i18n key |

### Missing Design System Usage

- **No `glass-edge` class** on Cards
- **No skeleton loading** -- plain text everywhere
- **Empty states** are plain text -- no visual treatment
- **Panel categories use `me-1`** on badges but no visual separator between multiple categories
- **Filter buttons** work well as a toggle group but could use a dedicated `ToggleGroup` component if available

---

## Findings Summary

### Critical Issues

1. **Hardcoded English strings** -- pagination info (line 297-298) and naming format variables hint (line 510) bypass i18n completely
2. **Hardcoded category in `handleCreatePanel`** -- `{ name: "general", label: "Open Ticket" }` is English-only and not configurable

### Other Issues

3. **Mixed save patterns** -- auto-save on keystroke for numbers/naming format vs manual Save button for roles/transcript channel. Confusing UX.
4. **Tickets table has 7 columns with no responsive solution** -- worst mobile overflow among audited pages
5. **Panels table has 5 columns with no scroll wrapper**
6. **`empty.panels` i18n key** used both as section description AND empty state text (line 332 and 390) -- same key, ambiguous meaning
7. **No skeleton loading states**
8. **Empty states** lack visual treatment (icons, CTAs)
9. **Transcript link** inline with close button in the same cell without clear visual separation
10. **Panel creation form** only supports single category with hardcoded values -- no category customization UI

### Strengths

1. **Best responsive stats grid** -- uses `sm:grid-cols-2 lg:grid-cols-4` for 4 stats cards
2. **Status filter buttons** -- good UX pattern with visual active state
3. **Good RTL compliance** -- uses `ms-1` and `me-1`
4. **Complete ticket lifecycle** -- open, claimed, closed statuses with close action and transcript access
