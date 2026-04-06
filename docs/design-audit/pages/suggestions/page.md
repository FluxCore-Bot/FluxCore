# Suggestions Page - UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/suggestions.tsx`
**Component:** `SuggestionsPage`
**Namespace:** `suggestions` (i18n)

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
                 -> SuggestionsPage
```

### Component Tree

```
div.space-y-8
  PageHeader (title, subtitle)
  div.grid.grid-cols-1.sm:grid-cols-3.gap-4          [Stats Row]
    StatsCard (totalSuggestions)
    StatsCard (systemStatus)
    StatsCard (channel)
  Tabs (defaultValue="suggestions")
    TabsList
      TabsTrigger ("suggestions")
      TabsTrigger ("settings")
    TabsContent ("suggestions")
      Card.bg-surface.p-6
        div.mb-4.flex.items-center.gap-3              [Filter Bar]
          Label
          Select (status filter)
            SelectTrigger.w-40
            SelectContent
              SelectItem x5 (all, pending, approved, denied, implemented)
        [Loading: p.text-text-muted]
        [Data: Table + Pagination]
        [Empty: p.text-text-muted]
    TabsContent ("settings")
      Card.bg-surface.p-6
        h3.mb-4.text-lg.font-semibold
        [Loading: p.text-text-muted]
        [Settings form: div.space-y-6]
          Switch (enabled)
          Separator
          Input (channelId)
          Separator
          Input (reviewChannelId)
          Separator
          Switch (dmOnStatusChange)
          Separator
          Switch (autoThread)
          Separator
          Switch (anonymousMode / voteEmojis)
  Dialog (status change)
    DialogContent
      DialogHeader > DialogTitle
      Textarea (reason)
      DialogFooter
        Button (cancel, outline)
        Button (confirm)
