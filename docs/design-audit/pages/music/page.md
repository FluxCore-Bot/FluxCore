# Music Page — UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/music.tsx`
**Sub-components:**
- `apps/dashboard/src/client/components/MusicSettingsForm.tsx`
- `apps/dashboard/src/client/components/MusicLibraryManager.tsx`

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle)
  Tabs (defaultValue="settings")
    TabsList
      TabsTrigger[value="settings"]
      TabsTrigger[value="library"]
    TabsContent[value="settings"]
      MusicSettingsForm
    TabsContent[value="library"]
      MusicLibraryManager
```

### MusicSettingsForm Component Tree

```
Card.p-6
  h3.mb-6.text-lg.font-semibold  (heading)
  Alert[variant="destructive"]  (conditional: error)
  form.space-y-5
    div > Label + Select (Music Mode: open/library)
    div > Label + Select (DJ Role: none/roles list)
    div > Label + Slider (Default Volume: 0-100)
    div > Label + Input[type=number] (Max Queue Size: 1-500)
    div > Label + Input[type=number] (Auto Disconnect Seconds: 0-3600)
    div.flex.items-center.gap-3 > Switch + Label (24/7 mode)
    div (conditional: twentyFourSeven)
      Label + Select (Voice Channel)
      p.text-xs.text-muted-foreground (hint text)
    Button[type=submit] (Save)
```

### MusicLibraryManager Component Tree

```
Card.p-6
  div.mb-6.flex (header row)
    div > h3 + p.text-text-muted (title/description)
    Button (conditional: Add Album - when < 50 albums)
  Alert[variant="destructive"] (conditional: error)
  form (conditional: showCreateForm)
    Label + Input + div.flex.gap-2 > Button[submit] + Button[ghost]
  div.space-y-3 (albums list, when > 0)
    Collapsible (per album)
      Card.bg-surface-high.p-4
        div.flex > CollapsibleTrigger(Button) + Button[delete]
        CollapsibleContent > AlbumTracks
  EmptyState (when 0 albums and no form)

AlbumTracks sub-component:
  div.mt-2.space-y-2.border-s-2.border-outline-variant/30.ps-4
    div (per track): .flex.items-center.justify-between.rounded-md.bg-surface-lowest.px-3.py-2
      div > p.truncate.text-sm (title) + p.truncate.text-xs.text-text-muted (URL)
      Button[ghost,sm] (Remove)
    p (empty: no tracks message)
    Alert[destructive] (conditional: error)
    form (conditional: showForm)
      Input (title) + Input (URL) + div.flex.gap-2 > Button[submit] + Button[ghost]
    Button[variant=link] (+ Add Track, when < 100 tracks)
