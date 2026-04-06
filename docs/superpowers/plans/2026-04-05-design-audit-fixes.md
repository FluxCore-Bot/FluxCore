# Design Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all ~103 design audit issues: RTL compatibility (80), component design parity with Stitch Obsidian Engine (23), and cross-page consistency (12).

**Architecture:** Changes are purely CSS/Tailwind class and component-level fixes. No new features, no database changes, no API changes. All fixes are in `apps/dashboard/src/client/`. We group by subsystem: (1) UI component library fixes, (2) RTL layout/page fixes, (3) cross-page consistency. Each task produces a single commit.

**Tech Stack:** React 19, Tailwind CSS 4, Radix UI primitives, shadcn/ui components

---

### Task 1: Fix Critical RTL Layout — Guild Layout Margin

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId.tsx:28`

- [ ] **Step 1: Fix physical margin to logical**

In `apps/dashboard/src/client/routes/guild/$guildId.tsx`, change line 28:

```tsx
// BEFORE:
<main className="w-full min-h-full lg:ml-60">

// AFTER:
<main className="w-full min-h-full lg:ms-60">
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173/guild/<id>/overview` in both LTR and RTL modes. In RTL, the main content should now have margin on the right side (next to sidebar), not the left.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/client/routes/guild/\$guildId.tsx
git commit -m "fix(rtl): use logical margin-inline-start for guild layout sidebar offset"
```

---

### Task 2: Fix Input/Textarea Focus Styles to Match Stitch Spec

**Files:**
- Modify: `apps/dashboard/src/client/components/ui/input.tsx:10`
- Modify: `apps/dashboard/src/client/components/ui/textarea.tsx:11`
- Modify: `apps/dashboard/src/client/styles.css:107-113`

Stitch spec says: "Focus: 1px primary border with primary outer glow (4px blur, 10% opacity)."
Current: 2px border, 12px blur, 25% opacity. Textarea uses ring instead of border+glow.

- [ ] **Step 1: Fix input.tsx focus styles**

In `apps/dashboard/src/client/components/ui/input.tsx`, change the className:

```tsx
// BEFORE:
"flex h-9 w-full rounded-sm border-2 border-transparent bg-surface-lowest px-3 py-1 text-sm text-text transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-outline focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[0_0_12px_rgba(163,166,255,0.25)] disabled:cursor-not-allowed disabled:opacity-50"

// AFTER:
"flex h-9 w-full rounded-sm border border-transparent bg-surface-lowest px-3 py-1 text-sm text-text transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-outline focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[0_0_4px_rgba(163,166,255,0.10)] disabled:cursor-not-allowed disabled:opacity-50"
```

Changes: `border-2` -> `border`, shadow `12px`/`0.25` -> `4px`/`0.10`.

- [ ] **Step 2: Fix textarea.tsx to match input pattern**

In `apps/dashboard/src/client/components/ui/textarea.tsx`, change the className:

```tsx
// BEFORE:
"flex min-h-[60px] w-full rounded-sm bg-surface-lowest px-3 py-2 text-sm text-text placeholder:text-outline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

// AFTER:
"flex min-h-[60px] w-full rounded-sm border border-transparent bg-surface-lowest px-3 py-2 text-sm text-text placeholder:text-outline focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[0_0_4px_rgba(163,166,255,0.10)] disabled:cursor-not-allowed disabled:opacity-50"
```

Changes: removed `ring-1 ring-ring`, added `border border-transparent` + `focus-visible:border-accent` + glow shadow.

- [ ] **Step 3: Fix native input focus in styles.css**

In `apps/dashboard/src/client/styles.css`, change lines 107-113:

```css
/* BEFORE: */
input:focus,
select:focus,
textarea:focus {
  outline: none;
  border: 2px solid var(--color-accent);
  box-shadow: 0 0 12px rgba(163, 166, 255, 0.25);
}

/* AFTER: */
input:focus,
select:focus,
textarea:focus {
  outline: none;
  border: 1px solid var(--color-accent);
  box-shadow: 0 0 4px rgba(163, 166, 255, 0.10);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/client/components/ui/input.tsx apps/dashboard/src/client/components/ui/textarea.tsx apps/dashboard/src/client/styles.css
git commit -m "fix(ui): align input/textarea focus styles with Stitch spec (1px border, 4px glow)"
```

---

### Task 3: Fix Dialog & Popover — Add Glassmorphism per Spec

