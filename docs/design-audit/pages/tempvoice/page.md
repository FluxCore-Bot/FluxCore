# TempVoice Page - UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/tempvoice.tsx`  
**Component:** `TempVoicePage`  
**i18n namespace:** `tempvoice`

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (label, title, subtitle)
  TempVoiceForm
    Card.p-6
      div.mb-6.flex.items-center.justify-between          (Header: "Configured Hubs" + Add button)
      [Conditional: error && !showForm]
        Alert variant="destructive"
      [Conditional: configs.length > 0]
        div.mb-6.space-y-3                                  (Config list)
          div (per config: hub name, template, edit/delete buttons)
      [Conditional: configs.length === 0 && !showForm]
        EmptyState (icon, title, description, action button)
      [Conditional: showForm]
        form.rounded-lg.bg-surface-high.p-5.space-y-5     (Add/Edit form)
          h4 (form title)
          [Conditional: error]
            Alert variant="destructive"
          div (Hub Channel select -- required)
          div (Category select -- optional)
          div (Name Template input)
          div.flex (Save + Cancel buttons)
```

### Component Tree

```
TempVoicePage
  PageHeader (label, title, subtitle)
  TempVoiceForm
    Card
      Button ("Add Hub" -- conditional)
      Icon (add)
      Alert (error -- conditional)
      [Config cards]
        Button (Edit -- secondary, sm)
        Button (Delete -- ghost, sm, danger)
      EmptyState (conditional)
        Icon (settings_voice)
        Button ("Add first")
          Icon (add)
      [Form -- conditional]
        Alert (error -- conditional)
        Label + Select (Hub Channel)
        Label + Select (Category)
        Label + Input (Name Template)
        Button (Save)
        Button (Cancel -- ghost)
    PageSkeleton (loading)
```

---

## Components Inventory

### PageHeader
- **Props:** `label={t("label")}`, `title={t("title")}`, `subtitle={t("subtitle")}`
- **Notable:** This is the only page that passes the `label` prop, which renders as `section-label text-accent` above the title.
- **No actions slot** used.

### Card (Wrapper)
- **Source:** shadcn `components/ui/card`
- **Class:** `p-6`
- **Contains all form content** -- single card wrapping the entire feature.

### Config List Cards
- **Per-config layout:** `flex flex-col gap-3 rounded-md bg-surface-high px-4 py-3 sm:flex-row sm:items-center sm:justify-between`
- **Content:**
  - Hub channel name: `text-sm font-medium` prefixed with `#`
  - Template + optional category: `text-xs text-text-muted`
- **Actions:**
  - Edit button: `variant="secondary" size="sm"` with `t("form.edit")` label
  - Delete button: `variant="ghost" size="sm" className="text-danger hover:text-danger"` with `t("form.delete")` label
  - Both disabled when `isPending`

### EmptyState
- **Source:** `components/EmptyState.tsx` (lines 11-22)
- **Props:** `icon="settings_voice"`, `title=t("empty.noConfigs")`, `description=t("empty.noConfigsDesc")`, `action=<Button>`
- **Layout:** Centered column, `rounded-lg bg-surface-low p-12 text-center glass-edge`
- **Icon container:** `h-12 w-12 rounded-full bg-surface-high`
- **Action button:** "Add first" with add icon

### Form Fields

#### Hub Channel Select (Required)
- **Label:** `t("form.hubChannel")` with `<span className="text-danger">*</span>` required indicator
- **Source data:** `availableVoiceChannels` -- voice channels (type 2) filtered to exclude already-used hubs (except current edit target)
- **Placeholder:** `t("form.selectHub")`
- **No validation error display** inline -- errors go to the shared `error` state.

#### Category Select (Optional)
- **Label:** `t("form.category")` -- no required indicator
- **Source data:** `categories` -- category channels (type 4)
- **Special value:** `"none"` maps to `null` in state
- **Placeholder:** `t("form.sameAsHub")`

#### Name Template Input
- **Label:** `t("form.nameTemplate")`
- **Type:** text, `maxLength={100}`
- **Default value:** `"{user}'s Channel"`
- **Help text:** `Use {user} for the member's display name` (line 257) -- note: `{"{user}"}` in JSX
- **Placeholder:** `t("form.defaultNameTemplate")`

