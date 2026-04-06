# Roles Page — UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/roles.tsx`

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle)

  div.grid.grid-cols-1.gap-4.sm:grid-cols-3   (Stats Row)
    StatsCard (Total Panels)
    StatsCard (Deployed)
    StatsCard (Total Roles)

  Tabs (defaultValue="panels")
    TabsList
      TabsTrigger[value="panels"]
      TabsTrigger[value="preview"]

    TabsContent[value="panels"]
      Card.bg-surface.p-6
        div.mb-4.flex.items-center.justify-between
          h3.text-lg.font-semibold (Panel List title)
          Dialog (Create/Edit Panel)
            DialogTrigger > Button (Create Panel, with Icon[add])
            DialogContent.max-h-[90vh].overflow-y-auto.sm:max-w-2xl
              DialogHeader > DialogTitle
              div.space-y-6.pt-4
                [Basic Info] grid.sm:grid-cols-2
                  div > Label + Input (name)
                  div > Label + Select (channel)
                [Type & Mode] grid.sm:grid-cols-2
                  div > Label + Select (type: button/dropdown/reaction)
                  div > Label + Select (mode: toggle/unique/verify)
                [Min/Max Roles] grid.sm:grid-cols-2 (conditional: dropdown type)
                  div > Label + Input[number] (min)
                  div > Label + Input[number] (max)
                Separator
                [Embed Config]
                  h4 + div.space-y-3
                    div > Label + Input (embed title)
                    div > Label + Input (embed description)
                Separator
                [Role Entries]
                  div.mb-3.flex.items-center.justify-between
                    h4 (count)
                    Button[outline,sm] (Add Role, with Icon[add])
                  div.space-y-3
                    div (per role entry)
                      .flex.flex-col.gap-2.rounded-md.border.border-border.p-3.sm:flex-row.sm:items-end
                        div.flex-1 > Label + Select (role)
                        div.flex-1 > Label + Input (label)
                        div.w-24 > Label + Input (emoji)
                        div.flex-1 > Label + Input (description, conditional: dropdown)
                        div.w-28 > Label + Select (button style, conditional: button)
                        Button[ghost,sm] > Icon[delete]
                div.flex.justify-end.gap-2
                  Button[outline] (Cancel)
                  Button (Create/Update)

        p.text-text-muted (loading) | Table (panels) | p.text-text-muted (empty)
        Table
          TableHeader > TableRow > 6x TableHead
          TableBody > TableRow (per panel)
            TableCell.font-medium (name)
            TableCell > Badge[outline] (type)
            TableCell > Badge[secondary] (mode)
            TableCell (role count)
            TableCell > Badge (status: deployed/draft)
            TableCell > div.flex.gap-1
              Button[ghost,sm] (edit) > Icon[edit]
              Button[ghost,sm] (deploy) > Icon[send]
              Button[ghost,sm] (delete) > Icon[delete,text-danger]

    TabsContent[value="preview"]
      Card.bg-surface.p-6
        h3.mb-4.text-lg.font-semibold
        p.mb-4.text-sm.text-text-muted
        div.space-y-6 (per panel, when panels exist) | p.text-text-muted (empty)
          div.rounded-lg.border.border-border.p-4
            div.mb-3.flex.items-center.gap-2
              Badge[outline] (type)
              span.text-sm.font-medium (name)
            div.rounded-md.border-s-4.border-accent.bg-surface-high.p-4  (embed preview)
              p.font-semibold.text-text (title)
              p.mt-1.text-sm.text-text-muted (description)
            [Button preview] div.mt-3.flex.flex-wrap.gap-2
              span (per button: styled with Discord colors)
            [Dropdown preview] div.mt-3
              div (select-like mock with Discord styling)
            [Reaction preview] div.mt-3.flex.gap-2
              span (per emoji reaction mock)
```

---

## Components Inventory

| Component | Source | Variants/Props Used | States |
|-----------|--------|---------------------|--------|
| `PageHeader` | custom | `title`, `subtitle` | static |
| `StatsCard` | custom | `label`, `value` (computed) | loading shows "..." |
| `Tabs` | shadcn/ui | `defaultValue="panels"` | 2 tabs |
| `TabsTrigger` | shadcn/ui | 2 values | active/inactive |
| `Card` | shadcn/ui | `className="bg-surface p-6"` | static |
| `Table` | shadcn/ui | full set | - |
| `Badge` | shadcn/ui | `variant="outline"`, `variant="secondary"`, custom classes | static labels |
| `Dialog` | shadcn/ui | `open`, `onOpenChange` | controlled |
| `DialogTrigger` | shadcn/ui | `asChild` | trigger |
| `DialogContent` | shadcn/ui | `className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"` | scrollable |
| `DialogHeader/Title` | shadcn/ui | default | - |
| `Button` | shadcn/ui | default, `variant="ghost"`, `variant="outline"`, `size="sm"` | disabled on isPending |
| `Input` | shadcn/ui | text, `type="number"` | controlled |
| `Label` | shadcn/ui | `htmlFor` | static |
| `Select` | shadcn/ui | multiple instances, dynamic options | controlled |
| `Separator` | shadcn/ui | default | static |
| `Icon` | custom | `name="add"`, `name="edit"`, `name="send"`, `name="delete"`, `name="expand_more"` | static |

