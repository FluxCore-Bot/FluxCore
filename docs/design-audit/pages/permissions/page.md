# Permissions Page - UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/permissions.tsx`
**Component:** `PermissionsPage`
**Sub-components:** `RoleEditor`, `PresetDropdown`, `CreateRoleDialog`, `AuditLogTab`
**Namespace:** `permissions` (i18n)

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
                 -> PermissionsPage
```

### Component Tree

```
div.space-y-8
  PageHeader (title, subtitle, actions: Create Role Button)

  Card                                                    [Enable/Disable Toggle]
    CardContent.flex.items-center.justify-between.py-4
      div (p.font-medium + p.text-sm.text-text-muted)
      Switch (requirePermissions)

  [Conditional: !requirePermissions]
    div.rounded-md.border.border-warning/30.bg-warning/5.px-4.py-3.text-sm.text-warning
      Icon (info) + warning text

  Tabs (defaultValue="roles")
    TabsList
      TabsTrigger ("roles")
      TabsTrigger ("audit")

    TabsContent ("roles", className="mt-6")
      div.flex.gap-6                                      [Two-column layout]
        [Left: Role List]
        div.w-64.shrink-0.space-y-2
          p.section-label.text-text-muted                 [Title]
          div.space-y-1                                   [Role buttons]
            button.flex.w-full.items-center.gap-2.rounded-md.px-3.py-2.text-start.text-sm
              span.h-2.5.w-2.5.shrink-0.rounded-full     [Color dot]
              span.truncate                               [Name]
              Badge (variant="secondary", "default" if isDefault)
          [Empty: p.px-3.py-4.text-center.text-xs.text-text-muted]
          Separator.my-3
          PresetDropdown

        [Right: Role Editor]
        div.min-w-0.flex-1
          RoleEditor (if selectedRole)
          [No selection: div.flex.h-64.items-center.justify-center]

    TabsContent ("audit", className="mt-6")
      AuditLogTab

  CreateRoleDialog

---

RoleEditor:
  div.space-y-6
    [Header]
    div.flex.items-start.justify-between
      div.flex.items-center.gap-3
        span.h-4.w-4.rounded-full (color dot)
        h3.text-lg.font-semibold
        Badge (variant="outline", member count)
      Button (delete, ghost, sm, text-danger)
    [Name & Color]
    div.flex.gap-4
      div.flex-1.space-y-2
        Label + Input (name)
      div.space-y-2
        Label + input[type=color].h-9.w-14               [Native color picker]
      div.flex.items-end.gap-2.pb-0.5
        Switch + Label (default role)
    [Permission Grid]
    div.space-y-2
      Label
      ScrollArea.h-[400px].rounded-md.border.border-outline-variant/20.bg-surface-low.p-4
        div.space-y-6
          [Per module]
          div
            div.flex.items-center.gap-2
              Checkbox (module wildcard)
              span.font-label.text-sm.font-semibold
              Badge (variant="secondary", "ALL" if wildcard)
            div.ms-6.mt-2.grid.grid-cols-1.sm:grid-cols-2.gap-1.5
              label.flex.cursor-pointer.items-start.gap-2.rounded.px-2.py-1.5.text-sm
                Checkbox.mt-0.5
                div > span.text-text + p.text-xs.text-text-muted
    [Actions]
    div.flex.gap-3
      Button (save)
    [Delete Confirm Dialog]
    Dialog
      DialogContent
        DialogHeader > DialogTitle
        p.text-sm.text-text-muted
        DialogFooter
          Button (cancel, outline)
          Button (delete, destructive)

---

PresetDropdown:
  div.space-y-1
    p.section-label.text-text-muted
    button.flex.w-full.items-center.gap-2.rounded-md.px-3.py-1.5.text-start.text-xs
      span.h-2.w-2.rounded-full (color dot)
      preset name

---

CreateRoleDialog:
  Dialog
    DialogContent
      DialogHeader > DialogTitle
      div.space-y-4
        div.space-y-2
          Label + Input (name)
        div.space-y-2
          Label
          div.flex.items-center.gap-3
            input[type=color].h-9.w-14
            span.font-mono.text-xs.text-text-muted (hex display)
      DialogFooter
        Button (cancel, outline)
        Button (create)

---

AuditLogTab:
  [Loading: PageSkeleton]
  [Empty: div.flex.h-48.items-center.justify-center]
  div.space-y-4
    div.rounded-md.border.border-outline-variant/20
      [Header row]
      div.grid.grid-cols-[1fr_1fr_1fr_auto].gap-4.border-b.px-4.py-2.text-xs.font-medium.text-text-muted
      [Data rows]
      div.grid.grid-cols-[1fr_1fr_1fr_auto].gap-4.border-b.px-4.py-2.5.text-sm
    [Pagination]
    div.flex.items-center.justify-center.gap-2
      Button (previous, outline, sm)
      span.text-xs.text-text-muted
      Button (next, outline, sm)
