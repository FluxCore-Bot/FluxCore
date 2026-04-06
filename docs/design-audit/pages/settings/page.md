# Settings Page - UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/settings.tsx`  
**Component:** `SettingsPage`  
**i18n namespace:** `settings`

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle)
  SettingsForm
    Card.p-6                                              (Action System Settings)
      h3 (section title)
      [Conditional: error]
        Alert variant="destructive"
      form.space-y-5
        div (Max Rules -- number input)
        div (Log Channel -- select)
        div.flex (Global Enable -- switch + label)
        Button (Save)
    Card.mt-6.p-6.glass-panel                             (Notification Preferences)
      h3 (section title)
      div.space-y-4
        div.flex (Rule Triggered -- switch + label)
        div.flex (Error Alerts -- switch + label)
        div.flex (Success Reports -- switch + label)
    Card.mt-6.border-danger/20.p-6                        (Danger Zone)
      h3.text-danger (section title)
      p.text-text-muted (description)
      Button variant="destructive" (Delete All Rules)
```

### Component Tree

```
SettingsPage
  PageHeader (title, subtitle)
  SettingsForm
    Card (Action System)
      Alert (error -- conditional)
      Label + Input (Max Rules)
      Label + Select (Log Channel)
      Switch + Label (Global Enable)
      Button (Save)
    Card (Notifications)
      Switch + Label (Rule Triggered)
      Switch + Label (Error Alerts)
      Switch + Label (Success Reports)
    Card (Danger Zone)
      Button (Delete All Rules -- destructive)
    PageSkeleton (loading)
```

---

## Components Inventory

### PageHeader
- **Props:** `title={t("title")}`, `subtitle={t("subtitle")}`
- **No label or actions** -- simplest PageHeader usage.

### Card - Action System Settings
- **Class:** `p-6`
- **Heading:** `text-lg font-semibold` with `t("actionSystem.title")`
- **Contains the main settings form.**

### Max Rules Input
- **Type:** `number`, min=1, max=100
- **Label:** `t("actionSystem.maxRules")` with `htmlFor="maxRules"`
- **Default value:** 25 (initial state), synced from server via `useEffect`
- **Validation:** `maxRules < 1 || maxRules > 100` checked in `handleSubmit` (line 54)

### Log Channel Select
- **Label:** `t("actionSystem.logChannel")`
- **Source data:** `textChannels` -- channels with type 0
- **Special value:** `"none"` maps to `null`
- **Display format:** `# {c.name}` (with hash prefix)
- **Placeholder:** `t("actionSystem.noLogChannel")`

### Global Enable Switch
- **Layout:** `flex items-center gap-3`
- **Switch:** `checked={globalEnabled}`, `onCheckedChange={setGlobalEnabled}`
- **Label:** `className="mb-0 text-sm"` with `t("actionSystem.globalEnable")`

### Save Button
- **Type:** `submit`
- **Disabled when:** `updateSettings.isPending`
- **Text:** Toggles between `t("actionSystem.save")` and `t("actionSystem.saving")`

### Card - Notification Preferences
- **Class:** `mt-6 p-6 glass-panel`
- **Note:** Uses `glass-panel` class (not `glass-edge` like other cards). This is potentially a different visual treatment.
- **3 switches:** Rule Triggered (default on), Error Alerts (default on), Success Reports (default off)
- **State is local only** -- `notifyRuleTriggered`, `notifyErrors`, `notifySuccess` are `useState` with no API persistence.
- **No save button** for this section -- **changes are lost on page reload**.

### Card - Danger Zone
- **Class:** `mt-6 border border-danger/20 p-6`
- **Heading:** `text-lg font-semibold text-danger` with `t("dangerZone.title")`
- **Description:** `text-sm text-text-muted` with `t("dangerZone.description")`
- **Button:** `variant="destructive"` with `t("dangerZone.deleteAllRules")`
- **Click handler:** `window.confirm()` dialog, then `toast.info(t("dangerZone.notImplemented"))` -- **feature is a stub**.

### Alert (Error)
- **Shown when:** `error` is truthy (line 72-74)
- **Variant:** `destructive`
- **Class:** `mb-4`

### PageSkeleton (Loading)
- **Condition:** `isLoading` (line 46)
- **Generic skeleton.**

---

## Interaction Behavior

### Form Submission
- **Handler:** `handleSubmit` (lines 50-65)
- **Validation:** Manual check for `maxRules` range (1-100), sets error string if invalid.
- **API call:** `updateSettings.mutateAsync({ maxRules, globalEnabled, logChannelId })`
- **Success:** `toast.success(t("actionSystem.saved"))`
- **Error:** `ApiError` message or fallback `t("actionSystem.maxRulesError")`

### State Synchronization
- **`useEffect` on line 38-44:** Syncs local state from server data when `settings` changes.
- **Issue:** No dirty tracking -- user changes are overwritten if settings refetch occurs mid-edit.

### Notification Switches
- **Local state only** -- no API calls. These switches toggle `useState` values that are not persisted anywhere.
- **No save button** for the notification section.
- **This appears to be an incomplete feature.**

### Danger Zone
- **Uses `window.confirm()`** -- native browser dialog, not the custom `ConfirmDialog` component used elsewhere.
- **Inconsistent with rules page** which uses shadcn Dialog.
- **Action is stubbed:** Shows `toast.info("Not implemented")` after confirmation.

### Hover/Focus States
- **All interactive elements** use shadcn defaults (Button, Switch, Select, Input).
- **No custom hover states** defined in this page.

---

## Dynamic States