**Files:**
- Modify: `apps/dashboard/src/client/components/ui/dialog.tsx:34`
- Modify: `apps/dashboard/src/client/components/ui/popover.tsx:19`
- Modify: `apps/dashboard/src/client/components/ui/dialog.tsx:46` (DialogHeader RTL)
- Modify: `apps/dashboard/src/client/components/ui/dialog.tsx:51` (DialogFooter RTL)

Stitch spec: Modals/popovers must use glassmorphism (`glass-panel`). No `shadow-2xl`/`shadow-lg`.

- [ ] **Step 1: Fix DialogContent**

In `apps/dashboard/src/client/components/ui/dialog.tsx`, change the DialogContent className (line 34):

```tsx
// BEFORE:
"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl bg-surface-low p-6 shadow-2xl glass-edge duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"

// AFTER:
"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl glass-panel p-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
```

Changes: `bg-surface-low` + `shadow-2xl` + `glass-edge` -> `glass-panel` (which includes bg, blur, and ghost border).

- [ ] **Step 2: Fix DialogHeader RTL**

In `dialog.tsx`, fix DialogHeader (line 46):

```tsx
// BEFORE:
<div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />

// AFTER:
<div className={cn("flex flex-col space-y-1.5 text-center sm:text-start", className)} {...props} />
```

- [ ] **Step 3: Fix DialogFooter RTL**

In `dialog.tsx`, fix DialogFooter (line 51):

```tsx
// BEFORE:
<div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />

// AFTER:
<div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2", className)} {...props} />
```

Change: `sm:space-x-2` -> `sm:gap-2` (direction-neutral).

- [ ] **Step 4: Fix PopoverContent**

In `apps/dashboard/src/client/components/ui/popover.tsx`, change PopoverContent className (line 19):

```tsx
// BEFORE:
"z-50 w-72 rounded-md bg-surface-low p-4 text-text shadow-lg glass-edge outline-none data-[state=open]:animate-in ..."

// AFTER:
"z-50 w-72 rounded-md glass-panel p-4 text-text outline-none data-[state=open]:animate-in ..."
```

Changes: `bg-surface-low` + `shadow-lg` + `glass-edge` -> `glass-panel`.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/components/ui/dialog.tsx apps/dashboard/src/client/components/ui/popover.tsx
git commit -m "fix(ui): add glassmorphism to dialog/popover per Stitch spec, fix RTL text alignment"
```

---

### Task 4: Fix Label Font, Checkbox Border, Select/Dropdown Shadows & Separators

**Files:**
- Modify: `apps/dashboard/src/client/components/ui/label.tsx:12`
- Modify: `apps/dashboard/src/client/components/ui/checkbox.tsx:13`
- Modify: `apps/dashboard/src/client/components/ui/select.tsx` (strokeWidth, shadows, RTL, separator)
- Modify: `apps/dashboard/src/client/components/ui/dropdown-menu.tsx` (shadows, separator, RTL)

- [ ] **Step 1: Fix label.tsx — add Space Grotesk font**

In `apps/dashboard/src/client/components/ui/label.tsx`, change the className:

```tsx
// BEFORE:
"mb-1.5 block text-xs text-text-muted peer-disabled:cursor-not-allowed peer-disabled:opacity-70"

// AFTER:
"mb-1.5 block font-label text-xs text-text-muted peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
```

- [ ] **Step 2: Fix checkbox.tsx — remove resting border, fix focus**

In `apps/dashboard/src/client/components/ui/checkbox.tsx`, change the className:

```tsx
// BEFORE:
"peer h-4 w-4 shrink-0 rounded border border-border bg-surface-lowest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-surface-lowest"

// AFTER:
"peer h-4 w-4 shrink-0 rounded border border-transparent bg-surface-lowest transition-colors focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[0_0_4px_rgba(163,166,255,0.10)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-surface-lowest"
```

Changes: `border-border` -> `border-transparent`, ring-based focus -> border+glow focus.

- [ ] **Step 3: Fix select.tsx — strokeWidth, shadow, RTL, separator**

In `apps/dashboard/src/client/components/ui/select.tsx`, make these changes:

**3a.** SelectTrigger icon (line 33): change `ml-2` to `ms-2` and `strokeWidth="2"` to `strokeWidth="1.5"`:

```tsx
// BEFORE:
className="ml-2 shrink-0 opacity-50"
// ...
strokeWidth="2"