### Alert (Error)
- **Two locations:**
  1. Above config list: shown when `error && !showForm` (line 146-148)
  2. Inside form: shown when `error` (line 204-206)
- **Variant:** `destructive`

### Buttons
- **Add Hub:** `<Button onClick={openCreateForm}>` with add icon, shown when `!showForm && configs.length < MAX_CONFIGS`
- **Save:** `type="submit"` default variant, disabled when `isPending`, label toggles to `t("form.saving")`
- **Cancel:** `type="button" variant="ghost"`, calls `closeForm`

### PageSkeleton (Loading)
- **Condition:** `isLoading` (line 48)
- **Generic skeleton** -- same as other pages.

---

## Interaction Behavior

### CRUD Operations

| Action | Handler | Mutation | Toast |
|--------|---------|----------|-------|
| Create config | `handleSubmit` (editingId === null) | `useCreateTempVoice` | `t("toast.created")` |
| Update config | `handleSubmit` (editingId !== null) | `useUpdateTempVoice` | `t("toast.updated")` |
| Delete config | `handleDelete` | `useDeleteTempVoice` | `t("toast.removed")` |

### Form Validation
- **Schema:** `TempVoiceFormSchema.safeParse({ hubChannelId, categoryId, nameTemplate })` (line 91-92)
- **Error display:** First Zod error message set to `error` state, shown in `<Alert>`.
- **API errors:** Caught as `ApiError`, message displayed in error state.
- **No per-field validation** -- single error alert.

### Form Flow
1. **Open create:** `openCreateForm()` -- resets form, sets `editingId=null`, shows form.
2. **Open edit:** `openEditForm(cfg)` -- populates form fields from config, sets `editingId`.
3. **Close:** `closeForm()` -- hides form, resets all fields.
4. **Auto-close on delete:** If deleted config is being edited, calls `closeForm()`.

### Button States
- **Add Hub:** Hidden when `showForm` is true or `configs.length >= MAX_CONFIGS` (10).
- **Edit/Delete:** Disabled when any mutation is pending (`isPending`).
- **Save:** Disabled when any mutation is pending.

### Hover States
- **Edit button:** Secondary variant hover (shadcn default).
- **Delete button:** `text-danger hover:text-danger` -- maintains danger color on hover.
- **No hover on config cards** themselves -- only on their buttons.

---

## Dynamic States

### Loading State
- **Condition:** `isLoading` from `useTempVoiceConfigs` (line 48)
- **Renders:** `<PageSkeleton />`

### Empty State
- **Condition:** `configs.length === 0 && !showForm` (line 181)
- **Renders:** `<EmptyState>` with settings_voice icon, translated title/description, and "Add first" CTA button.

### Error State
- **Location 1:** Above config list when form is closed -- `error && !showForm`
- **Location 2:** Inside form -- `error` (always shown when set)
- **Source:** Zod validation errors or API errors.
- **Note:** Error state is shared between list-level and form-level. The `error` is cleared on form open (`resetForm`) and on submit start.

### Success State
- **Toast notifications** via sonner: created, updated, removed.
- **Form auto-closes** on successful submit.

### Pending State
- **No skeleton or spinner** during mutations.
- **Buttons disabled** -- `isPending` computed from `createConfig.isPending || updateConfig.isPending || deleteConfig.isPending`.
- **Save button text:** Changes to `t("form.saving")` when pending.

---

## RTL Analysis

### Correct RTL Patterns
- No explicit RTL handling visible -- the page relies on browser defaults and shadcn components.
- Form labels and inputs stack vertically, which naturally works in RTL.

### Potential RTL Issues
1. **Config card layout (line 156-157):** `flex flex-col sm:flex-row` -- on `sm:` the hub info is on the left and buttons on the right via `sm:justify-between`. In RTL, flexbox `justify-between` naturally reverses. **No issue.**
2. **Channel name prefix `#` (line 160):** `Hub: #{getChannelName(...)}` -- the `#` is a LTR character. In RTL context it should still appear before the channel name. **Minor concern** but generally acceptable.
3. **Template help text `{user}` (line 257):** The curly-brace syntax is code-like and direction-neutral. **No issue.**
4. **No `start`/`end` logical properties** used in the form -- all spacing is vertical or via flex, which is fine.
5. **Button order in form (line 261-268):** Save then Cancel. In RTL, flex-row reversal means Cancel appears first (on the right in RTL). This is actually the conventional RTL order. **No issue.**

