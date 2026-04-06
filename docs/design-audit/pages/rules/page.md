# Rules Page - UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/rules.tsx`  
**Component:** `RulesPage`  
**i18n namespace:** `rules`

---

## Structure

### Full Layout Hierarchy

```
div.space-y-6
  nav (Breadcrumb)
    span.text-accent (brand name)
    Icon chevron_right (x2)
    span (guild)
    span.text-text (automation)
  PageHeader (title, subtitle, actions=[Create Rule button])
  [Conditional: !showEditor]
    div.grid.grid-cols-2.sm:grid-cols-4.gap-4          (Stats row)
      StatsCard x4 (totalRules, active, executions7d, successRate)
    div.flex.flex-wrap.gap-3                            (Filter bar)
      div.relative (Search input with icon)
      Select (Event type filter)
      Select (Status filter)
      Select (Sort by)
      Button (Clear filters -- conditional)
    p (Filter results badge -- conditional)
  [Conditional: !showEditor && selectedRuleIds.size > 0]
    div (Bulk action bar)
      span (selected count)
      Button x4 (enable, disable, delete, clear)
  [Conditional: showEditor]
    WorkflowEditor
  [Conditional: !showEditor && rules.length === 0]
    div (Template gallery -- empty state)
      div (Header icon + title + description)
      div.grid (Template cards x6)
      Button (Create from scratch)
  [Conditional: !showEditor && rules.length > 0 && filteredRules.length === 0]
    div (No results empty state)
  [Conditional: !showEditor && filteredRules.length > 0]
    RuleList
  ConfirmDialog (single delete)
  ConfirmDialog (bulk delete)
```

### Component Tree

```
RulesPage
  PageHeader
    Button ("Create Rule")
      Icon (add)
  StatsCard (x4)
  Input (search)
  Icon (search)
  Select (x3: event filter, status filter, sort)
  Button (clear filters)
  [Bulk action bar]
    Button (x4: enable, disable, delete, clear)
  [WorkflowEditor -- full-screen portal]
  [Template Gallery]
    button (x6, one per template)
      Icon (per template)
    Button ("Create from scratch")
  [No Results Empty State]
    Icon (search_off)
  RuleList
    TooltipProvider
      RuleCard (per rule)
        Checkbox (selection)
        Icon (event icon)
        Badge (workflow indicator)
        Tooltip (workflow badge)
        Switch (enable/disable)
        DropdownMenu
          DropdownMenuTrigger (Button with more_vert icon)
          DropdownMenuContent
            DropdownMenuItem (x5: edit, duplicate, toggle, select, delete)
        [Action flow strip]
          Trigger chip
          Arrow connectors
          Action chips (with tooltips)
          Badge (step count, conditional)
  ConfirmDialog (x2)
```

---

## Components Inventory

### PageHeader
- **Props:** `title`, `subtitle`, `actions`
- **Actions slot:** Contains "Create Rule" button, visible only when `!showEditor` (line 346).

### StatsCard (x4)
- **Shown when:** `!showEditor` (line 354)
- **Grid:** `grid-cols-2 sm:grid-cols-4 gap-4`
- **Cards:**
  1. `totalRules` -- no accent override
  2. `active` -- `border-secondary`
  3. `executions7d` -- `border-accent`
  4. `successRate` -- conditional `border-secondary` / `border-warning` at 90% threshold, conditional `text-warning` value class

### Search Input
- **Type:** Text input with search icon overlay
- **Icon position:** `absolute start-3 top-1/2 -translate-y-1/2` (RTL-safe via `start-3`)
- **Input class:** `ps-9` (padding-start for icon space)
- **Container:** `relative w-full sm:flex-1 sm:min-w-50`

### Select Dropdowns (x3)
1. **Event Type Filter:** `w-full sm:w-44`, values from `usedEventTypes` computed from rules + "all"
2. **Status Filter:** `w-[calc(50%-6px)] sm:w-36`, values: all/enabled/disabled
3. **Sort By:** `w-[calc(50%-6px)] sm:w-40`, values: priority/name/recent/status

### Clear Filters Button
- **Shown when:** `search || eventFilter !== "all" || statusFilter !== "all"` (line 431)
- **Variant:** `ghost`, `size="sm"`, `className="text-text-muted"`
- **Behavior:** Resets search, eventFilter, statusFilter to defaults.

