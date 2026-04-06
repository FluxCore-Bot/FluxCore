# Scheduled Messages Page UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/scheduled.tsx`
**Component:** `ScheduledMessagesPage`
**Lines:** 683

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle, actions: [Create Button])
  div.grid.grid-cols-1.gap-4.sm:grid-cols-3       [Stats row]
    StatsCard (totalMessages)
    StatsCard (active, valueClassName="text-success")
    StatsCard (inactive)
  Card.bg-surface.p-6                              [Message List]
    [Loading state | Table + Pagination | Empty state with icon + CTA]
  Dialog (create/edit)
    DialogContent.max-w-2xl
      DialogHeader > DialogTitle
      div.space-y-6
        [Name input]
        [Channel select]
        [Schedule grid: preset select + cron input]
        [Timezone select]
        [Cron preview box]
        Separator
        Tabs (text | embed)
          [Text: Textarea]
          [Embed: title, description, color, footer, thumbnail, image + preview]
        [Enabled toggle]
      DialogFooter
        Button (cancel)
        Button (submit)
```

### Component Tree

- `PageHeader` -- title, subtitle, actions (Button with Icon)
- `StatsCard` x3 -- totalMessages, active (with `text-success`), inactive
- `Card` -- message list container
- `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` -- message list
- `Badge` -- enabled/disabled status per row
- `Switch` -- inline toggle per row in table
- `Button` x3 per row -- test (play_arrow), edit, delete
- `Button` x2 -- pagination
- `Icon` -- schedule (empty state), add (header + empty CTA), play_arrow, edit, delete
- `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogFooter` -- create/edit form
- `Select` x3 in dialog -- channel, schedule preset, timezone
- `Input` x6 in dialog -- name, cron expression, embed title, embed color (hex), embed footer, embed thumbnail, embed image
- `Textarea` x2 -- text content, embed description
- `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` -- text/embed toggle in dialog
- `Separator` -- before message content tabs
- `Label` -- all form fields
- Native `<input type="color">` -- embed color picker (line 584-589)

---

## Components Inventory

| Component | Variant/Props | Count | Notes |
|-----------|--------------|-------|-------|
| `PageHeader` | title, subtitle, actions | 1 | Has create button in actions |
| `StatsCard` | label, value, valueClassName? | 3 | Active card uses `valueClassName="text-success"` |
| `Card` | className="bg-surface p-6" | 1 | Message list |
| `Table` | -- | 1 | 6 columns: name, channel, schedule, nextRun, status, actions |
| `Badge` | variant="default" or "secondary" | per row | Enabled/disabled indicator |
| `Switch` | checked, onCheckedChange | per row + 1 in dialog | Toggle enabled state |
| `Button` | variant="ghost" size="sm" | 3 per row | Test, edit, delete actions |
| `Button` | variant="outline" size="sm" | 2 | Pagination |
| `Button` | default | 3 | Header create, empty CTA, dialog submit |
| `Button` | variant="outline" | 1 | Dialog cancel |
| `Dialog` | open, onOpenChange | 1 | Create/edit modal |
| `DialogContent` | className="max-w-2xl" | 1 | Wide dialog |
| `Select` | -- | 3 | Channel, cron preset, timezone |
| `Input` | -- | 6 | Name, cron expr, embed fields |
| `Textarea` | rows={5} or rows={4} | 2 | Text content, embed description |
| `Tabs` | value, onValueChange (controlled) | 1 | Text/embed switcher in dialog |
| `Separator` | -- | 1 | Before tabs in dialog |
| `Label` | htmlFor | 10+ | All inputs |
| `Icon` | various names | 6 | schedule, add (x2), play_arrow, edit, delete |
| Native `<input>` | type="color" | 1 | **Non-shadcn** color picker |

### Conditional Rendering

- **Cron preview**: only shown when `cronPreview && cronPreview.nextRuns.length > 0`
- **Embed preview**: only shown when `form.embedTitle || form.embedDescription`
- **Pagination**: only when `totalPages > 1`
- **Table vs empty state**: based on `data.messages.length > 0`
- **Dialog title**: changes based on `editingId !== null` (edit vs create)
- **Submit button label**: changes based on `editingId !== null`

---

## Interaction Behavior

### Hover/Focus/Active/Disabled States

- **Pagination buttons**: disabled at boundaries
- **Dialog submit**: disabled when `createMsg.isPending || updateMsg.isPending`
- **Table action buttons (test/edit/delete)**: variant="ghost" -- standard hover state
- **Color picker**: `cursor-pointer` set explicitly
- All shadcn inputs have built-in `focus-visible:ring` states

### Click Handlers

| Element | Handler | Side Effect |
|---------|---------|-------------|
| Header create button | `openCreate()` | Resets form, opens dialog |
| Empty state create button | `openCreate()` | Same |
| Table test button | `handleTestSend(msg.id)` | Mutation + toast |
| Table edit button | `openEdit(msg)` | Populates form from message data, opens dialog |
| Table delete button | `handleDelete(id)` | Mutation + toast |
| Table switch | `handleToggleEnabled(id, checked)` | Mutation + toast on error |
| Dialog cancel | `setDialogOpen(false)` | Closes dialog |
| Dialog submit | `handleSubmit()` | Validation + create/update mutation + toast |
| Pagination prev/next | `setPage(...)` | Page state change |

### Form Validation

- **Name**: must be non-empty after trim; error via `toast.error()`
- **Channel**: must be selected (non-empty); error via `toast.error()`
- No cron expression validation on the client side (server-side only)
- No embed content validation (can submit empty embed)
- `maxLength={100}` on name input, `maxLength={2000}` on text content (HTML attribute enforcement)

### Tab Behavior (Dialog)

- Controlled `Tabs` for text/embed: `value={form.messageType}` with `onValueChange`
- Switching between text and embed preserves both form states (no data loss)

---

## Dynamic States

### Loading States

- **Message list**: `<p className="text-text-muted">{t("common:loading")}</p>` -- plain text
- **Stats cards**: show "..." string while loading

### Empty States

- **Message list**: Rich empty state with:
  - `div.flex.flex-col.items-center.gap-4.py-12.text-center`
  - `Icon name="schedule" size={48} className="text-text-muted"` -- large icon
  - Title: `<p className="font-medium text-text">`
  - Description: `<p className="mt-1 text-sm text-text-muted">`
  - CTA: `Button` with add icon and text
  - **This is the best empty state pattern among the audited pages**

### Error States

- No dedicated error UI; all via `toast.error()` from mutation callbacks
- API errors unwrapped: `err instanceof ApiError ? err.message : t("toast.xxxFailed")`

### Success States

- Create/update/delete/test: `toast.success()` + dialog close (for create/update)

---

## RTL Analysis

### Hardcoded LTR Styles

| Location | Class/Style | Issue |
|----------|------------|-------|
| Line 278 | `className="me-2"` on add Icon | **Correct** -- uses logical `me-2` (margin-inline-end) |
| Line 415 | `className="me-2"` on add Icon | **Correct** |
| Line 633 | `border-s-4` on embed preview | **Correct** -- uses logical `border-inline-start` |
| Line 635 | `borderInlineStartColor` inline style | **Correct** -- uses logical property |

### Missing Logical Properties

- No `ml-*`/`mr-*` hardcoded -- all margins use logical `me-*`/`ms-*` or gap
- No `text-left`/`text-right` -- uses `text-center` only (for empty state)
- No `pl-*`/`pr-*` hardcoded

### Icon Direction

- `play_arrow` -- directional icon, points right. In RTL should ideally be mirrored, but this is a "test/send" action icon, not a navigation arrow. **Low concern.**

### Overall RTL Assessment

**Excellent.** This page demonstrates the best RTL practices among the audited pages. Uses `me-2`, `ms-2`, `border-s-4`, and `borderInlineStartColor` consistently.

---

## Responsive Analysis

### Breakpoint Usage

| Breakpoint | Usage | Lines |
|-----------|-------|-------|
| `sm:grid-cols-3` | Stats row | 285 |
| `sm:grid-cols-2` | Schedule preset + cron input grid in dialog | 460 |
| `sm:grid-cols-2` | Embed color/footer grid | 580 |
| `sm:grid-cols-2` | Embed thumbnail/image grid | 609 |

### Mobile Behavior

- Stats cards stack to single column
- Message table: **No horizontal scroll wrapper** -- 6 columns will overflow on mobile
- Dialog: `max-w-2xl` -- may need scroll on mobile; shadcn DialogContent handles this
- Form grids in dialog stack to 1 column on mobile (`grid-cols-1 sm:grid-cols-2`)

### Potential Issues

1. **Message table overflow on mobile** -- 6 columns (name, channel, schedule, nextRun, status, actions) with code blocks and switches
2. **Dialog scroll** -- long form may require vertical scroll; shadcn Dialog supports this

---

## Modals/Overlays

### Create/Edit Dialog

| Property | Value |
|----------|-------|
| Trigger | `openCreate()` button in header + empty state; `openEdit(msg)` per row |
| Component | `Dialog` + `DialogContent` |
| Size | `max-w-2xl` (~672px) |
| Close | Cancel button, `onOpenChange={setDialogOpen}` (overlay click, escape) |
| State management | `dialogOpen` boolean, `editingId` for mode, `form` object |
| Positioning | shadcn default (centered, overlay) |
| Scroll | Content may exceed viewport on mobile -- relies on DialogContent overflow handling |

### Dialog Content Structure

1. Name input
2. Channel select (from `useChannels` hook)
3. Schedule: preset select + raw cron input (2-col grid on sm+)
4. Timezone select (12 common timezones hardcoded)
5. Cron preview box (conditional, shows next 3 runs)
6. Separator
7. Message type tabs (text | embed)
   - Text: textarea with character counter
   - Embed: title, description, color (native picker + hex input), footer, thumbnail URL, image URL, live preview
8. Enabled toggle (Switch)
9. Footer: Cancel + Submit buttons

---

## Design System Compliance

### Color Tokens

| Usage | Value | Compliant? |
|-------|-------|-----------|
| `bg-surface` | Card background | Yes |
| `bg-surface-high` | Cron preview box, embed preview | Yes |
| `text-text-muted` | Secondary text, descriptions | Yes |
| `text-text` | Primary text in embed preview | Yes |
| `text-danger` | Delete icon | Yes |
| `text-success` | Active stats value | Yes |
| `text-primary` | Not used | -- |
| `border-border` | Cron preview box, color picker input | Yes |
| `border-accent` | Focus ring (via shadcn) | Yes |
| `#a3a6ff` | Default embed color (hardcoded) | Yes -- matches design system primary |