---

## Interaction Behavior

### Panel CRUD

#### Create Panel
- Click "Create Panel" button opens Dialog
- `openCreateDialog()` resets all form state
- Form validates:
  - Name non-empty (toast error if empty)
  - Channel selected (toast error if empty)
  - Roles filtered to those with `roleId` AND `label`
- Embed: serialized to JSON string
- On success: toast + close dialog + reset form
- On error: toast with API error

#### Edit Panel
- Click edit icon on table row calls `openEditDialog(panel)`
- Pre-fills all form fields from panel data
- Embed JSON parsed from `panel.embed` string (try/catch with empty defaults)
- Roles copied from panel (or single empty entry if none)
- Same submit flow but calls `updatePanel.mutate`

#### Delete Panel
- Click delete icon on table row calls `handleDelete(panelId)`
- **No confirmation dialog** -- direct deletion
- Success/error toasts

#### Deploy Panel
- Click send icon on table row calls `handleSend(panelId)`
- Disabled when `sendPanel.isPending` or when panel has 0 roles
- Success: shows `res.message` in toast
- Error: toast

### Role Entry Management
- "Add Role" button appends new empty entry (max 25, toast error at limit)
- Remove button per entry (disabled when only 1 entry remains)
- Each entry has: role select, label input, emoji input
- Conditional fields:
  - Dropdown type: description input per entry
  - Button type: style select per entry (Primary/Secondary/Success/Danger)

### Tab Switching
- 2 tabs: Panels (list + CRUD) and Preview (visual mock)
- No URL persistence

---

## Dynamic States

### Loading State
- Stats cards show "..." while loading
- Panel list shows `p.text-text-muted` with `t("loading")`
- **No PageSkeleton** for initial load

### Empty State
- Panel list: `p.text-text-muted` with `t("empty")`
- Preview tab: `p.text-text-muted` with `t("preview.noPreview")`
- No `EmptyState` component used

### Error State
- All errors shown via `toast.error()` using sonner
- `ApiError.message` extracted when available

### Success State
- All successes shown via `toast.success()` using sonner

---

## RTL Analysis

### Issues Found

1. **`me-1` at line 269 and 405:** `Icon` with `className="me-1"` -- correctly uses logical property.

2. **`ms-2` at line 663:** `Icon` with `className="ms-2"` in dropdown preview -- correctly uses logical property.

3. **`border-s-4` at line 612:** Embed preview uses `border-s-4 border-accent` -- correctly uses logical start border for RTL.

4. **No hardcoded `left`/`right`/`ml`/`mr` found.**

5. **Flex direction in dialog role entries:** `flex-col sm:flex-row` with `sm:items-end` -- direction-safe.

6. **`justify-end` at line 496:** Dialog action buttons aligned to end -- correctly logical.

### RTL Verdict
Fully RTL-safe. All directional properties use logical equivalents.

---

## Responsive Analysis

### Mobile (< 640px)
- Stats grid: `grid-cols-1` (stacked)
- Dialog: full-width with `max-h-[90vh] overflow-y-auto` (scrollable)
- Dialog form grids: `grid-cols-1` (stacked)
- Role entry rows: `flex-col gap-2` (stacked fields)
- Table: 6 columns -- **will overflow on mobile without scroll wrapper**
- Preview buttons: `flex-wrap gap-2` (wraps naturally)

### Tablet/Desktop (>= 640px, `sm:`)
- Stats grid: `sm:grid-cols-3`
- Dialog: `sm:max-w-2xl`
- Form grids: `sm:grid-cols-2`
- Role entry rows: `sm:flex-row sm:items-end`

### Breakpoints Used
- `sm:` only (640px)

### Responsive Gaps
1. **Table overflow on mobile:** The 6-column panel table has no `overflow-x-auto` wrapper. Will overflow viewport on mobile.
2. **Dialog on mobile:** The `max-h-[90vh]` with `overflow-y-auto` is good. The role entry form can get very long with many entries.
3. **Panel action buttons:** `div.flex.gap-1` with 3 icon buttons is compact enough for mobile cells.

---

## Modals/Overlays