// AFTER:
className="ms-2 shrink-0 opacity-50"
// ...
strokeWidth="1.5"
```

**3b.** SelectScrollUpButton and SelectScrollDownButton SVGs: change `strokeWidth="2"` to `strokeWidth="1.5"` in both.

**3c.** SelectContent (line 102): remove `shadow-lg`:

```tsx
// BEFORE:
"relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md bg-surface-low text-text shadow-lg glass-edge ..."

// AFTER:
"relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md bg-surface-low text-text glass-edge ..."
```

**3d.** SelectTrigger focus (line 16): change ring to border+glow:

```tsx
// BEFORE:
"... focus:outline-none focus:ring-1 focus:ring-ring ..."

// AFTER:
"... focus:outline-none focus:border-accent focus:shadow-[0_0_4px_rgba(163,166,255,0.10)] ..."
```

Also add `border border-transparent` to the base classes (before `bg-surface-lowest`).

**3e.** SelectItem (line 145): fix physical padding `pl-2 pr-8` -> `ps-2 pe-8`:

```tsx
// BEFORE:
"relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 ..."

// AFTER:
"relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 ps-2 pe-8 ..."
```

**3f.** SelectItem check icon position (line 150): fix `right-2` -> `end-2`:

```tsx
// BEFORE:
<span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">

// AFTER:
<span className="absolute end-2 flex h-3.5 w-3.5 items-center justify-center">
```

**3g.** SelectItem check icon strokeWidth (line 159): `strokeWidth="2"` -> `strokeWidth="1.5"`.

**3h.** SelectSeparator: change to spacing-based:

```tsx
// BEFORE:
className={cn("-mx-1 my-1 h-px bg-border", className)}

// AFTER:
className={cn("my-1.5", className)}
```

- [ ] **Step 4: Fix dropdown-menu.tsx — shadow, separator, RTL**

**4a.** DropdownMenuContent (line 19): remove `shadow-lg`:

```tsx
// BEFORE:
"z-50 min-w-[8rem] overflow-hidden rounded-md bg-surface-low p-1 text-text shadow-lg glass-edge ..."

// AFTER:
"z-50 min-w-[8rem] overflow-hidden rounded-md bg-surface-low p-1 text-text glass-edge ..."
```

**4b.** DropdownMenuItem `inset` (line 36): fix `pl-8` -> `ps-8`:

```tsx
// BEFORE:
inset && "pl-8",

// AFTER:
inset && "ps-8",
```

**4c.** DropdownMenuSeparator: change to spacing-based:

```tsx
// BEFORE:
className={cn("-mx-1 my-1 h-px bg-border", className)}

// AFTER:
className={cn("my-1.5", className)}
```

**4d.** DropdownMenuLabel `inset` (line 62): fix `pl-8` -> `ps-8`:

```tsx
// BEFORE:
inset && "pl-8"

// AFTER:
inset && "ps-8"
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/components/ui/label.tsx apps/dashboard/src/client/components/ui/checkbox.tsx apps/dashboard/src/client/components/ui/select.tsx apps/dashboard/src/client/components/ui/dropdown-menu.tsx
git commit -m "fix(ui): label font, checkbox border, select/dropdown shadows and RTL per Stitch spec"
```

---

### Task 5: Fix Table, Tabs, Switch, Slider, ScrollArea, Sonner, Badge, Button

**Files:**
- Modify: `apps/dashboard/src/client/components/ui/table.tsx`
- Modify: `apps/dashboard/src/client/components/ui/tabs.tsx`
- Modify: `apps/dashboard/src/client/components/ui/switch.tsx`
- Modify: `apps/dashboard/src/client/components/ui/slider.tsx`
- Modify: `apps/dashboard/src/client/components/ui/scroll-area.tsx`
- Modify: `apps/dashboard/src/client/components/ui/sonner.tsx`
- Modify: `apps/dashboard/src/client/components/ui/badge.tsx`
- Modify: `apps/dashboard/src/client/components/ui/button.tsx`

- [ ] **Step 1: Fix table.tsx — remove dividers, fix text-left**

```tsx
// TableBody - BEFORE:
className={cn("divide-y divide-border", className)}
// AFTER:
className={cn("[&_tr]:mb-px", className)}

