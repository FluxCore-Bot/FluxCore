# Warnings Page — UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/warnings.tsx`

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle)
  div.grid.grid-cols-1.gap-4.sm:grid-cols-3   (Stats Row)
    StatsCard (Total Warnings)
    StatsCard (Escalation Rules)
    StatsCard (DM on Warn)
  Tabs (defaultValue="warnings")
    TabsList
      TabsTrigger[value="warnings"]
      TabsTrigger[value="escalation"]
      TabsTrigger[value="settings"]
    TabsContent[value="warnings"]
      Card.bg-surface.p-6
        div.mb-4.flex (filter bar)
          div.flex.items-center.gap-2
            Input (user ID filter)
            Button[variant="destructive",size="sm"] (Clear All, conditional)
        p.text-text-muted (loading) | Table (data) | p.text-text-muted (empty)
        Table
          TableHeader > TableRow > 6x TableHead
          TableBody > TableRow (per warning)
            TableCell (ID, mono)
            TableCell (userId, mono)
            TableCell (moderatorId, mono)
            TableCell (reason, truncated)
            TableCell (date, muted)
            TableCell > Button[ghost] > Icon[delete]
        div.mt-4 (pagination, conditional)
          p.text-sm.text-text-muted (page info)
          div.flex.gap-2 > Button[outline,sm] (prev) + Button[outline,sm] (next)
    TabsContent[value="escalation"]
      Card.bg-surface.p-6
        h3.mb-4.text-lg.font-semibold
        p.mb-4.text-sm.text-text-muted
        p (loading) | Table (punishments) | p (empty)
        Table
          TableHeader > TableRow > 4x TableHead
          TableBody > TableRow (per punishment)
            TableCell (threshold)
            TableCell.capitalize (action)
            TableCell (duration or em-dash)
            TableCell > Button[ghost] > Icon[delete]
        Separator.my-6
        h4.mb-3.text-sm.font-semibold
        div.flex.flex-col.gap-3.sm:flex-row.sm:items-end (add rule form)
          div > Label + Input[type=number,w-24]
          div > Label + Select (action type)
          div > Label + Input[type=number,w-32] (conditional: timeout duration)
          Button (Add)
    TabsContent[value="settings"]
      Card.bg-surface.p-6
        h3.mb-4.text-lg.font-semibold
        p (loading) | div.space-y-6 (settings)
          div.flex.items-center.justify-between (DM on Warn)
            div > p.font-medium + p.text-sm.text-text-muted
            Switch
          Separator
          div.flex.items-center.justify-between (Require Reason)
            div > p.font-medium + p.text-sm.text-text-muted
            Switch
          Separator
          div.flex.items-center.justify-between (Max Warnings)
            div > p.font-medium + p.text-sm.text-text-muted
            Input[type=number,w-24]
