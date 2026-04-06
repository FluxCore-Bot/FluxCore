# Starboard Page - UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/starboard.tsx`
**Component:** `StarboardPage`
**Namespace:** `starboard` (i18n)

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
                 -> StarboardPage
```

### Component Tree

```
div.space-y-8
  PageHeader (title, subtitle)

  [Loading state: div.space-y-8 > PageHeader + p.text-text-muted]

  Tabs (defaultValue="settings")
    TabsList
      TabsTrigger ("settings")
      TabsTrigger ("entries")

    TabsContent ("settings")
      Card.bg-surface.p-6
        div.mb-6.flex.items-center.justify-between    [Header + Enable Toggle]
          div (h3 + p)
          Switch (enabled)
        Separator.mb-6
        div.space-y-6                                  [Settings Form]
          div                                          [Channel ID input]
            Label + Input.mt-1.w-64 + p.mt-1
          div.grid.grid-cols-1.sm:grid-cols-2.gap-4    [Emoji + Threshold]
            div (Label + Input.mt-1 + p.mt-1)
            div (Label + Input[type=number].mt-1 + p.mt-1)
          div.flex.items-center.justify-between.rounded-lg.border.border-border.p-4  [Self-star toggle]
            div (p + p)
            Switch
          div                                          [Ignored channels input]
            Label + Input.mt-1 + p.mt-1
          div                                          [NSFW handling select]
            Label + Select.mt-1.w-48 + p.mt-1
      div.mt-6.flex.gap-3                              [Save button]
        Button

    TabsContent ("entries")
      Card.bg-surface.p-6
        h3.mb-2.text-lg.font-semibold
        p.mb-4.text-sm.text-text-muted
        Separator.mb-4
        [Loading: p.text-text-muted]
        [Empty: div.flex.flex-col.items-center.justify-center.py-12.text-center]
          Icon (star, size=48)
          p.text-text-muted
          p.text-sm.text-text-muted/60
        [Data: Table + Pagination]