```

### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Status filter Select | dropdown | Filters suggestions list, resets page to 1 |
| Approve button (ghost) | icon button | Opens status dialog for "approved" |
| Reject button (ghost) | icon button | Opens status dialog for "denied" |
| Implement button (ghost) | icon button | Opens status dialog for "implemented" |
| Delete button (ghost) | icon button | Calls deleteSuggestion directly (no confirmation) |
| Previous/Next pagination | outline buttons | Navigates pages |
| Enabled Switch | toggle | Calls handleToggleSetting("enabled") |
| Channel Input | text input | Saves on blur via handleChannelSetting |
| Review Channel Input | text input | Saves on blur via handleChannelSetting |
| DM on Status Switch | toggle | Calls handleToggleSetting("dmOnStatusChange") |
| Auto Thread Switch | toggle | Calls handleToggleSetting("autoThread") |
| Anonymous Mode Switch | toggle | Calls handleToggleSetting("anonymousMode") |
| Status Dialog Confirm | button | Calls handleStatusChange |
| Status Dialog Cancel | outline button | Closes dialog |

---

## Components Inventory

### shadcn/ui Components Used

| Component | Import Path | Variants/Props Used |
|-----------|------------|---------------------|
| Button | `ui/button` | `variant="ghost"`, `variant="outline"`, default, `size="sm"` |
| Input | `ui/input` | Default, with `id`, `placeholder`, `defaultValue`, `onBlur` |
| Label | `ui/label` | Default, with `htmlFor` |
| Card | `ui/card` | Default with `className="bg-surface p-6"` |
| Switch | `ui/switch` | Default, `checked`, `onCheckedChange` |
| Badge | `ui/badge` | `variant="outline"`, `variant="default"`, `variant="destructive"`, `variant="secondary"` |
| Select, SelectContent, SelectItem, SelectTrigger, SelectValue | `ui/select` | Default |
| Table, TableBody, TableCell, TableHead, TableHeader, TableRow | `ui/table` | Default |
| Separator | `ui/separator` | Default |
| Tabs, TabsContent, TabsList, TabsTrigger | `ui/tabs` | `defaultValue="suggestions"` |
| Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter | `ui/dialog` | Default |
| Textarea | `ui/textarea` | Default, with `id`, `placeholder`, `value`, `onChange` |

### Custom Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| PageHeader | `components/PageHeader` | Page title and subtitle |
| Icon | `components/Icon` | Material icon wrapper (check_circle, cancel, task_alt, delete) |
| StatsCard | `components/StatsCard` | Stats metric card with border-s accent |
| Tabs (shadcn) | `ui/tabs` | Tab navigation between suggestions list and settings |

### States

| State | Loading | Empty | Error | Data |
|-------|---------|-------|-------|------|
| Suggestions list | `p.text-text-muted` "loading" | `p.text-text-muted` "empty" | Toast via ApiError | Table with pagination |
| Settings | `p.text-text-muted` "loading" | N/A (null render) | Toast via ApiError | Form with toggles/inputs |

---

## RTL Analysis

### Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| `formatDate` hardcoded to "en-US" | Line 56-60 | HIGH | `toLocaleDateString("en-US", ...)` ignores user locale. Should use `i18n.language` or omit locale to use browser default. |
| No directional issues in layout | Throughout | OK | Uses `gap-*`, `flex`, `space-y-*` which are direction-agnostic. |
| `justify-between` in pagination | Line 287 | OK | Flexbox `justify-between` mirrors correctly in RTL. |
| `text-left` / `text-right` | N/A | OK | No hardcoded text alignment classes found. |
| `ml-*` / `mr-*` / `pl-*` / `pr-*` | N/A | OK | No physical directional margin/padding classes found. |

### RTL-Safe Patterns Used
- `gap-*` for spacing between elements
- `flex` with `items-center` and `justify-between`
- `space-y-*` for vertical spacing
- `mt-*`, `mb-*` for vertical-only margins

### RTL Verdict: MOSTLY SAFE
The only RTL issue is the hardcoded `"en-US"` locale in `formatDate()`. All layout utilities are direction-agnostic.

---

## Responsive Analysis

### Breakpoints Used

| Breakpoint | Usage |
|------------|-------|
| `sm:` | Stats grid: `sm:grid-cols-3` |
| None for table | Table does not have horizontal scroll wrapper |

### Mobile Behavior (< 640px)

- Stats cards stack to 1 column (`grid-cols-1`)
- Table renders at full width with no horizontal scroll container -- **potential overflow issue** on narrow screens
- Filter bar (`flex items-center gap-3`) may wrap awkwardly
- Pagination stacks naturally via flex
- SelectTrigger `w-40` is a fixed width -- OK for mobile

### Tablet Behavior (640px-1023px)

- Stats grid becomes 3 columns
- Table still has no scroll wrapper

### Desktop Behavior (1024px+)

- Full layout with sidebar (w-60) and content area (max-w-6xl)
- All elements display properly

### Responsive Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Table lacks horizontal scroll wrapper | MEDIUM | On mobile, the 6-column table will overflow. Should wrap in `ScrollArea` or `div.overflow-x-auto`. |
| No `Skeleton` loading state | LOW | Uses plain text "loading" instead of `Skeleton` components for consistent loading UX. |

---

## Design System Compliance

### Token Usage

| Category | Compliant | Details |
|----------|-----------|---------|
| Background colors | YES | `bg-surface` on Card, no hardcoded hex values |
| Text colors | YES | `text-text-muted`, `text-success`, `text-danger`, `text-accent` |
| Typography | PARTIAL | Uses `font-mono`, `font-semibold`, `text-lg`, `text-sm`, `text-xs` but no `font-label` or `section-label` classes |
| Spacing | YES | Uses Tailwind spacing scale consistently |
| Border colors | YES | No hardcoded border colors |
| Shadow | YES | No custom shadows |

### Hardcoded Values Found

| Value | Location | Should Be |
|-------|----------|-----------|
| `"en-US"` | `formatDate()` line 57 | Dynamic from i18n language |
| No hardcoded colors | -- | -- |
| No hardcoded font sizes | -- | -- |

### Missing Design System Patterns

| Pattern | Expected | Found |
|---------|----------|-------|
| `glass-edge` class on Card | Expected per design system | Not applied (Card uses plain `bg-surface p-6`) |
| `section-label` for small labels | Expected for metric labels | Not used (StatsCard handles this internally) |
| Delete confirmation dialog | Expected for destructive actions | Missing -- delete button calls `handleDelete` directly with no confirmation |

---

## Additional Observations

1. **Missing delete confirmation**: The delete button on suggestions calls `handleDelete(s.id)` directly without a confirmation dialog. This is inconsistent with other pages (permissions has a delete confirm dialog).

2. **Mislabeled Switch**: The "Vote Emojis" setting label (`settings.voteEmojis`) controls `anonymousMode` state. The label and the state variable are semantically mismatched.

3. **Duplicate description text**: The channel input description (`settings.channelDesc`) is reused for the enable toggle, review channel, and main channel -- all showing the same helper text.

4. **No skeleton loading**: Uses plain `<p className="text-text-muted">` for loading states instead of `Skeleton` or `PageSkeleton` components used elsewhere.

5. **Badge status mapping**: Uses a `STATUS_BADGE_VARIANT` record for mapping suggestion statuses to badge variants. This is a clean pattern.

6. **Pagination text not i18n-safe for plurals**: `t("pagination.page", { page, total: totalPages })` -- depends on how the i18n key handles interpolation.
