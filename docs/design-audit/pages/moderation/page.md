# Moderation Page — UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/moderation.tsx`

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle)

  div.grid.grid-cols-1.gap-4.sm:grid-cols-3   (Stats Row)
    StatsCard (Total Cases)
    StatsCard (Active Tempbans, accentColor="border-orange-400")
    StatsCard (Last 24h, accentColor="border-success")

  div.space-y-4   (Cases Section)
    h3.font-label.text-lg.font-semibold   (heading)
    div.flex.flex-wrap.gap-3   (Filters)
      Input[type=text] (user filter)
      Select (action filter: all + 7 action types)
    div.rounded-lg.border.border-border   (Table wrapper)
      Table
        TableHeader > TableRow > 7x TableHead
        TableBody
          TableRow (empty state, colSpan=7) | TableRow (per case)
            TableCell (ID, mono, muted)
            TableCell > span (action, colored)
            TableCell (target, mono)
            TableCell (moderator, mono)
            TableCell (reason, truncated, muted)
            TableCell (date, muted)
            TableCell > div.flex.gap-2
              Button[ghost,icon] (edit)
              Button[ghost,icon] (delete, hover:text-red-400)
    div.flex.items-center.justify-center.gap-4   (Pagination)
      Button[outline,sm] (previous)
      span.text-sm.text-text-muted (page X of Y)
      Button[outline,sm] (next)

  Dialog (Edit Reason)
    DialogContent.max-w-md
      DialogHeader > DialogTitle
      Textarea (reason editor)
      DialogFooter
        Button[outline] (Cancel)
        Button (Save, disabled when isPending)

  div.space-y-4   (Settings Section)
    h3.font-label.text-lg.font-semibold
    div.rounded-lg.border.border-border.bg-surface-low.p-6.glass-edge
      div.space-y-6
        div.flex.items-center.justify-between   (DM on Punishment)
          div > p.font-medium + p.text-sm.text-text-muted
          Switch
        div   (Mod Log Channel)
          p.mb-2.font-medium
          p.mb-3.text-sm.text-text-muted
          Select (channel selector)
```

---

## Components Inventory

| Component | Source | Variants/Props Used | States |
|-----------|--------|---------------------|--------|
| `PageHeader` | custom | `title`, `subtitle` | static |
| `PageSkeleton` | custom | none (full-page loading) | loading state |
| `StatsCard` | custom | `label`, `value`, `accentColor` | computed values |
| `Icon` | custom (Material Symbols) | `name="edit"`, `name="delete"`, `size={16}` | static |
| `Button` | shadcn/ui | `variant="ghost"`, `variant="outline"`, `size="sm"`, `size="icon"`, default | disabled states |
| `Input` | shadcn/ui | `type="text"`, `className="w-auto sm:w-64"` | controlled |
| `Textarea` | shadcn/ui | `maxLength={500}`, `rows={3}` | controlled |
| `Switch` | shadcn/ui | `checked`, `onCheckedChange` | controlled |
| `Select` | shadcn/ui | multiple instances | controlled |
| `SelectTrigger` | shadcn/ui | `className="w-40"`, `className="w-full sm:w-64"` | - |
| `Table` | shadcn/ui | full set (Header/Body/Row/Head/Cell) | - |
| `Dialog` | shadcn/ui | `open`, `onOpenChange` | controlled open/close |
| `DialogContent` | shadcn/ui | `className="max-w-md"` | - |
| `DialogHeader/Title/Footer` | shadcn/ui | default | - |

### Constants

```typescript
const ACTION_KEYS = ["ban", "tempban", "kick", "timeout", "softban", "warn", "note"] as const;