### Typography

| Usage | Classes | Compliant? |
|-------|---------|-----------|
| Table cell name | `font-medium` | Yes |
| Table cell channel | `font-mono text-xs` | Yes -- JetBrains Mono |
| Cron code block | `rounded bg-surface-high px-2 py-0.5 font-mono text-xs` | Yes |
| Next run text | `text-sm text-text-muted` | Yes |
| Character counter | `text-xs text-text-muted` | Yes |
| Cron preview label | `text-xs font-semibold text-text-muted` | Yes |
| Cron preview times | `font-mono text-xs text-text` | Yes |
| Empty state title | `font-medium text-text` | Yes |
| Empty state desc | `mt-1 text-sm text-text-muted` | Yes |

### Spacing

| Pattern | Classes | Notes |
|---------|---------|-------|
| Page rhythm | `space-y-8` | Consistent |
| Card padding | `p-6` | Standard |
| Empty state padding | `py-12` | Generous vertical space |
| Dialog sections | `space-y-6` | Consistent |
| Form grids | `gap-4` | Standard |

### Hardcoded Values

| Location | Value | Concern |
|----------|-------|---------|
| `max-w-2xl` | Dialog width | Acceptable -- standard dialog sizing |
| Native `<input type="color">` | Line 584-589 | **Non-shadcn component** -- `h-9 w-12 cursor-pointer rounded border border-border bg-transparent` uses design tokens but is a raw HTML element |
| `COMMON_TIMEZONES` array | 12 hardcoded timezones | Functional concern -- not all timezones represented |
| `#a3a6ff` | Default embed color | Matches primary token but hardcoded hex |