```

### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Enabled Switch | toggle | Sets local state `enabled` |
| Channel ID Input | text input | Sets local state `channelId` |
| Emoji Input | text input | Sets local state `emoji` |
| Threshold Input | number input | Sets local state `threshold` (min=1, max=100) |
| Self-Star Switch | toggle | Sets local state `selfStar` |
| Ignored Channels Input | text input | Sets local state `ignoredChannels` (comma-separated) |
| NSFW Handling Select | dropdown | Sets local state `nsfwHandling` ("ignore" or "separate") |
| Save Button | primary button | Calls `handleSave()` -- mutates all settings at once |
| Previous/Next pagination | outline buttons | Navigates starred messages pages |

---

## Components Inventory

### shadcn/ui Components Used

| Component | Import Path | Variants/Props Used |
|-----------|------------|---------------------|
| Button | `ui/button` | Default, `variant="outline"`, `size="sm"` |
| Input | `ui/input` | Default, `type="number"` |
| Label | `ui/label` | Default, with `htmlFor` |
| Card | `ui/card` | Default with `className="bg-surface p-6"` |
| Switch | `ui/switch` | Default |
| Separator | `ui/separator` | Default, with `className="mb-6"`, `className="mb-4"` |
| Select, SelectContent, SelectItem, SelectTrigger, SelectValue | `ui/select` | `className="mt-1 w-48"` on trigger |
| Table, TableBody, TableCell, TableHead, TableHeader, TableRow | `ui/table` | Default |
| Tabs, TabsContent, TabsList, TabsTrigger | `ui/tabs` | `defaultValue="settings"` |
| Badge | `ui/badge` | `variant="secondary"` |

### Custom Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| PageHeader | `components/PageHeader` | Page title and subtitle |
| Icon | `components/Icon` | Star icon for empty state |

### States

| State | Loading | Empty | Error | Data |
|-------|---------|-------|-------|------|
| Settings | Full page: PageHeader + "loading" text | N/A | Toast via ApiError | Form with local state |
| Entries list | `p.text-text-muted` "loading" | Centered icon + text empty state | N/A | Table with pagination |

---

## RTL Analysis

### Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| `toLocaleDateString()` with no locale | Line 284 | MEDIUM | Uses browser default locale which is usually correct, but inconsistent with explicit locale usage elsewhere. |
| Hardcoded `w-64` on channel input | Line 143 | OK | Fixed width, not directional. |
| Hardcoded `w-48` on select trigger | Line 214 | OK | Fixed width, not directional. |
| No `ml-*`/`mr-*`/`pl-*`/`pr-*` | Throughout | OK | All spacing uses direction-agnostic utilities. |
| `left-1/2`, `right-1/4` in background glows | N/A (not in this file) | OK | N/A for this page. |

### RTL-Safe Patterns Used
- `gap-*`, `space-y-*` for all spacing
- `flex items-center justify-between` for toggle rows
- `grid grid-cols-1 sm:grid-cols-2` for responsive grid
- `mt-1`, `mb-*` for vertical margins only

### RTL Verdict: SAFE
No directional layout issues. The only minor concern is date formatting with no explicit locale.

---

## Responsive Analysis

### Breakpoints Used

| Breakpoint | Usage |
|------------|-------|
| `sm:` | `sm:grid-cols-2` on emoji/threshold grid |
| None for table | Table has no horizontal scroll wrapper |

### Mobile Behavior (< 640px)

- Emoji and threshold inputs stack to 1 column
- Channel ID input has fixed `w-64` which may overflow on very narrow screens (< 280px)
- Entries table renders full-width with no scroll wrapper -- **potential overflow**
- Self-star toggle card is full-width, wraps correctly with `flex justify-between`
- Empty state centers properly

### Tablet Behavior (640px-1023px)

- Emoji/threshold grid becomes 2 columns
- All other elements display normally

### Desktop Behavior (1024px+)

- Full layout with sidebar + content area
- All elements at comfortable widths

### Responsive Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Entries table lacks horizontal scroll wrapper | MEDIUM | 5-column table will overflow on mobile. |
| `w-64` on channel input | LOW | Fixed width could cause slight overflow on extremely narrow viewports. |
| No StatsCards | OBSERVATION | Unlike suggestions/commands pages, starboard has no stats overview section. |

---

## Design System Compliance

### Token Usage

| Category | Compliant | Details |
|----------|-----------|---------|
| Background colors | YES | `bg-surface` on Card |
| Text colors | YES | `text-text-muted`, `text-text-muted/30`, `text-text-muted/60` |
| Typography | YES | Standard Tailwind typography scale |
| Border | YES | `border-border` on self-star toggle card |
| Spacing | YES | Tailwind spacing scale |

### Hardcoded Values Found

| Value | Location | Should Be |
|-------|----------|-----------|
| No hardcoded colors | -- | -- |
| No hardcoded font sizes | -- | -- |

### Missing Design System Patterns

| Pattern | Expected | Found |
|---------|----------|-------|
| `glass-edge` class on Card | Expected per design system | Not applied |
| Stats overview section | Common pattern across pages | Missing -- starboard has no stats cards at the top |
| Skeleton loading | PageSkeleton or Skeleton components | Uses plain text for loading |

---

## Additional Observations

1. **Local state form pattern**: Unlike suggestions (which saves individual settings on blur/toggle), starboard uses a local state form with a single "Save" button. This is a different UX pattern between the two pages -- inconsistency.

2. **Pagination text not i18n**: Line 295: `Page {page} of {totalPages} ({entriesData.total} total)` is hardcoded English, not translated. This is a bug.

3. **Empty state is well-designed**: The entries empty state uses a large star icon (48px) with muted text, which is visually distinct and informative.

4. **NSFW select labels are confusing**: Uses `common:actions.disable` and `common:actions.enable` for "ignore" and "separate" options, which doesn't clearly convey the meaning.

5. **No StatsCard usage**: Unlike the suggestions and commands pages, starboard doesn't display any stats overview. Consider adding total starred messages, threshold, and status counts.

6. **Settings description reuse**: The entries tab description reuses `settings.description` text, which may not make sense contextually.

7. **useEffect sync pattern**: The settings form syncs from server state via `useEffect` with `[settings]` dependency. This is a standard but slightly fragile pattern -- if the user has unsaved changes and settings refetch, local changes will be overwritten.