### Loading State
- **Condition:** `isLoading` from `useSettings` (line 46)
- **Renders:** `<PageSkeleton />`

### Error State
- **Single error string** displayed as `<Alert variant="destructive">` above the form.
- **Sources:** Validation error (max rules range) or API error.
- **Cleared:** On each `handleSubmit` call (line 52: `setError("")`).

### Success State
- **Toast:** `toast.success(t("actionSystem.saved"))` on successful update.
- **No visual change** in the form itself.

### Pending State
- **Save button:** Disabled during mutation, text changes to "Saving..."
- **No other pending indicators.**

### Empty State
- **No explicit empty state** -- the form always renders with default values.
- **Channels list:** If no text channels exist, the Select will have only the "None" option.

---

## RTL Analysis

### Correct RTL Patterns
- **Switch + Label layout:** `flex items-center gap-3` -- flex handles RTL naturally.
- **All Labels** use semantic `<Label>` element -- direction follows document.

### Potential RTL Issues
1. **Channel prefix `# ` (line 103):** `# {c.name}` -- the hash is a LTR symbol. In RTL the hash would appear on the right side of the name, which may look odd but is functionally correct.
2. **`mb-0` on switch labels (lines 114, 134, 139, 144):** Using `mb-0` to override Label's default margin. This is a physical property but only affects vertical spacing, so no RTL issue.
3. **No `start`/`end` logical properties** used -- but none are needed since layout is vertical stack + horizontal flex.

---

## Responsive Analysis

### Mobile (< 640px)
- **PageHeader:** Column layout (default).
- **Cards:** Full width, stacked with `mt-6` spacing between them.
- **Form fields:** Full width, stacked vertically.
- **No horizontal form layouts** -- everything stacks naturally.

### Tablet / Desktop
- **No responsive breakpoints** in the SettingsForm component.
- **Cards stretch to full container width** at all sizes.
- **No max-width constraints** on form or cards.
- **Inputs and selects** take full width of their container.

### Missing Responsive Considerations
- **Cards could use a grid layout** on larger screens (e.g., Action System and Notifications side by side).
- **Form inputs have no max-width** -- on wide screens, a number input stretching 100% looks unusual.
- **Switch layouts** remain single-column even when there is ample horizontal space.

---

## Modals/Overlays

### Native Browser Confirm
- **`window.confirm()`** (line 162) -- used for Danger Zone delete confirmation.
- **Not using ConfirmDialog** -- inconsistent with other pages.
- **No shadcn Dialog** used anywhere on this page.

### Select Dropdowns
- 1 Select dropdown (Log Channel) using shadcn Select.
- Popover-based positioning via Radix UI.

### Toast Notifications
- `toast.success()` for successful save.
- `toast.info()` for the "not implemented" danger zone action.
- Via sonner.

---

## Design System Compliance

### Color Tokens

| Usage | Value Used | Status |
|-------|-----------|--------|
| Card backgrounds | Via shadcn `Card` | Compliant |
| Notification card | `glass-panel` class | **Different class** -- not `glass-edge` used elsewhere |
| Danger zone border | `border border-danger/20` | Compliant |
| Danger zone heading | `text-danger` | Compliant |
| Error alert | Via shadcn `Alert variant="destructive"` | Compliant |
| Muted text | `text-text-muted` | Compliant |

### Typography

| Usage | Classes | Status |
|-------|---------|--------|
| Section headings | `text-lg font-semibold` | Compliant but missing `font-display` (used in logs page) |
| Switch labels | `text-sm` via Label | Compliant |
| Danger description | `text-sm text-text-muted` | Compliant |
| Input labels | Via shadcn `Label` | Compliant |

### Spacing
- Page: `space-y-8` (32px)
- Cards: `p-6` (24px) with `mt-6` (24px) between them
- Form: `space-y-5` (20px)
- Switch groups: `space-y-4` (16px)
- Switch rows: `gap-3` (12px)
- Error alert: `mb-4` (16px bottom margin)
- Heading: `mb-6` (24px) below heading, `mb-2` (8px) for danger zone
- Danger description: `mb-4` (16px)

### Border/Radius
- Cards: shadcn default (rounded-lg with border)
- Danger card: Additional `border-danger/20` border color
- Form elements: shadcn defaults

### Inconsistencies and Issues

1. **`glass-panel` vs `glass-edge`:** The Notification card uses `glass-panel` while most other surfaces use `glass-edge`. This may be intentional for a different visual effect or may be inconsistent.

2. **Cards use `mt-6` instead of parent spacing:** The three cards are fragments (`<>...</>`) with manual `mt-6` margins instead of being wrapped in a `space-y-6` container. This is fragile -- the first card has no top margin, relying on the parent `space-y-8`.

3. **`window.confirm()` instead of `ConfirmDialog`:** Every other destructive action in the dashboard uses the custom ConfirmDialog component. The settings page breaks this pattern.

4. **Notification switches are not persisted:** The three notification preference switches use local `useState` with no API integration. This is either an incomplete feature or a UI mockup that was never connected.

5. **No `font-display`** on section headings -- the EventLogConfig component uses `font-display` (Space Grotesk) for its headings, but SettingsForm does not. Inconsistent heading treatment.

6. **Delete All Rules is a stub:** The button shows a toast saying "not implemented" -- this should either be implemented or removed from the UI.

### Hardcoded Strings (Not Translated)
- All visible strings in SettingsForm use `t()` translations -- no hardcoded English strings detected. This is **fully compliant** with i18n expectations.
- Exception: The `"none"` value string used as Select value is not user-visible.