```

---

## Components Inventory

| Component | Source | Variants/Props Used | States |
|-----------|--------|---------------------|--------|
| `PageHeader` | custom | `title`, `subtitle` | static |
| `Tabs` | shadcn/ui | `defaultValue="settings"` | controlled by user |
| `TabsList` | shadcn/ui | default | - |
| `TabsTrigger` | shadcn/ui | `value="settings"`, `value="library"` | active/inactive |
| `Card` | shadcn/ui | `className="p-6"`, `className="bg-surface-high p-4"` | static |
| `Alert` | shadcn/ui | `variant="destructive"` | conditional on error string |
| `Select` | shadcn/ui | multiple instances | - |
| `SelectTrigger` | shadcn/ui | default | - |
| `SelectContent` | shadcn/ui | default | - |
| `SelectItem` | shadcn/ui | per option | - |
| `Slider` | shadcn/ui | `min`, `max`, `step`, `value`, `onValueChange` | controlled |
| `Input` | shadcn/ui | `type="number"`, text | controlled |
| `Label` | shadcn/ui | default, `className="mb-0 text-sm"` | static |
| `Switch` | shadcn/ui | `checked`, `onCheckedChange` | controlled boolean |
| `Button` | shadcn/ui | `type="submit"`, `variant="ghost"`, `variant="link"`, default | disabled when isPending |
| `Collapsible` | shadcn/ui | default | open/closed |
| `CollapsibleTrigger` | shadcn/ui | `asChild` | toggle |
| `CollapsibleContent` | shadcn/ui | default | animated expand/collapse |
| `Skeleton` | shadcn/ui | `className="h-10 w-full"` | loading placeholder |
| `Icon` | custom (Material Symbols) | `name="expand_more"`, `name="add"`, size=16 | static |
| `EmptyState` | custom | `icon="library_music"`, `title`, `description`, `action` | static |
| `PageSkeleton` | custom | none | loading state |

---

## Interaction Behavior

### Form Submission (MusicSettingsForm)
- `form.onSubmit` calls `handleSave` which calls `updateSettings.mutateAsync`
- Button text changes to `t("settings.saving")` while `isPending`
- On success: `toast.success`
- On error: sets local `error` state, rendered in `Alert[destructive]`

### 24/7 Toggle
- `Switch.onCheckedChange` toggles `twentyFourSeven` state
- Conditionally shows voice channel `Select` below
- When disabled, `lastChannelId` is sent as `null`

### Album Management (MusicLibraryManager)
- "Add Album" button shows inline form with name input
- Create form submission: validates non-empty, calls `createAlbum.mutateAsync`
- Delete album: direct call to `deleteAlbum.mutateAsync`, no confirmation dialog
- Both operations disable buttons via `isPending`

### Track Management (AlbumTracks)
- Tracks nested inside `CollapsibleContent` per album
- "Add Track" link button shows inline form
- Form validates both title and sourceUrl non-empty
- Delete track: direct call, no confirmation
- Loading state shows 2 `Skeleton` elements

### Tab Switching
- Default: "settings" tab
- No URL persistence of active tab
- Tab switching is purely client-side via Tabs component

---

## Dynamic States

### Loading State
- **MusicSettingsForm:** Returns `<PageSkeleton />` (2 skeleton blocks)
- **MusicLibraryManager:** Returns `<PageSkeleton />` (same)
- **AlbumTracks:** Shows 2 `Skeleton` elements with `h-10 w-full`

### Empty State
- **MusicLibraryManager:** Shows `EmptyState` component with `icon="library_music"` when no albums and create form not open
- **AlbumTracks:** Shows `p.text-xs.text-text-muted` with "no tracks" message

### Error State
- Both MusicSettingsForm and MusicLibraryManager use local `error` state
- Rendered as `Alert[variant="destructive"]` above content
- Error text extracted from `ApiError.message` or generic fallback

### Success State
- `toast.success()` via sonner for all CRUD operations
- No inline success indicators

---

## RTL Analysis

### Issues Found

1. **`mr-1` in WelcomeImageEditor (shared component):** Not directly in music page, but `Icon` within `MusicLibraryManager` uses `me-1` correctly at line 269 of roles.tsx (the Icon in the Add Album button has no margin class).

2. **`text-muted-foreground` at MusicSettingsForm line 182:** Uses `text-muted-foreground` instead of the project token `text-text-muted`. This is a shadcn default token, not the Obsidian Engine token.

3. **`border-s-2` and `ps-4` (AlbumTracks line 41, 80):** Correctly uses logical properties for RTL.

4. **`ms-2` (AlbumTracks line 93):** Correctly uses logical margin.

5. **`ms-auto` in WelcomeImageEditor line 168:** Correctly uses logical property.

6. **No `text-start` or `text-end` issues** in this page; content flows naturally.

7. **Flex direction:** All flex containers use default `flex-row` or responsive `flex-col` to `flex-row` patterns. These are LTR-neutral when combined with `gap`.

### RTL Verdict
Mostly RTL-safe. The `border-s-2` and `ps-4`/`ms-2` usage is correct. No hardcoded `left`/`right` properties found.

---

## Responsive Analysis

### Mobile (< 640px)
- Page layout: `space-y-8` vertical stack
- MusicLibraryManager header: `flex-col gap-3` (title stacks above button)
- AlbumTracks: full width, track items stack properly

### Tablet/Desktop (>= 640px, `sm:`)
- MusicLibraryManager header: `sm:flex-row sm:items-center sm:justify-between`
- No multi-column grid layouts in settings form (all single column)

### Breakpoints Used
- `sm:` only (640px)
- No `md:`, `lg:`, or `xl:` breakpoints

### Gaps
- MusicSettingsForm: All inputs are full-width with no responsive grid. The form could benefit from `sm:grid-cols-2` for some fields (volume slider, queue size, disconnect timer).
- Slider has no responsive width consideration.

---

## Modals/Overlays

### None
- No dialogs, dropdowns, or tooltips in the music page
- Delete operations happen without confirmation (potential UX issue)
- Select dropdowns via shadcn use Radix Popover internally

---

## Design System Compliance

### Color Tokens

| Usage | Actual | Expected | Status |
|-------|--------|----------|--------|
| Card background | `p-6` (Card default) | `bg-surface-high` per design | Depends on Card base |
| Album card | `bg-surface-high` | `surface-high` (#1f1f22) | Correct |
| Track item bg | `bg-surface-lowest` | `surface-lowest` (#000000) | Correct |
| Track form bg | `bg-surface-high` | `surface-high` (#1f1f22) | Correct |
| Muted text | `text-text-muted` | `text-muted` (#adaaad) | Correct |
| Delete button | `text-danger hover:text-danger` | `danger` (#ff6e84) | Correct |
| Channel hint | `text-muted-foreground` | Should be `text-text-muted` | **WRONG TOKEN** |
| Track border | `border-outline-variant/30` | `outline-variant` (#48474a) at 30% | Correct |

### Typography

| Element | Actual | Expected per Design System |
|---------|--------|---------------------------|
| Section heading | `text-lg font-semibold` | Correct for card headers |
| Track title | `text-sm` | Body-MD (0.875rem) correct |
| Track URL | `text-xs text-text-muted` | Appropriate muted sub-text |
| Switch label | `mb-0 text-sm` | Acceptable |
| Hint text | `text-xs text-muted-foreground` | Wrong token (see above) |

### Spacing
- `space-y-8` page spacing: consistent with other pages
- `space-y-5` form spacing: consistent
- `p-6` card padding: consistent
- `mb-6` heading margin: consistent

### Border/Radius
- Track items: `rounded-md` (2px per design system) -- note design system `md` = 0.125rem = 2px but Tailwind `rounded-md` = 6px. **Potential mismatch** depending on Tailwind config override.
- Cards: use shadcn Card default radius

### Hardcoded Values
- `MusicSettingsForm` line 135: `min={1} max={500}` -- business logic, acceptable
- `MusicSettingsForm` line 148: `min={0} max={3600}` -- business logic, acceptable
- `MAX_ALBUMS = 50`, `MAX_TRACKS = 100` -- business constants, acceptable

### Design System Rule Violations
1. **No-Line Rule:** `border-s-2 border-outline-variant/30` in AlbumTracks uses a border for visual hierarchy. This serves as a tree-connector indicator rather than a section divider, so it is contextually acceptable.
2. **Technical Data in Mono:** Track URLs are displayed in regular `text-xs` instead of `font-mono`. The source URLs are technical data and should use JetBrains Mono per the design system.