```

### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Create Role button (PageHeader action) | primary button, sm | Opens CreateRoleDialog |
| Require Permissions Switch | toggle | Calls updateSettings mutation (owner-only) |
| Role list buttons | custom buttons | Select role for editing |
| Preset buttons | custom buttons | Creates role from preset template |
| Name input (RoleEditor) | text input | Local state |
| Color picker (RoleEditor) | native `<input type="color">` | Local state |
| Default role Switch (RoleEditor) | toggle | Local state |
| Module wildcard Checkbox | checkbox | Toggles all permissions for module |
| Individual permission Checkbox | checkbox | Toggles single permission |
| Save button (RoleEditor) | primary button | Calls updateRole mutation |
| Delete button (RoleEditor) | ghost button | Opens delete confirm dialog |
| Delete confirm | destructive button | Calls deleteRole mutation |
| Audit log pagination | outline buttons | Navigates audit pages |

---

## Components Inventory

### shadcn/ui Components Used

| Component | Import Path | Variants/Props Used |
|-----------|------------|---------------------|
| Button | `ui/button` | Default, `variant="ghost"`, `variant="outline"`, `variant="destructive"`, `size="sm"` |
| Input | `ui/input` | Default, `maxLength={32}` |
| Label | `ui/label` | Default, `className="text-sm text-text-muted"` |
| Switch | `ui/switch` | Default, with `disabled` |
| Badge | `ui/badge` | `variant="secondary"`, `variant="outline"`, custom `className="ms-auto text-[10px]"`, `className="me-1 text-[10px]"` |
| Card, CardContent | `ui/card` | Default (no `bg-surface` override -- uses Card default) |
| Tabs, TabsContent, TabsList, TabsTrigger | `ui/tabs` | `defaultValue="roles"` |
| Separator | `ui/separator` | Default, `className="my-3"` |
| ScrollArea | `ui/scroll-area` | `className="h-[400px]"` -- fixed height scrollable area |
| Checkbox | `ui/checkbox` | Default, `disabled`, `className="mt-0.5"` |
| Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter | `ui/dialog` | Default |
| PageSkeleton | `components/PageSkeleton` | Full-page loading state |

### Custom Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| PageHeader | `components/PageHeader` | Title, subtitle, and action button |
| Icon | `components/Icon` | Various icons (add, delete, info) |
| PageSkeleton | `components/PageSkeleton` | Loading state for audit log and initial load |

### States

| State | Loading | Empty | Error | Data |
|-------|---------|-------|-------|------|
| Page initial | `PageSkeleton` | N/A | N/A | Full page |
| Role list | Covered by page loading | `p.text-xs.text-text-muted` empty message | N/A | Button list |
| Role editor | N/A | `div.h-64` "select a role" hint | Toast | Form + permission grid |
| Audit log | `PageSkeleton` | `div.h-48` centered message | N/A | Custom grid + pagination |

---

## RTL Analysis

### Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| `me-1` on Icon | Line 79 (create button) | OK | Logical property, RTL-safe |
| `me-2` on Icon | Line 118 (warning info icon) | OK | Logical property, RTL-safe |
| `ms-auto` on Badge | Line 151 | OK | Logical property, RTL-safe |
| `ms-6` on permission grid | Line 361 | OK | Logical property, RTL-safe |
| `me-1` on Badge | Line 574 | OK | Logical property, RTL-safe |
| `text-start` on role buttons | Lines 139, 447 | OK | Logical property, RTL-safe |
| `border-e` on sidebar | N/A (Sidebar component) | OK | Logical property |
| `inset-s-0` on sidebar | N/A (Sidebar component) | OK | Logical property |
| Raw `<input type="color">` | Lines 323, 512 | OBSERVATION | Native color picker -- no RTL concerns but uses raw HTML instead of shadcn Input |
| `toLocaleDateString()` with no locale | Line 581 | MEDIUM | Uses browser default, should be consistent |

### RTL-Safe Patterns Used
- `me-*`, `ms-*` logical margins throughout
- `text-start` for text alignment
- `gap-*`, `space-y-*` for spacing
- `flex`, `grid` layouts

### RTL Verdict: EXCELLENT
This page has the best RTL compliance of all audited pages. Consistently uses logical properties (`me-*`, `ms-*`, `text-start`, `inset-s-*`, `border-e`).

---

## Responsive Analysis

### Breakpoints Used

| Breakpoint | Usage |
|------------|-------|
| `sm:` | `sm:grid-cols-2` on permission grid within ScrollArea |
| None | Two-column layout (`flex gap-6` with `w-64` + `flex-1`) is not responsive |

### Mobile Behavior (< 640px)

- **CRITICAL**: The two-column layout (role list `w-64` + role editor `flex-1`) does not stack on mobile. The `w-64` (256px) sidebar + content area will overflow or severely squeeze the editor on narrow screens.
- Permission checkboxes stack to 1 column
- Audit log grid `grid-cols-[1fr_1fr_1fr_auto]` may be too wide for mobile
- Warning banner is full-width, wraps correctly

### Tablet Behavior (640px-1023px)

- Two-column layout still applies, which works at tablet widths
- Permission grid becomes 2 columns per module

### Desktop Behavior (1024px+)

- Full layout with sidebar + two-column roles view
- Permission grid at 2 columns per module within 400px scroll area
- All elements at comfortable widths

### Responsive Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Two-column role layout not responsive | HIGH | `div.flex.gap-6` with `w-64 shrink-0` + `flex-1` does not stack on mobile. Should use `flex-col lg:flex-row` or similar. |
| Audit log grid not responsive | MEDIUM | `grid-cols-[1fr_1fr_1fr_auto]` will overflow on narrow screens. |
| ScrollArea `h-[400px]` fixed height | LOW | Reasonable for desktop but takes significant vertical space on mobile. |
| Color picker `w-14` is small | LOW | `h-9 w-14` for native color picker is functional but small. |
| `div.flex.gap-4` for name/color/default | MEDIUM | Three items side-by-side on all screen sizes; cramped on mobile. |

---

## Design System Compliance

### Token Usage

| Category | Compliant | Details |
|----------|-----------|---------|
| Background colors | YES | `bg-surface-low`, `bg-surface-high`, `bg-surface-high/50`, `bg-warning/5` |
| Text colors | YES | `text-text`, `text-text-muted`, `text-accent`, `text-danger`, `text-warning` |
| Typography | YES | `font-label`, `font-mono`, `section-label`, `font-semibold` |
| Border | YES | `border-outline-variant/20`, `border-outline-variant/10`, `border-outline-variant/5`, `border-border`, `border-warning/30` |
| Spacing | YES | Tailwind spacing scale |
| Shadow | YES | No custom shadows |

### Hardcoded Values Found

| Value | Location | Should Be |
|-------|----------|-----------|
| `"#a3a6ff"` | Lines 220, 476 (default color) | This IS the design system primary/accent color -- acceptable as a default |
| `"#666"` | Line 147 (fallback dot color) | Could use a design token like `text-text-muted` color |
| `h-[400px]` | Line 336 (ScrollArea) | Hardcoded height -- consider using `max-h-[60vh]` or similar relative unit |
| `text-[10px]` | Lines 151, 356, 574 (Badge font size) | Below Tailwind's `text-xs` (12px). Custom size for very small badges. |

### Missing Design System Patterns

| Pattern | Expected | Found |
|---------|----------|-------|
| `glass-edge` class on Cards | Expected | Not applied to the enable/disable Card |
| Native `<input type="color">` | Expected shadcn Input | Uses raw HTML element with custom classes |
| StatsCards | Common pattern | No stats overview section |

### Design System Strengths

- **Excellent use of `section-label`**: Applied to role list title and preset title
- **Excellent use of `font-label`**: Applied to module labels in permission grid
- **Logical CSS properties throughout**: Best RTL compliance of all pages
- **Warning banner**: Uses `border-warning/30 bg-warning/5 text-warning` correctly
- **`PageSkeleton` usage**: Properly uses PageSkeleton for loading states

---

## Additional Observations

1. **Best-structured page**: This is the most well-architected page in the audit. It uses sub-components (`RoleEditor`, `PresetDropdown`, `CreateRoleDialog`, `AuditLogTab`), proper loading states, and clean separation of concerns.

2. **Delete confirmation present**: Unlike suggestions and commands pages, this page properly has a delete confirmation dialog before removing roles.

3. **Owner-only guard**: The require permissions switch is disabled when `!isOwner`, which is a good permission pattern.

4. **Dirty state tracking**: The `RoleEditor` tracks whether the form has been modified (`dirty`) and disables the save button when no changes exist. This is excellent UX.

5. **Permission wildcard pattern**: The module wildcard (`module.*`) pattern allows granting all permissions in a module at once, with a visual "ALL" badge. Well-implemented.

6. **Audit log uses custom grid**: Instead of the `Table` component used elsewhere, the audit log tab uses a custom CSS grid (`grid-cols-[1fr_1fr_1fr_auto]`). This is inconsistent with other pages but allows more precise column sizing.

7. **Raw color input**: Uses `<input type="color">` directly instead of wrapping in a shadcn Input component. The styling (`h-9 w-14 cursor-pointer rounded-md border border-outline-variant/20 bg-transparent`) is manually applied.

8. **`setsEqual` helper**: Clean utility function at the bottom of the file for comparing permission sets.

9. **Preset dropdown**: Creates roles from predefined templates. Uses `ROLE_PRESETS` from `@fluxcore/types`, which is a good shared types pattern.
