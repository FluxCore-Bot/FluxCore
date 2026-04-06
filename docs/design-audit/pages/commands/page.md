# Custom Commands Page - UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/commands.tsx`
**Component:** `CommandsPage`
**Namespace:** `commands` (i18n)

---

## Structure

### Full Layout Hierarchy

```
RootLayout (__root.tsx)
  -> nav (top bar, h-14)
  -> GuildLayout ($guildId.tsx)
       -> Sidebar (fixed, w-60)
       -> main (lg:ms-60)
            -> div.mx-auto.max-w-6xl.p-4.sm:p-6.lg:p-8
                 -> CommandsPage
```

### Component Tree

```
div.space-y-8
  PageHeader (title, subtitle)

  div.grid.grid-cols-1.sm:grid-cols-3.gap-4              [Stats Row]
    StatsCard (totalCommands)
    StatsCard (enabled, valueClassName="text-success")
    StatsCard (limit)

  Tabs (defaultValue="commands")
    TabsList
      TabsTrigger ("commands")
      TabsTrigger ("variables")

    TabsContent ("commands")
      Card.bg-surface.p-6
        div.mb-4.flex.items-center.justify-between        [Header + Create Button]
          h3.text-lg.font-semibold
          Dialog (create/edit)
            DialogTrigger > Button
              Icon (add) + label
            DialogContent.max-h-[90vh].overflow-y-auto.sm:max-w-2xl
              DialogHeader > DialogTitle
              div.space-y-6.pt-4
                [Trigger Config]
                  div.grid.grid-cols-1.sm:grid-cols-2.gap-4
                    div (Label + Input - name/trigger text)
                    div (Label + Select - trigger type)
                Separator
                [Response Config]
                  div.mb-3.flex.items-center.gap-3
                    h4.text-sm.font-semibold
                    Select.w-32 (text/embed)
                  [text: Label + Textarea rows=4]
                  [embed: div.space-y-3]
                    Input (title)
                    Textarea (description) rows=3
                    div.grid.grid-cols-2.gap-4
                      Input[type=color].h-10.w-full
                      Input (footer)
                Separator
                [Actions Section]
                  div.mb-3.flex.items-center.justify-between
                    h4.text-sm.font-semibold
                    Button (add action, outline, sm)
                  [Actions list: div.space-y-3]
                    div.flex.items-end.gap-2.rounded-md.border.border-border.p-3
                      div.w-36 (Select - type: addRole/removeRole)
                      div.flex-1 (Select - role)
                      Button (delete, ghost, sm)
                  [No actions: p.text-sm.text-text-muted]
                Separator
                [Options Section]
                  h4.mb-3.text-sm.font-semibold
                  div.space-y-4
                    div.grid.grid-cols-1.sm:grid-cols-2
                      Input (cooldown, type=number)
                    div.flex.items-center.justify-between.rounded-md.border.border-border.p-3
                      Switch (enabled)
                    div... (delete trigger switch)
                    div... (DM response switch)
                Separator
                [Restrictions Section]
                  h4.mb-3.text-sm.font-semibold
                  div.space-y-3
                    div (Select + Badge chips for allowed channels)
                    div (Select + Badge chips for allowed roles)
                div.flex.justify-end.gap-2               [Dialog Actions]
                  Button (cancel, outline)
                  Button (submit)

        [Loading: p.text-text-muted]
        [Data: Table]
          TableHeader
            TableRow: Name, Trigger, Response, Cooldown, Status, Actions(w-32)
          TableBody
            TableRow per command
              TableCell (font-mono name)
              TableCell (Badge outline - trigger type)
              TableCell (Badge secondary - response type)
              TableCell (cooldown or "--")
              TableCell (Badge - active/disabled)
              TableCell (div.flex.gap-1: toggle, edit, delete buttons)
        [Empty: p.text-text-muted]

    TabsContent ("variables")
      Card.bg-surface.p-6
        h3.mb-4.text-lg.font-semibold
        p.mb-4.text-sm.text-text-muted
        Table
          TableHeader: Variable, Description
          TableBody
            TableRow per variable
              TableCell.font-mono.text-accent
              TableCell.text-text-muted
```

### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Create Command button | primary button | Opens dialog in create mode |
| Edit button (ghost) | icon button | Opens dialog in edit mode, populates form |
| Toggle button (ghost) | icon button | Toggles command enabled/disabled |
| Delete button (ghost) | icon button | Deletes command directly (no confirmation) |
| Dialog form - all inputs | form fields | Various local state updates |
| Add Action button | outline button | Adds action row (max 5) |
| Remove Action button | ghost button | Removes action row |
| Channel/Role chip badges | clickable badges | Removes channel/role from allowed list |
| Cancel button | outline button | Closes dialog |
| Submit button | primary button | Creates or updates command |

---

## Components Inventory

### shadcn/ui Components Used

| Component | Import Path | Variants/Props Used |
|-----------|------------|---------------------|
| Button | `ui/button` | Default, `variant="ghost"`, `variant="outline"`, `size="sm"` |
| Input | `ui/input` | Default, `type="number"`, `type="color"` |
| Label | `ui/label` | Default |
| Card | `ui/card` | Default with `className="bg-surface p-6"` |
| Textarea | `ui/textarea` | Default, `rows={4}`, `rows={3}` |
| Switch | `ui/switch` | Default |
| Badge | `ui/badge` | `variant="outline"`, `variant="secondary"`, custom `className="bg-success/20 text-success"`, `className="cursor-pointer"` |
| Separator | `ui/separator` | Default |
| Select, SelectContent, SelectItem, SelectTrigger, SelectValue | `ui/select` | Various widths: `w-32`, default |
| Table, TableBody, TableCell, TableHead, TableHeader, TableRow | `ui/table` | Default |
| Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger | `ui/dialog` | `className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"` |
| Tabs, TabsContent, TabsList, TabsTrigger | `ui/tabs` | `defaultValue="commands"` |

### Custom Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| PageHeader | `components/PageHeader` | Page title and subtitle |
| Icon | `components/Icon` | Various icons (add, edit, delete, toggle_on, toggle_off) |
| StatsCard | `components/StatsCard` | Stats metrics with accent border |

### States

| State | Loading | Empty | Error | Data |
|-------|---------|-------|-------|------|
| Commands list | `p.text-text-muted` "loading" | `p.text-text-muted` "empty" | Toast via ApiError | Table |
| Dialog form | N/A | N/A | Toast via ApiError | Form fields |
| Variables tab | N/A | N/A | N/A | Static reference table |

---

## RTL Analysis

### Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| `me-1` on Icon (add button) | Lines 323, 494 | OK | `me-1` is logical property (margin-end), RTL-safe. |
| `justify-end` on dialog actions | Line 760 | OK | Flexbox `justify-end` mirrors correctly in RTL. |
| `items-end` on action row | Line 504 | OK | Vertical alignment, direction-agnostic. |
| `w-36` fixed width on action type select | Line 506 | OK | Fixed width, not directional. |
| No `ml-*`/`mr-*`/`pl-*`/`pr-*` | Throughout | OK | All spacing uses direction-agnostic utilities. |

### RTL-Safe Patterns Used
- `me-1` for logical margin-end on icons
- `gap-*`, `space-y-*` throughout
- `flex`, `grid` layouts with no directional assumptions
- `flex-1` for flexible sizing

### RTL Verdict: SAFE
All layout utilities are direction-agnostic. Logical properties (`me-1`) are used correctly.

---

## Responsive Analysis

### Breakpoints Used

| Breakpoint | Usage |
|------------|-------|
| `sm:` | Stats grid: `sm:grid-cols-3`; Dialog: `sm:max-w-2xl`; Trigger config grid: `sm:grid-cols-2`; Options cooldown grid: `sm:grid-cols-2` |
| None for main table | Table has no horizontal scroll wrapper |

### Mobile Behavior (< 640px)