### Create/Edit Panel Dialog
- **Trigger:** "Create Panel" button (DialogTrigger) or edit button (programmatic open)
- **Component:** `Dialog` (shadcn/Radix)
- **Size:** `max-h-[90vh] overflow-y-auto sm:max-w-2xl`
- **Scrolling:** `overflow-y-auto` for long content (many role entries)
- **Close behavior:**
  - Cancel button: `setDialogOpen(false)`
  - `onOpenChange` handler (overlay click, Escape key)
- **Content:** Multi-section form with separators
- **Dual mode:** Create or Edit based on `editingPanel` state
- **Title:** Dynamic: "Create Panel" vs "Edit Panel"

### Select Dropdowns
- Channel select: dynamic list from `useChannels`
- Role select: dynamic list from `useRoles`
- Type/Mode/Style selects: static options
- All use Radix Popover positioning

---

## Design System Compliance

### Color Tokens

| Usage | Actual | Expected | Status |
|-------|--------|----------|--------|
| Card background | `bg-surface` | Undefined token | **UNDEFINED TOKEN** |
| Deployed badge | `bg-success/20 text-success` | `success` (#57f287) at 20% bg | Correct usage of semantic token |
| Draft badge | `variant="outline" text-text-muted` | Correct | Correct |
| Type badge | `variant="outline"` | Default outline style | Correct |
| Mode badge | `variant="secondary"` | Default secondary style | Correct |
| Delete icon | `text-danger` | `danger` (#ff6e84) | Correct |
| Embed preview border | `border-accent` | Design system accent token | Correct |
| Embed preview bg | `bg-surface-high` | `surface-high` (#1f1f22) | Correct |
| Embed title | `text-text` | `text` (#f9f5f8) | Correct |
| Embed description | `text-text-muted` | Correct | Correct |
| Role entry border | `border-border` | `border` (#1f1f22) | Correct |

### Discord Preview Colors (Hardcoded)

| Element | Color | Note |
|---------|-------|------|
| Button Primary | `bg-[#5865f2] text-white` | Discord blurple -- intentionally hardcoded for preview fidelity |
| Button Secondary | `bg-[#4f545c] text-white` | Discord grey |
| Button Success | `bg-[#3ba55d] text-white` | Discord green |
| Button Danger | `bg-[#ed4245] text-white` | Discord red |
| Dropdown mock | `border-[#4f545c] bg-[#2f3136] text-[#b9bbbe]` | Discord dark theme colors |
| Reaction mock | `bg-[#2f3136]` | Discord dark theme |
| `text-white` | `#ffffff` | Pure white -- violates "No Pure White" rule in preview context |

These hardcoded Discord colors are **intentionally used** to create an accurate preview of how the panel will look in Discord. This is an acceptable exception to design system token rules.

### Typography

| Element | Actual | Expected |
|---------|--------|----------|
| Panel list heading | `text-lg font-semibold` | Appropriate |
| Panel name in table | `font-medium` | Appropriate |
| Preview panel name | `text-sm font-medium` | Appropriate |
| Embed preview title | `font-semibold text-text` | Appropriate |
| Form labels | shadcn Label default | Appropriate |
| Sub-heading (Embed Section, Roles Count) | `text-sm font-semibold` | Appropriate |

### Spacing
- `space-y-8` page level: consistent
- `space-y-6` dialog sections: appropriate
- `p-6` card padding: consistent
- `p-3` role entry padding: appropriate for compact form
- `gap-1` action buttons: tight, appropriate for icon-only
- `gap-2` badge/name in preview: appropriate
- `gap-4` grid gaps: consistent

### Border/Radius
- Role entry: `rounded-md border border-border p-3`
- Preview container: `rounded-lg border border-border p-4`
- Button preview items: `rounded px-3 py-1.5` (small radius for Discord button feel)
- Reaction items: `rounded bg-[#2f3136] px-2 py-1`

### Hardcoded Values
- `MAX_ROLES = 25` -- Discord API limit, acceptable
- Discord color hex values in preview -- intentional for fidelity
- `max-h-[90vh]` -- arbitrary viewport constraint for dialog
- `style: 2` default for button entries (Discord secondary style)
- Embed JSON parsing with try/catch defaults

### Design System Rule Violations
1. **`bg-surface` undefined token:** Same issue as warnings and welcome pages.
2. **`text-white` in Discord preview:** Technically violates "No Pure White" rule, but acceptable in Discord preview context where fidelity matters.
3. **No `font-label` usage:** Section headings in the dialog and card use plain `font-semibold` without `font-label` (Space Grotesk). The moderation page correctly uses `font-label` for section headings -- inconsistency.
4. **Delete without confirmation:** The `handleDelete` function directly calls `deletePanel.mutate` without any confirmation dialog or prompt. This is a destructive action on a potentially complex panel configuration.
5. **Embed description input:** Uses `Input` (single-line) instead of `Textarea` for the embed description field. Embed descriptions can be multi-line and would benefit from a textarea.