// TableHead - BEFORE:
className={cn("px-6 py-4 text-left align-middle text-text-muted section-label", className)}
// AFTER:
className={cn("px-6 py-4 text-start align-middle text-text-muted section-label", className)}
```

- [ ] **Step 2: Fix tabs.tsx — remove active tab shadow**

```tsx
// TabsTrigger - BEFORE:
"... data-[state=active]:bg-surface-high data-[state=active]:text-text data-[state=active]:shadow-sm"
// AFTER:
"... data-[state=active]:bg-surface-high data-[state=active]:text-text"
```

- [ ] **Step 3: Fix switch.tsx — remove thumb shadow, add RTL flip**

```tsx
// Switch Thumb - BEFORE:
"pointer-events-none block h-4 w-4 rounded-full bg-text shadow-lg transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5"

// AFTER:
"pointer-events-none block h-4 w-4 rounded-full bg-text transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5 rtl:data-[state=checked]:-translate-x-4 rtl:data-[state=unchecked]:-translate-x-0.5"
```

- [ ] **Step 4: Fix slider.tsx — remove thumb shadow**

```tsx
// Slider Thumb - BEFORE:
"block h-4 w-4 rounded-full bg-text shadow-lg transition-colors ..."
// AFTER:
"block h-4 w-4 rounded-full bg-text transition-colors ..."
```

- [ ] **Step 5: Fix scroll-area.tsx — scrollbar width and RTL border**

```tsx
// ScrollBar vertical - BEFORE:
orientation === "vertical" && "h-full w-2 border-l border-l-transparent p-[1px]",
// AFTER:
orientation === "vertical" && "h-full w-1 border-s border-s-transparent p-[1px]",

// ScrollBar horizontal - BEFORE:
orientation === "horizontal" && "h-2 flex-col border-t border-t-transparent p-[1px]",
// AFTER:
orientation === "horizontal" && "h-1 flex-col border-t border-t-transparent p-[1px]",
```

`w-2` (8px) -> `w-1` (4px) to match styles.css native scrollbar. `border-l` -> `border-s` for RTL.

- [ ] **Step 6: Fix sonner.tsx — remove shadow**

```tsx
// BEFORE:
"group toast group-[.toaster]:bg-surface-low group-[.toaster]:text-text group-[.toaster]:shadow-2xl group-[.toaster]:glass-edge"

// AFTER:
"group toast group-[.toaster]:bg-surface-low group-[.toaster]:text-text group-[.toaster]:glass-edge"
```

- [ ] **Step 7: Fix badge.tsx — correct rounded-full**

```tsx
// BEFORE:
"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors"

// AFTER:
"inline-flex items-center rounded-[0.75rem] px-2.5 py-0.5 text-xs font-medium transition-colors"
```

The spec's `full` radius is 12px (0.75rem), not pill (9999px).

- [ ] **Step 8: Fix button.tsx — secondary variant and outline hover**

```tsx
// outline variant - BEFORE:
"border border-outline-variant/20 bg-transparent text-text hover:bg-surface-high"
// AFTER:
"border border-outline-variant/20 bg-transparent text-text hover:bg-surface-hover"

// secondary variant - BEFORE:
"bg-surface-high text-text shadow-sm hover:bg-surface-hover"
// AFTER:
"bg-surface-high text-text hover:bg-surface-hover"
```

Remove `shadow-sm` from secondary.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/src/client/components/ui/table.tsx apps/dashboard/src/client/components/ui/tabs.tsx apps/dashboard/src/client/components/ui/switch.tsx apps/dashboard/src/client/components/ui/slider.tsx apps/dashboard/src/client/components/ui/scroll-area.tsx apps/dashboard/src/client/components/ui/sonner.tsx apps/dashboard/src/client/components/ui/badge.tsx apps/dashboard/src/client/components/ui/button.tsx
git commit -m "fix(ui): remove spec-violating shadows, fix table dividers, switch RTL, badge radius"
```

---

### Task 6: Fix Progress Bar RTL and NodeDetailPanel RTL

**Files:**
- Modify: `apps/dashboard/src/client/components/ui/progress.tsx:16`
- Modify: `apps/dashboard/src/client/components/workflow/NodeDetailPanel.tsx:111`

- [ ] **Step 1: Fix progress.tsx — RTL-safe transform**

```tsx
// BEFORE:
<ProgressPrimitive.Indicator
  className="h-full w-full flex-1 bg-accent transition-all"
  style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
/>

// AFTER:
<ProgressPrimitive.Indicator
  className="h-full w-full flex-1 bg-accent transition-all"
  style={{ insetInlineStart: 0, width: `${value || 0}%` }}
/>
```