---

## Responsive Analysis

### Mobile (< 640px)
- **Config cards:** `flex-col gap-3` -- info stacks above buttons.
- **Buttons in config cards:** Full-width stacked (due to flex-col).
- **Form:** Full-width within Card padding.
- **Select triggers:** Full-width (no explicit width constraint).
- **PageHeader:** Column layout, label above title.

### Tablet (640px+)
- **Config cards:** `sm:flex-row sm:items-center sm:justify-between` -- info left, buttons right.
- **Otherwise identical to mobile** -- no further breakpoints.

### Desktop (>= 1024px)
- **No lg: or xl: breakpoints** -- layout stays the same as tablet.
- **Form has no max-width** -- can stretch very wide on large screens. This may look sparse.
- **Select dropdowns** have no responsive width constraints.

### Missing Responsive Considerations
- **No max-width on the form** -- at very wide viewports, inputs stretch across the full content area.
- **No grid layout for form fields** -- everything stacks vertically regardless of screen size.
- **Config list items don't use a grid** -- could benefit from a more structured layout on desktop.

---

## Modals/Overlays

### None
- This page has **no modals, dialogs, or overlays**.
- Delete action is **immediate** (no confirmation dialog) -- clicking delete directly calls `handleDelete`.
- **This is a UX concern** -- accidental deletion is possible. Other pages (rules) use `ConfirmDialog` for destructive actions.

### Select Dropdowns
- 3 Select dropdowns (hub channel, category, name template).
- All use shadcn `Select` which renders a popover-based dropdown.
- Positioning handled by Radix UI internals.

---

## Design System Compliance

### Color Tokens

| Usage | Value Used | Status |
|-------|-----------|--------|
| Card background | Via shadcn `Card` component | Compliant |
| Config card bg | `bg-surface-high` | Compliant |
| Form bg | `bg-surface-high` | Compliant |
| Delete button | `text-danger hover:text-danger` | Compliant |
| Required indicator | `text-danger` | Compliant |
| Help text | `text-text-muted` | Compliant |
| Empty state bg | `bg-surface-low` (via EmptyState) | Compliant |
| Empty state icon bg | `bg-surface-high` | Compliant |
| Error alert | Via shadcn `Alert variant="destructive"` | Compliant |

### Typography

| Usage | Classes | Status |
|-------|---------|--------|
| Section header | `text-lg font-semibold` | Compliant (no `font-display` used) |
| Config hub name | `text-sm font-medium` | Compliant |
| Config details | `text-xs text-text-muted` | Compliant |
| Form section title | `text-sm font-semibold` | Compliant |
| Help text | `text-xs text-text-muted` | Compliant |
| Label | Via shadcn `Label` | Compliant |

### Spacing
- Page: `space-y-8` (32px)
- Card padding: `p-6` (24px)
- Config list: `space-y-3` (12px)
- Form: `space-y-5` (20px)
- Config card: `px-4 py-3` (16px/12px)
- Form section: `p-5` (20px)

### Border/Radius
- Card: shadcn default (rounded-lg with border)
- Config cards: `rounded-md` (smaller radius)
- Form section: `rounded-lg`
- EmptyState: `rounded-lg` with `glass-edge`

### Hardcoded Values
- **No hardcoded colors** -- all use design system tokens or shadcn defaults.
- **No hardcoded font sizes** -- all use Tailwind scale.

### Hardcoded Strings (Not Translated)
- `"Configured Hubs"` (line 138) -- heading text
- `"Add Hub"` (line 141) -- button text
- `"Hub: #"` prefix (line 160) -- config display
- `"Template: "` prefix (line 162) -- config display
- `" -- Category: #"` (line 164) -- config display
- `"Use {user} for the member's display name"` (line 257) -- help text

### Missing UX Patterns
1. **No confirmation dialog for delete** -- unlike rules page which uses `ConfirmDialog`.
2. **MAX_CONFIGS = 10** limit -- no visual indicator showing how many slots remain. The "Add Hub" button simply disappears at the limit.
3. **No visual feedback during mutations** beyond button disabling -- no spinner or skeleton.
4. **Form error is a shared state** -- opening a new form or switching from list to form clears the error, but there could be race conditions if multiple quick actions occur.