```

---

## Components Inventory

| Component | Source | Variants/Props Used | States |
|-----------|--------|---------------------|--------|
| `PageHeader` | custom | `title`, `subtitle` | static |
| `StatsCard` | custom | `label`, `value` (string/number) | loading shows "..." |
| `Tabs` | shadcn/ui | `defaultValue="warnings"` | 3 tabs |
| `TabsList` | shadcn/ui | default | - |
| `TabsTrigger` | shadcn/ui | 3 values | active/inactive |
| `TabsContent` | shadcn/ui | 3 panels | shown/hidden |
| `Card` | shadcn/ui | `className="bg-surface p-6"` | static |
| `Input` | shadcn/ui | `type="text"`, `type="number"`, width classes | controlled |
| `Button` | shadcn/ui | `variant="destructive"`, `variant="ghost"`, `variant="outline"`, default | disabled when isPending |
| `Select` | shadcn/ui | controlled | - |
| `SelectTrigger` | shadcn/ui | `className="w-32"` | - |
| `SelectContent` | shadcn/ui | default | - |
| `SelectItem` | shadcn/ui | 3 items (timeout/kick/ban) | - |
| `Table` | shadcn/ui | default | - |
| `TableHeader/Row/Head/Body/Cell` | shadcn/ui | various width/style classes | - |
| `Switch` | shadcn/ui | `checked`, `onCheckedChange` | controlled |
| `Separator` | shadcn/ui | default, `className="my-6"` | static |
| `Label` | shadcn/ui | `htmlFor` | static |
| `Icon` | custom | `name="delete"`, `size={16}`, `className="text-danger"` | static |

---

## Interaction Behavior

### Filter & Pagination
- `Input` for user ID filter updates `userFilter` state and resets `page` to 1
- "Clear All" button (conditional on `userFilter` non-empty): calls `handleClearUserWarnings`
  - Validates `userFilter` non-empty (toast error if empty)
  - On success: toast + clears filter
  - On error: toast with API error message

### Warning Deletion
- Each row has a ghost delete button with `Icon[delete]` in `text-danger`
- Direct call to `deleteWarning.mutate(id)` -- no confirmation dialog
- Success/error toasts

### Escalation Rule Management
- Inline form at bottom of escalation tab
- Threshold: `Input[number]` validated for `>= 1` and finite
- Action: `Select` with timeout/kick/ban
- Duration: conditionally shown when action is "timeout"
- "Add" button calls `handleAddPunishment`
- On success: toast + resets form fields
- Delete rule: ghost button per row, no confirmation

### Settings Toggles
- DM on Warn: `Switch` directly calls `handleToggleSetting("dmOnWarn", checked)`
- Require Reason: `Switch` directly calls `handleToggleSetting("reasonRequired", checked)`
- Max Warnings: `Input[number]` onChange calls `handleMaxWarningsChange` with validation (`>= 0`, finite)
- All settings mutations show error toast on failure, no success toast (immediate visual feedback via switch state)

### Pagination
- Previous/Next buttons with `disabled` when at bounds
- Page info text using `t("pagination.page", { page, total, count })`

---

## Dynamic States

### Loading State
- **Stats cards:** Show "..." as value text while loading
- **Warnings tab:** Shows `p.text-text-muted` with `t("loading")`
- **Escalation tab:** Shows `p.text-text-muted` with `t("common:actions.loading")`
- **Settings tab:** Shows `p.text-text-muted` with `t("common:actions.loading")`
- **No PageSkeleton used** -- bare text loading indicators

### Empty State
- **Warnings table:** `p.text-text-muted` with `t("noWarnings")`
- **Escalation table:** `p.mb-4.text-text-muted` with `t("escalation.noRules")`
- **Settings:** Returns `null` when settings is falsy (renders nothing)
- **No EmptyState component used** -- plain text messages only

### Error State
- All errors shown via `toast.error()` using sonner
- `ApiError.message` extracted when available
- No inline error alerts

### Success State
- All successes shown via `toast.success()` using sonner

---

## RTL Analysis

### Issues Found

1. **No `ms`/`me` usage detected:** The page does not use any margin-left/right utilities directly. All spacing is via `gap` and `space-y`, which are direction-neutral.

2. **`justify-between`:** Used for settings rows and pagination. This is RTL-safe (reverses automatically in flex).

3. **`w-64`, `w-24`, `w-32`, `w-16`:** Fixed width classes. These are direction-neutral but the filter input `w-64` may truncate in RTL languages with longer placeholder text.

4. **`truncate` on reason cell:** `max-w-xs truncate` is direction-safe as Tailwind truncate uses `text-overflow: ellipsis` which respects text direction.

5. **`text-xs` with no `text-start`/`text-end`:** Default text alignment inherits from parent, which is LTR-safe. No explicit `text-left`/`text-right` found.

### RTL Verdict
Fully RTL-safe. No hardcoded `left`/`right`/`ml`/`mr` properties found. All directional properties use logical equivalents or are direction-neutral.

---

## Responsive Analysis

### Mobile (< 640px)
- Stats grid: `grid-cols-1` (single column stack)
- Filter bar: `flex-col gap-3` (filter input above clear button)
- Escalation add form: `flex-col gap-3` (stacked fields)
- Table: may overflow horizontally -- **no horizontal scroll wrapper**
- Pagination: `flex items-center justify-between` (may feel tight)

### Tablet/Desktop (>= 640px, `sm:`)
- Stats grid: `sm:grid-cols-3`
- Filter bar: `sm:flex-row sm:items-center sm:justify-between`
- Escalation form: `sm:flex-row sm:items-end`

### Breakpoints Used
- `sm:` only (640px)
- No `md:`, `lg:`, or `xl:` breakpoints

### Responsive Gaps
1. **Table overflow on mobile:** Both the warnings table (6 columns) and escalation table (4 columns) have no responsive scroll container. On mobile, the table will overflow the viewport. Should wrap in `div.overflow-x-auto`.
2. **Pagination on mobile:** The `justify-between` layout on narrow screens puts page info and buttons on the same line, which may not have enough space.

---

## Modals/Overlays

### None
- No dialogs or modals used
- Delete warning: no confirmation (direct mutation)
- Delete punishment: no confirmation (direct mutation)
- Clear user warnings: no confirmation (direct mutation after validation)
- Potential UX concern: destructive actions have no confirmation step

---

## Design System Compliance

### Color Tokens

| Usage | Actual | Expected | Status |
|-------|--------|----------|--------|
| Card background | `bg-surface` | Not a defined token; should be `bg-surface-low` or `bg-surface-container` | **UNDEFINED TOKEN** |
| Muted text | `text-text-muted` | `text-muted` (#adaaad) | Correct |
| Danger icon | `text-danger` | `danger` (#ff6e84) | Correct |
| Stats cards | via `StatsCard` defaults | `bg-surface-low`, `border-accent` | Correct |

### Typography

| Element | Actual | Expected |
|---------|--------|----------|
| Card heading | `text-lg font-semibold` | Appropriate |
| Section sub-heading | `text-sm font-semibold` | Appropriate for labels |
| IDs and user IDs | `font-mono text-xs` | Correct: technical data in mono |
| Reason column | default text, `truncate` | Appropriate body text |
| Date column | `text-xs text-text-muted` | Appropriate muted metadata |
| Escalation action | `capitalize` | Appropriate for enum display |
| Pagination text | `text-sm text-text-muted` | Appropriate |

### Spacing
- `space-y-8` page spacing: consistent
- `p-6` card padding: consistent
- `mb-4` section margins: consistent
- `gap-3` and `gap-2`: appropriate for form elements
- `my-6` separator: appropriate

### Border/Radius
- Cards use shadcn defaults
- No custom border-radius values

### Hardcoded Values
- `limit: 10` per page (business constant, acceptable)
- `w-64`, `w-24`, `w-32`, `w-16`: fixed widths for form elements

### Design System Rule Violations
1. **`bg-surface` token:** The `Card className="bg-surface p-6"` uses `bg-surface` which is not a defined token in the Obsidian Engine. The design system defines `surface-lowest`, `surface-low`, `surface-container`, `surface-high`, `surface-hover`, `surface-bright`. This should be `bg-surface-container` or `bg-surface-low`.
2. **Separator usage:** The `Separator` component creates a visible horizontal line, which potentially violates the "No-Line Rule" -- however, it separates distinct functional sections (existing rules vs add-rule form), which is an acceptable exception when surface shifts alone would be insufficient.
3. **No dividers in tables:** Tables inherently use row borders via shadcn defaults. This is a standard table pattern and an acceptable exception to the no-divider rule.