- Stats cards stack to 1 column
- Dialog takes full width (no `sm:max-w-2xl` applies)
- Dialog has `max-h-[90vh] overflow-y-auto` -- scrollable on small screens
- Trigger config fields stack to 1 column
- Embed color/footer grid uses `grid-cols-2` without responsive prefix -- always 2 columns, may be tight on mobile
- Main commands table has 6 columns with no scroll wrapper -- **will overflow on mobile**

### Tablet Behavior (640px-1023px)

- Stats grid becomes 3 columns
- Dialog gets `max-w-2xl`
- Trigger config becomes 2 columns

### Desktop Behavior (1024px+)

- Full sidebar + content layout
- All elements at comfortable widths

### Responsive Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Commands table lacks horizontal scroll wrapper | HIGH | 6-column table will overflow on mobile/small tablet. |
| Embed `grid-cols-2` not responsive | LOW | Color picker + footer side by side on all screen sizes. On very narrow screens could be cramped. |
| Action row `flex items-end gap-2` | LOW | Three elements (w-36 select, flex-1 select, button) side-by-side may squeeze on narrow dialog. |
| No loading skeleton | LOW | Uses plain text "loading" instead of Skeleton components. |

---

## Design System Compliance

### Token Usage

| Category | Compliant | Details |
|----------|-----------|---------|
| Background colors | YES | `bg-surface`, `bg-success/20` |
| Text colors | YES | `text-text-muted`, `text-accent`, `text-success`, `text-danger` |
| Typography | YES | `font-mono`, `font-semibold`, `font-medium`, standard scale |
| Border | YES | `border-border` on action rows and option toggle cards |
| Spacing | YES | Tailwind spacing scale |
| Shadow | YES | No custom shadows |

### Hardcoded Values Found

| Value | Location | Should Be |
|-------|----------|-----------|
| `"#5865f2"` | Lines 82, 150, default embed color | Could be a design token, but this is Discord's blurple -- acceptable as a domain-specific default |
| `"e.g. rules"`, `"e.g. hello|hi|hey"` | Placeholders, Lines 350-353 | Should be translated via i18n |

### Missing Design System Patterns

| Pattern | Expected | Found |
|---------|----------|-------|
| `glass-edge` class on Card | Expected per design system | Not applied |
| Delete confirmation dialog | Expected for destructive actions | Missing -- delete calls handler directly |
| `DialogFooter` in create/edit dialog | Expected pattern | Missing -- uses custom `div.flex.justify-end.gap-2` instead of `DialogFooter` |
| Skeleton loading | Expected | Uses plain text |

---

## Additional Observations

1. **Complex dialog form**: The create/edit dialog is very dense with 6 sections (trigger, response, actions, options, restrictions, submit). This is the most complex form in the audited pages. Consider breaking into steps or an accordion.

2. **No delete confirmation**: Delete button on commands table calls `handleDelete(cmd.id)` directly. This is a destructive action that should have a confirmation dialog.

3. **Channel/role chip pattern**: The allowed channels/roles use `Badge variant="secondary" className="cursor-pointer"` with an `onClick` to remove. The "x" text is not an icon but literal text appended to the name. Should use an `Icon` component for the close indicator.

4. **Hardcoded English placeholders**: Input placeholders like `"e.g. rules"`, `"e.g. hello|hi|hey"`, `"e.g. hello"` are not translated.

5. **Custom active/disabled badge**: The active status badge uses `className="bg-success/20 text-success"` which is a custom style not using a standard Badge variant. Consider adding a "success" variant to the Badge component.

6. **DialogTrigger + controlled state**: The dialog uses both `DialogTrigger` (for the create button) and controlled `open`/`onOpenChange` state. The edit flow uses `setDialogOpen(true)` directly. This dual approach works but is slightly unusual.

7. **Missing DialogFooter**: The dialog uses a custom footer div instead of the `DialogFooter` component that is imported but not used in the create/edit dialog (it's imported but only used conceptually via `div.flex.justify-end.gap-2`). Note: `DialogFooter` is not even imported -- only `DialogTrigger` is imported.

8. **Action limit**: Max 5 actions per command. Enforced with toast notification and disabled button.

9. **Variables tab is static**: The variables reference tab displays a hardcoded list of template variables. This is good UX for discoverability.