### Bulk Action Bar
- **Shown when:** `!showEditor && selectedRuleIds.size > 0` (line 458)
- **Styling:** `rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5`
- **Layout:** `flex-col sm:flex-row sm:items-center sm:gap-3`
- **Buttons:**
  - Enable: `variant="ghost" size="sm"` with check_circle icon
  - Disable: `variant="ghost" size="sm"` with cancel icon
  - Delete: `variant="ghost" size="sm" className="text-danger hover:text-danger"` with delete icon
  - Clear: `variant="ghost" size="sm"`

### Template Gallery (Empty State)
- **Shown when:** `rules.length === 0` (line 494)
- **Container:** `rounded-lg border border-border bg-surface-low p-8 glass-edge`
- **Header:** Centered icon in `bg-accent/10` circle, title, description
- **Template Grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`
- **Template Cards (x6):** `<button>` elements with:
  - Icon in colored bg square (`h-9 w-9 rounded-lg bg-surface-high`)
  - Title (`text-sm font-medium`) and description (`text-xs text-text-muted`)
  - Hover: `hover:border-accent/40 hover:bg-surface-high/50`
  - Text hover: `group-hover:text-accent transition-colors`
- **Template Colors:**
  - Welcome: `text-secondary`
  - Auto Role: `text-accent`
  - Log Deleted: `text-warning`
  - Boost Thank You: `text-[#f47fff]` -- **hardcoded hex, not a design token**
  - Ban Logger: `text-danger`
  - Auto Thread: `text-secondary`
- **"Create from scratch" button:** `variant="ghost"` centered below grid

### No Results Empty State
- **Shown when:** `filteredRules.length === 0` but `rules.length > 0` (line 536)
- **Layout:** Centered column with search_off icon, title, description
- **Styling:** `rounded-lg bg-surface-low p-12 text-center glass-edge`

### RuleList
- **Source:** `components/RuleList.tsx` (lines 43-287)
- **Props:** `rules`, `constants`, `onEdit`, `onDelete`, `onToggle`, `onDuplicate`, `selectedIds`, `onSelectionChange`
- **Each rule card contains:**
  - **Selection checkbox** (when selectable): `<Checkbox>` wrapped in click-stop div
  - **Event icon:** `h-8 w-8 rounded-lg bg-accent/10` with event type icon
  - **Name:** `text-sm font-semibold truncate`, dimmed when disabled (`text-text-muted`)
  - **Workflow badge:** `<Badge variant="outline">` with "Workflow" text, shown when `hasSteps`
  - **Event label + last fired + priority:** `text-xs text-text-muted` with dot separators
  - **Toggle switch:** `<Switch>` with tooltip
  - **Context menu:** `<DropdownMenu>` with edit, duplicate, toggle, select, delete items
  - **Action flow strip:** Bottom section with trigger chip + arrow connectors + action chips

### WorkflowEditor
- **Source:** `components/workflow/WorkflowEditor.tsx` (lines 89-655)
- **Rendered as:** Full-screen portal (`createPortal(content, document.body)`)
- **Fixed overlay:** `fixed inset-0 z-50 flex flex-col bg-surface-lowest`
- **Contains:**
  - Floating toolbar (name input, priority, enabled switch, add buttons, validation status, save)
  - Error banner (conditional `<Alert variant="destructive">`)
  - ReactFlow canvas with nodes, edges, controls, minimap, background
  - NodeDetailPanel (slide-in from right, `w-full sm:w-96`)
  - Keyboard shortcuts hint bar
- **See dedicated section below for full WorkflowEditor analysis.**

### ConfirmDialog (x2)
- **Source:** `components/ConfirmDialog.tsx` (lines 21-54)
- **Uses:** shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`
- **Single Delete Dialog:** Opened when `deleteTarget` is set, `destructive` variant
- **Bulk Delete Dialog:** Opened when `bulkDeleteConfirm` is true, `destructive` variant
- **Buttons:** "Cancel" (ghost) + confirm (destructive variant)
- **Close:** `onOpenChange` sets state to null/false

---

## Interaction Behavior

### CRUD Operations

| Action | Handler | Mutation | Toast |
|--------|---------|----------|-------|
| Create rule | `handleSubmit` in WorkflowEditor | `useCreateRule` | `t("toast.created")` |
| Edit rule | `handleEdit` -> opens editor | `useUpdateRule` | `t("toast.updated")` |
| Delete rule | `handleDelete` -> confirm dialog -> `confirmDelete` | `useDeleteRule` | `t("toast.deleted")` |
| Toggle rule | `handleToggle` | `useUpdateRule` | `t("toast.enabled")` / `t("toast.disabled")` |
| Duplicate rule | `handleDuplicate` | `useCreateRule` | `t("toast.duplicated")` |
| Bulk enable | `handleBulkEnable` | `useBulkRuleAction` | `t("toast.bulkEnabled")` |
| Bulk disable | `handleBulkDisable` | `useBulkRuleAction` | `t("toast.bulkDisabled")` |
| Bulk delete | `confirmBulkDelete` | `useBulkRuleAction` | `t("toast.bulkDeleted")` |

### Filter Behavior
- **Search:** Filters by `name.toLowerCase().includes(q)` -- case-insensitive substring match.
- **Event filter:** Exact match on `eventType` field.
- **Status filter:** `enabled` / `disabled` / `all`.
- **Sort:** `priority` (desc), `name` (alphabetical), `recent` (last fired desc), `status` (enabled first).
- **Filter results badge:** Shows `"Showing X of Y"` when filtered count differs from total.

### Duplicate Logic
- Strips existing `(copy)` or `(copy N)` suffix from base name.
- Appends `(copy)`, then increments counter if name already exists.
- Copies all fields including steps, entryStepId (if present), conditions, priority, enabled.

### Selection
- **Checkbox:** Toggle individual selection via `toggleSelection(ruleId)`.
- **Click stop propagation** on checkbox area to prevent opening the editor.
- **Clear selection** button in bulk bar and after successful bulk actions.

### Hover/Focus States
- **Rule card:** `hover:bg-surface-high/40`, border changes `hover:border-accent/20`
- **Selected card:** `border-accent/50 bg-accent/5`
- **Disabled rule:** `border-border/50`, name text `text-text-muted`
- **Dropdown more button:** `opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity` -- hidden on desktop until hover
- **Template card:** `hover:border-accent/40 hover:bg-surface-high/50`, title `group-hover:text-accent transition-colors`
- **Delete dropdown item:** `text-danger focus:text-danger`

---

## Dynamic States

### Loading State
- **Condition:** `isLoading` (line 208)
- **Renders:** `<PageSkeleton />` -- generic skeleton.
- **No partial loading** -- entire page or nothing.

### Empty State (No Rules)
- **Condition:** `rules.length === 0` (line 494)
- **Template gallery** with 6 preset templates and "Create from scratch" CTA.
- **Icon:** Bolt in accent circle.

### Empty State (No Filter Results)
- **Condition:** `filteredRules.length === 0` but rules exist (line 536)
- **Search off icon** in neutral circle, title + description.

### Error States
- **Per-action errors:** Caught in try/catch, show `toast.error()` with translated messages.
- **WorkflowEditor:** Shows `<Alert variant="destructive">` banner for validation/API errors.
- **No global error boundary** visible at the page level.

### Success States
- **All mutations:** Show `toast.success()` with translated messages via sonner.

---

## RTL Analysis

### Correct RTL Patterns
- **Breadcrumb chevrons:** `className="rtl:rotate-180"` on both `chevron_right` icons (line 334, 336). **Correct.**
- **Search icon:** `absolute start-3` (line 383). **Correct.**
- **Input padding:** `ps-9` (line 390). **Correct.**
- **Bulk action buttons:** `sm:ms-auto` (line 463). **Correct.**
- **Tooltip content `me-0.5`** on workflow badge icon (RuleList line 126). **Correct.**
- **WorkflowEditor back arrow:** `className="rtl:rotate-180"` (line 395). **Correct.**
- **NodeDetailPanel:** `absolute end-0` and `border-s` (line 111). **Correct.**
- **NodeDetailPanel slide animation:** `slide-in-from-right-4` -- this may need RTL override since it is a physical direction animation. **Potential issue.**

### Potential RTL Issues
1. **Action flow strip arrows (RuleList lines 226-229):** CSS arrow drawn with `border-r border-t` and `rotate-45` -- physically right-pointing. In RTL this should mirror. **Issue: physical border direction not mirrored.**
2. **Action flow strip inter-action arrows (lines 259-261):** Same issue with `border-r border-t border-secondary/30`.
3. **Template card layout (line 512):** `text-start` used on `<button>` -- this is a logical property. **Correct.**
4. **`text-[#f47fff]`** (line 89): Color value, not directional. No issue.
5. **WorkflowEditor `Panel position="bottom-right"` (line 556):** ReactFlow panel uses physical positioning. **Potential issue in RTL.**
6. **WorkflowEditor `me-2!`** (line 556): Has RTL-safe logical property. **Correct.**

---

## Responsive Analysis

### Mobile (< 640px)
- **Stats grid:** `grid-cols-2` -- 2 columns.
- **Filter bar:** `flex-wrap` -- wraps to multiple lines.
- **Search:** `w-full` -- full width.
- **Status filter:** `w-[calc(50%-6px)]` -- half width minus gap.
- **Sort:** `w-[calc(50%-6px)]` -- half width minus gap.
- **Bulk bar:** `flex-col` -- stacked vertically.
- **Template grid:** `grid-cols-1` -- single column.
- **Dropdown menu trigger:** `opacity-100` -- always visible on mobile.
- **WorkflowEditor toolbar:** `flex-wrap` -- wraps, `gap-2`, smaller padding `px-3 py-2`.
- **WorkflowEditor name input:** `w-32` (128px) on mobile.
- **NodeDetailPanel:** `w-full` on mobile, covers entire canvas.

### Tablet (640px - 1024px)
- **Stats grid:** `sm:grid-cols-4` -- 4 columns.
- **Search:** `sm:flex-1 sm:min-w-50` -- flexible width.
- **Event filter:** `sm:w-44`.
- **Status filter:** `sm:w-36`.
- **Sort:** `sm:w-40`.
- **Bulk bar:** `sm:flex-row sm:items-center sm:gap-3`.
- **Template grid:** `sm:grid-cols-2` -- 2 columns.
- **WorkflowEditor toolbar:** `sm:gap-3 sm:px-4 sm:py-2.5`.
- **WorkflowEditor name input:** `sm:w-52`.
- **NodeDetailPanel:** `sm:w-96` (384px).

### Desktop (>= 1024px)
- **Template grid:** `lg:grid-cols-3` -- 3 columns.
- **Dropdown trigger:** `sm:opacity-0 sm:group-hover:opacity-100` -- show on hover only.

---

## Modals/Overlays

### ConfirmDialog (Single Delete)
- **Trigger:** `setDeleteTarget(rule)` from `handleDelete` or dropdown menu.
- **Open state:** `!!deleteTarget`
- **Content:** Title + description with rule name interpolated.
- **Actions:** Cancel (ghost) + Delete (destructive).
- **Close:** Setting `deleteTarget` to `null`.

### ConfirmDialog (Bulk Delete)
- **Trigger:** `setBulkDeleteConfirm(true)` from bulk action bar.
- **Open state:** `bulkDeleteConfirm`
- **Content:** Title + description with selected count.
- **Close:** Setting `bulkDeleteConfirm` to `false`.

### WorkflowEditor (Full-Screen Portal)
- **Trigger:** `setShowEditor(true)` from Create Rule button, template selection, or rule edit.
- **Rendered via:** `createPortal(content, document.body)` -- escapes DOM hierarchy.
- **Positioning:** `fixed inset-0 z-50` -- covers entire viewport.
- **Close:** `onClose` handler (Escape key or back button).
- **Contains nested overlays:**
  - NodeDetailPanel (slide-in panel, `z-20`)
  - ReactFlow Controls, MiniMap
  - Tooltips (via TooltipProvider)

### DropdownMenu (Per Rule)
- **Trigger:** More button (`more_vert` icon), `h-8 w-8`.
- **Content alignment:** `align="end"`.
- **Items:** Edit, Duplicate, Toggle, Select (conditional), Separator, Delete (destructive).
- **Click stop propagation:** Parent div has `e.stopPropagation()` to prevent card click.

### Tooltips
- **Workflow badge:** "Uses step-based workflow with conditions/delays"
- **Switch toggle:** "Enable rule" / "Disable rule"
- **Action chips:** Shows action label + preview text
- **WorkflowEditor priority input:** "Priority (0-100)"
- **WorkflowEditor fit view button:** "Fit to view" with keyboard shortcut
- **WorkflowEditor validation status:** Lists all validation issues

---

## Design System Compliance

### Color Tokens

| Usage | Value Used | Expected Token | Status |
|-------|-----------|---------------|--------|
| Breadcrumb brand | `text-accent` | Token | Compliant |
| Breadcrumb text | `text-text-muted`, `text-text` | Tokens | Compliant |
| Stats borders | `border-secondary`, `border-accent`, `border-warning` | Tokens | Compliant |
| Search icon | `text-text-muted` | Token | Compliant |
| Template boost color | `text-[#f47fff]` | No matching token | **Hardcoded** |
| Bulk bar border | `border-accent/30` | Token with opacity | Compliant |
| Bulk bar bg | `bg-accent/5` | Token with opacity | Compliant |
| Delete items | `text-danger` | Token | Compliant |
| Selected card | `border-accent/50 bg-accent/5` | Tokens with opacity | Compliant |
| Rule card event icon bg | `bg-accent/10` | Token with opacity | Compliant |
| Trigger chip | `border-accent/20 bg-accent/5 text-accent` | Tokens | Compliant |
| Action chip | `border-outline-variant/10 bg-surface-high text-secondary` | Tokens | Compliant |
| Flow arrow | `bg-accent/30`, `border-accent/40` | Tokens | Compliant |
| Unconfigured indicator | `bg-warning/60` | Token with opacity | Compliant |
| WorkflowEditor edge selected | `rgba(163, 166, 255, 0.9)` inline CSS | Should use CSS variable | **Hardcoded** |
| WorkflowEditor connection line | `rgba(163, 166, 255, 0.4)` | Should use CSS variable | **Hardcoded** |
| ReactFlow background dots | `rgba(255,255,255,0.04)` | Should use token | **Hardcoded** |
| MiniMap mask | `rgba(14, 14, 16, 0.8)` | Should use `--color-background` | **Hardcoded** |

### Typography

| Usage | Classes | Status |
|-------|---------|--------|
| Breadcrumb | `text-xs text-text-muted` | Compliant |
| Page title | Via PageHeader `text-2xl font-bold sm:text-3xl` | Compliant |
| Stats labels | `section-label` (via StatsCard) | Compliant |
| Search placeholder | Default Input styling | Compliant |
| Rule name | `text-sm font-semibold truncate` | Compliant |
| Event label | `text-xs text-text-muted` | Compliant |
| Priority | `font-mono text-[10px]` | Compliant (mono for data) |
| Template title | `text-sm font-medium` | Compliant |
| Template description | `text-xs text-text-muted` | Compliant |
| Flow chip text | `text-[11px] font-medium` | Consistent with compact chip pattern |
| Keyboard hints | `font-mono text-[10px]` | Compliant |

### Spacing
- Page: `space-y-6` (24px)
- Stats grid: `gap-4` (16px)
- Filter bar: `gap-3` (12px)
- Rule list: `gap-3` (12px)
- Template grid: `gap-3` (12px)
- Rule card padding: `p-4 pb-3` (top section), `px-4 py-2.5` (action strip)

### Border/Radius
- Rule cards: `rounded-lg border`
- Template cards: `rounded-lg border border-border`
- Bulk bar: `rounded-lg border`
- Template gallery container: `rounded-lg border border-border`
- Icon containers: `rounded-lg` (square) or `rounded-full` (circle)
- All major surfaces use `glass-edge` custom class

### Hardcoded Values Summary
- `text-[#f47fff]` for boost template color (line 89)
- `rgba(163, 166, 255, ...)` for WorkflowEditor edge styling (lines 384-387, 539)
- `rgba(255,255,255,0.04)` for ReactFlow background dots (line 546)
- `rgba(14, 14, 16, 0.8)` for MiniMap mask (line 554)
- `border-outline-variant/10` references a token that may not be in the primary design system

### Hardcoded Strings (Not Translated)
The following strings in sub-components are in English and not run through `t()`:

**RuleList.tsx:**
- "Workflow" (line 128), "Uses step-based workflow..." (line 130)
- "Never fired", "Fired ..." (lines 140-141)
- "P" + priority (line 146)
- "Edit Rule", "Duplicate", "Enable"/"Disable", "Select"/"Deselect", "Delete" (lines 183-206)
- "Trigger" (line 222), "Unconfigured" (line 247)

**WorkflowEditor.tsx:**
- "Rule name..." placeholder (line 405)
- "Enabled"/"Disabled" (line 429)
- "Action", "Condition", "Delay" (lines 441-458)
- "Ready" (line 496), "Close", "Save", "Remove node", "Add action", "Fit view" (lines 625-641)
- "Drag handles to connect..." hint (line 640)

**NodeDetailPanel.tsx:**
- "Trigger Settings", "Condition", "Delay", "Action Step" (lines 91-103)
- "Settings", "Filters", "Vars", "Variables" (tabs)
- "Event Type", "Action Type", "Select event...", "Select action..." (various)
- "Move Up", "Move Down", "Remove Action", "Remove Step", "Remove Condition", "Remove Delay"
- Condition field labels, operator labels
- "Yes branch" / "No branch" explanations
- Variable tab instructions

**ConfirmDialog.tsx:**
- "Cancel" default text (line 38) -- not translated, but overridden by props from the page which are translated