### Missing Design System Usage

- **Native color input** at line 584-589 -- not a shadcn component; uses inline styling that matches but breaks the component abstraction
- **No skeleton loading** -- just "..." and plain text
- **Cron preview box** uses a custom styled `div` rather than a reusable component pattern

---

## Findings Summary

### Issues

1. **Native `<input type="color">`** (line 584) -- violates the shadcn/ui component rule. Should be wrapped in a custom component or use a shadcn-compatible color picker
2. **Message table not responsive** -- no horizontal scroll wrapper for 6-column table on mobile
3. **No skeleton loading states** -- stats show "..." and list shows plain text
4. **Hardcoded timezone list** -- only 12 timezones; users in unlisted zones have no option
5. **No client-side cron validation** -- invalid cron expressions only caught by server
6. **Hardcoded `#a3a6ff`** appears twice (default embed color, placeholder) -- should reference a token/constant
7. **Dialog form has no unsaved changes warning** -- closing dialog with edits silently discards them
8. **`play_arrow` icon** could be confusing for "test send" -- no tooltip text visible (only `title` attribute)

### Strengths

1. **Best empty state pattern** among audited pages -- icon, text, CTA button
2. **Excellent RTL compliance** -- uses logical properties (`me-2`, `border-s-4`, `borderInlineStartColor`)
3. **Live embed preview** -- good UX for message authoring
4. **Cron preview with next 3 runs** -- excellent scheduling UX
5. **Character counter** on text content