Replace translateX hack with width-based approach that's inherently direction-neutral.

- [ ] **Step 2: Fix NodeDetailPanel.tsx — RTL positioning and border**

In `apps/dashboard/src/client/components/workflow/NodeDetailPanel.tsx` line 111, change:

```tsx
// BEFORE:
"absolute right-0 top-0 z-20 flex h-full w-full flex-col border-l border-border bg-surface-low shadow-2xl animate-in slide-in-from-right-4 duration-200 sm:w-96"

// AFTER:
"absolute end-0 top-0 z-20 flex h-full w-full flex-col border-s border-border bg-surface-low animate-in slide-in-from-right-4 duration-200 sm:w-96"
```

Changes: `right-0` -> `end-0`, `border-l` -> `border-s`, removed `shadow-2xl`.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/client/components/ui/progress.tsx apps/dashboard/src/client/components/workflow/NodeDetailPanel.tsx
git commit -m "fix(rtl): progress bar direction-neutral, NodeDetailPanel logical positioning"
```

---

### Task 7: RTL Sweep — Page Files (ml/mr/pl/pr -> ms/me/ps/pe)

**Files (all under `apps/dashboard/src/client/`):**
- Modify: `routes/guild/$guildId/rules.tsx`
- Modify: `routes/guild/$guildId/tickets.tsx`
- Modify: `routes/guild/$guildId/security.tsx`
- Modify: `routes/guild/$guildId/roles.tsx`
- Modify: `routes/guild/$guildId/permissions.tsx`
- Modify: `routes/guild/$guildId/overview.tsx`
- Modify: `routes/guild/$guildId/scheduled.tsx`
- Modify: `routes/guild/$guildId/commands.tsx`

This is a systematic search-and-replace across all guild page files.

- [ ] **Step 1: Fix all page files — margin classes**

Use the following replacements across ALL page files listed above. For each file, search and replace:

| Find | Replace |
|------|---------|
| `ml-auto` | `ms-auto` |
| `ml-0.5` | `ms-0.5` |
| `ml-1` | `ms-1` |
| `ml-1.5` | `ms-1.5` |
| `ml-2` | `ms-2` |
| `ml-6` | `ms-6` |
| `sm:ml-auto` | `sm:ms-auto` |
| `mr-0.5` | `me-0.5` |
| `mr-1` | `me-1` |
| `mr-1.5` | `me-1.5` |
| `mr-2` | `me-2` |
| `pl-9` | `ps-9` |
| `pl-4` | `ps-4` |
| `pl-10` | `ps-10` |
| `pr-1` | `pe-1` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |
| `left-3` | `start-3` |
| `border-l-4` | `border-s-4` |
| `border-l-2` | `border-s-2` |

**Important:** Do NOT replace `left-[50%]` or `left-1/2` (centering transforms are direction-neutral).

- [ ] **Step 2: Fix inline style in scheduled.tsx**

In `routes/guild/$guildId/scheduled.tsx`, find `borderLeftColor` inline style and change:

```tsx
// BEFORE:
style={{ borderLeftColor: form.embedColor || "#a3a6ff" }}