const ACTION_COLORS: Record<string, string> = {
  ban: "text-red-400",
  tempban: "text-orange-400",
  kick: "text-yellow-400",
  timeout: "text-amber-400",
  softban: "text-orange-300",
  warn: "text-yellow-300",
  note: "text-text-muted",
};
```

---

## Interaction Behavior

### Filters
- **User filter:** `Input` updates `userFilter` state and resets `page` to 1
- **Action filter:** `Select` with "all" option mapping to empty string, resets `page` to 1
- Both filters are passed to `useModCases` query hook

### Case Table Actions
- **Edit button:** `Button[ghost, icon]` calls `handleEditStart(modCase)` which:
  - Sets `editingCase` to the case object
  - Sets `editReason` to existing reason
  - Opens the Dialog
- **Delete button:** `Button[ghost, icon]` calls `handleDelete(caseId)` which:
  - Uses browser `confirm()` dialog -- **not a shadcn Dialog**
  - On confirm: `deleteMutation.mutate(caseId)`
  - No toast feedback for success/error

### Edit Dialog
- **Open:** Controlled by `!!editingCase` boolean
- **Close:** `onOpenChange` sets `editingCase` to `null`, or Cancel button
- **Save:** Calls `updateMutation.mutate({ caseId, reason })`, on success closes dialog
- **Disabled state:** Save button disabled while `updateMutation.isPending`
- **Text:** Button shows "Saving..." text when pending

### Settings
- **DM on Punishment:** `Switch` directly calls `settingsMutation.mutate({ dmOnPunishment: checked })`
- **Mod Log Channel:** `Select` with "none" option, calls `settingsMutation.mutate({ modLogChannelId: value === "none" ? null : value })`
- No success/error toasts for settings mutations

### Pagination
- Center-aligned: `justify-center gap-4`
- Previous/Next buttons disabled at bounds
- Page indicator between buttons

---

## Dynamic States

### Loading State
- **Full page:** Returns `<PageSkeleton />` when `casesLoading || settingsLoading`
- This means the entire page (including header) is replaced with skeleton
- No partial loading states for individual sections

### Empty State
- **Cases table:** `TableRow` with single `TableCell[colSpan=7]` containing `t("table.noCases")` centered and muted
- No `EmptyState` component used
- No empty illustration or action prompt

### Error State
- **Delete:** Uses browser `confirm()` only; no error handling visible (no `.onError` callback)
- **Edit:** No error handling visible on `updateMutation.mutate`
- **Settings:** No error handling visible on `settingsMutation.mutate`
- **Missing error feedback:** Unlike warnings page, moderation page does not use `toast.error()` for mutation failures

### Success State
- No toast.success() calls anywhere
- Edit dialog closes on success (implicit success indicator)

---

## RTL Analysis

### Issues Found

1. **`hover:text-red-400`** on delete button (line 229): Uses raw Tailwind color, not a directional concern but noted.

2. **`max-w-48 truncate`** on reason cell: Direction-safe.

3. **`justify-center gap-4`** for pagination: Direction-safe, reverses in RTL.

4. **`flex-wrap gap-3`** for filters: Direction-safe.

5. **`w-auto sm:w-64`** on user filter input: Direction-neutral.

6. **No hardcoded `left`/`right`/`ml`/`mr` found.**

### RTL Verdict
Fully RTL-safe. No directional issues detected.

---

## Responsive Analysis

### Mobile (< 640px)
- Stats grid: `grid-cols-1` (stacked)
- User filter: `w-auto` (full width)
- Action filter: `w-40` (fixed width, may be tight for translated text)
- **Table: 7 columns with no horizontal scroll wrapper** -- will overflow on mobile
- Pagination: centered, buttons + text inline

### Tablet/Desktop (>= 640px, `sm:`)
- Stats grid: `sm:grid-cols-3`
- User filter: `sm:w-64`
- Mod log channel select: `sm:w-64`

### Breakpoints Used
- `sm:` only (640px)

### Responsive Gaps
1. **Table overflow on mobile:** The 7-column cases table will definitely overflow on mobile. Needs `overflow-x-auto` wrapper or a card-based layout for mobile.
2. **Action filter width:** `w-40` (160px) may be too narrow for longer translated action names.
3. **Settings section:** The `flex items-center justify-between` layout for DM on Punishment works well on all sizes. The channel select `w-full sm:w-64` is appropriately responsive.

---

## Modals/Overlays

### Edit Reason Dialog
- **Trigger:** Click edit icon button on a case row
- **Component:** `Dialog` (shadcn/Radix)
- **Positioning:** Centered overlay (Radix default)
- **Size:** `max-w-md`
- **Close behavior:**
  - Click Cancel button
  - `onOpenChange` handler (overlay click, Escape key)
  - Sets `editingCase` to `null`
- **Content:**
  - `DialogTitle` with case ID
  - `Textarea` with maxLength=500, 3 rows
  - Cancel + Save buttons in `DialogFooter`

### Browser Confirm Dialog
- **Trigger:** Click delete icon button on a case row
- **Type:** Native `window.confirm()` -- not styled, breaks the design system
- **Recommendation:** Replace with a shadcn `AlertDialog` for consistency

### Select Dropdowns
- Action filter: `SelectContent` with 8 items
- Mod log channel: `SelectContent` with dynamic channel list
- Both use Radix Popover positioning (auto)

---

## Design System Compliance

### Color Tokens

| Usage | Actual | Expected | Status |
|-------|--------|----------|--------|
| Action colors | `text-red-400`, `text-orange-400`, `text-yellow-400`, `text-amber-400`, `text-orange-300`, `text-yellow-300` | Should use semantic tokens (`text-danger`, `text-warning`) or custom design system tokens | **RAW TAILWIND COLORS** |
| Note action | `text-text-muted` | Correct token | Correct |
| Delete hover | `hover:text-red-400` | Should be `hover:text-danger` | **RAW TAILWIND COLOR** |
| Stats accent (tempbans) | `border-orange-400` | Not a design system token; should use a semantic color | **RAW TAILWIND COLOR** |
| Stats accent (24h) | `border-success` | Correct semantic token | Correct |
| Table wrapper border | `border-border` | Correct token | Correct |
| Settings background | `bg-surface-low` | Correct token | Correct |
| Glass edge | `glass-edge` class | Correct design system utility | Correct |

### Typography

| Element | Actual | Expected |
|---------|--------|----------|
| Section heading | `font-label text-lg font-semibold` | Correct: uses `font-label` (Space Grotesk) |
| Case ID | `font-mono text-text-muted` | Correct: technical data in mono |
| Target/Moderator IDs | `font-mono text-xs` | Correct: technical data in mono |
| Action text | `font-medium` + color class | Appropriate |
| Reason | `max-w-48 truncate text-text-muted` | Appropriate |

### Spacing
- `space-y-8` page level: consistent
- `space-y-4` section level: consistent
- `space-y-6` settings: consistent
- `gap-3` filters: appropriate
- `gap-2` action buttons: appropriate
- `gap-4` pagination: appropriate

### Border/Radius
- Table wrapper: `rounded-lg border border-border` -- appropriate
- Settings panel: `rounded-lg border border-border bg-surface-low p-6 glass-edge` -- fully compliant

### Hardcoded Values
- `ACTION_COLORS` map: Uses raw Tailwind color classes (`text-red-400`, `text-orange-400`, etc.) instead of design system semantic tokens
- `max-w-48`: Fixed width for reason column truncation
- `maxLength={500}` on Textarea: Business constraint

### Design System Rule Violations
1. **Raw Tailwind colors in `ACTION_COLORS`:** The `text-red-400`, `text-orange-400`, `text-yellow-400`, `text-amber-400`, `text-orange-300`, `text-yellow-300` values bypass the Obsidian Engine semantic color system. These should map to design system tokens (e.g., `ban` -> `text-danger`, `warn` -> `text-warning`).
2. **`hover:text-red-400`** on delete button: Should use `hover:text-danger` for consistency.
3. **`border-orange-400`** on StatsCard: Should use a semantic token or a defined design system accent.
4. **Browser `confirm()` for deletion:** Breaks the design language entirely -- uses OS-native dialog instead of Obsidian Engine styled AlertDialog.
5. **No error/success toasts:** Unlike warnings page, moderation mutations have no user feedback via toasts, creating an inconsistent UX pattern across pages.