// AFTER:
style={{ borderInlineStartColor: form.embedColor || "#a3a6ff" }}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/client/routes/guild/\$guildId/
git commit -m "fix(rtl): replace all physical direction classes with logical equivalents in page files"
```

---

### Task 8: RTL Sweep — Component Files (ml/mr/pl/pr/positioning)

**Files (all under `apps/dashboard/src/client/components/`):**
- Modify: `MusicLibraryManager.tsx`
- Modify: `EventLogBrowser.tsx`
- Modify: `ConditionsEditor.tsx`
- Modify: `WelcomeImageEditor.tsx`
- Modify: `LogsTable.tsx`
- Modify: `RuleList.tsx`
- Modify: `PermissionGuard.tsx`
- Modify: `overview/ExecutionChart.tsx`
- Modify: `workflow/WorkflowEditor.tsx`
- Modify: `workflow/NodeDetailPanel.tsx` (remaining ml/mr instances)
- Modify: `workflow/nodes/ConditionNode.tsx`
- Modify: `workflow/nodes/ActionNode.tsx`
- Modify: `workflow/nodes/TriggerNode.tsx`

- [ ] **Step 1: Apply same replacements as Task 7**

Apply the same find/replace table from Task 7 Step 1 to all component files listed above. Key instances:

- `MusicLibraryManager.tsx`: `ml-2` -> `ms-2`, `pl-4` -> `ps-4`, `border-l-2` -> `border-s-2`
- `EventLogBrowser.tsx`: `ml-auto` -> `ms-auto`, `pl-10` -> `ps-10`, `left-3` -> `start-3`
- `ConditionsEditor.tsx`: `ml-0.5` -> `ms-0.5`, `ml-auto` -> `ms-auto`, `pr-1` -> `pe-1`
- `WelcomeImageEditor.tsx`: `ml-auto` -> `ms-auto`, `mr-1` -> `me-1`, `text-left` -> `text-start`
- `LogsTable.tsx`: `pl-10` -> `ps-10`, `left-3` -> `start-3`
- `RuleList.tsx`: `mr-0.5` -> `me-0.5`
- `PermissionGuard.tsx`: `text-left` -> `text-start`
- `ExecutionChart.tsx`: `mr-1.5` -> `me-1.5`
- `WorkflowEditor.tsx`: `ml-auto` -> `ms-auto`, `ml-1.5` -> `ms-1.5`, `!mr-2` -> `!me-2`
- `NodeDetailPanel.tsx`: `ml-1.5` -> `ms-1.5`, `mr-1.5` -> `me-1.5`, `mr-1` -> `me-1` (remaining from Task 6)
- `ConditionNode.tsx`: `ml-auto` -> `ms-auto`
- `ActionNode.tsx`: `ml-auto` -> `ms-auto`
- `TriggerNode.tsx`: `ml-auto` -> `ms-auto`

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/client/components/
git commit -m "fix(rtl): replace physical direction classes with logical equivalents in components"
```

---

### Task 9: Fix Directional Icons — Add RTL Rotation

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/rules.tsx` (breadcrumb chevrons)
- Modify: `apps/dashboard/src/client/components/workflow/WorkflowEditor.tsx` (back arrow)
- Modify: `apps/dashboard/src/client/components/Sidebar.tsx` (verify existing RTL flip)

- [ ] **Step 1: Fix breadcrumb chevrons in rules.tsx**

Find all `<Icon name="chevron_right"` in `rules.tsx` and add RTL rotation:

```tsx
// BEFORE:
<Icon name="chevron_right" size={14} />

// AFTER:
<Icon name="chevron_right" size={14} className="rtl:rotate-180" />
```

- [ ] **Step 2: Fix back arrow in WorkflowEditor.tsx**

Find `<Icon name="arrow_back"` in `WorkflowEditor.tsx` and add RTL rotation:

```tsx
// BEFORE:
<Icon name="arrow_back" size={16} />

// AFTER:
<Icon name="arrow_back" size={16} className="rtl:rotate-180" />
```

- [ ] **Step 3: Verify Sidebar already handles arrow_back**

Check `apps/dashboard/src/client/components/Sidebar.tsx` — it should already have `rtl:rotate-180` on the "Back to Servers" arrow icon (it was noted as correct in the audit). If it doesn't, add it.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/client/routes/guild/\$guildId/rules.tsx apps/dashboard/src/client/components/workflow/WorkflowEditor.tsx
git commit -m "fix(rtl): flip directional icons (chevrons, arrows) in RTL mode"
```

---

### Task 10: Verify All Fixes with Playwright

**Files:**
- No code changes — verification only

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev:dashboard
```

- [ ] **Step 2: Run Playwright to take RTL screenshots of all pages**

Navigate to each page with `dir="rtl"` and visually verify:
1. Sidebar is on the right
2. Main content has correct margin on the right (not left)
3. Stat card borders are on the correct (start) side
4. All text aligns to the start (right in RTL)
5. Directional icons (arrows, chevrons) point the correct direction
6. Form inputs and dropdowns render correctly
7. Dialog/popover have glassmorphism effect

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: No new type errors from our class-only changes.

- [ ] **Step 4: Run existing tests**

```bash
pnpm test
```

Expected: All tests pass (no behavioral changes, only CSS classes).

---

### Task 11: Final Cleanup Commit

- [ ] **Step 1: Clean up screenshot artifacts**

```bash
rm -rf screenshots/
```

- [ ] **Step 2: Final commit if any remaining changes**

```bash
git status
# If clean, no commit needed
# If there are remaining fixes found during verification, commit them
```
