# Leveling Page UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/leveling.tsx`
**Component:** `LevelingPage`
**Lines:** 742

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle)
  div.grid.grid-cols-1.gap-4.sm:grid-cols-3       [Stats row]
    StatsCard (rankedMembers)
    StatsCard (roleRewards)
    StatsCard (systemStatus)
  Tabs (defaultValue="leaderboard")
    TabsList
      TabsTrigger "leaderboard"
      TabsTrigger "settings"
      TabsTrigger "rewards"
      TabsTrigger "exclusions"
      TabsTrigger "multipliers"
    TabsContent "leaderboard"
      Card.bg-surface.p-6
        [Loading | Table + Pagination | Empty]
    TabsContent "settings"
      Card.bg-surface.p-6
        h3 + [Loading | Settings Form | null]
    TabsContent "rewards"
      Card.bg-surface.p-6
        h3 + p + [Loading | Table | Empty] + Separator + Add Form
    TabsContent "exclusions"
      Card.bg-surface.p-6
        h3 + p + Inputs + Button
    TabsContent "multipliers"
      Card.bg-surface.p-6
        h3 + p + [Current Multipliers Tables] + Separator + Add Form
```

### Component Tree

- `PageHeader` -- title/subtitle only, no label or actions
- `StatsCard` x3 -- rankedMembers, roleRewards, systemStatus
- `Tabs` > `TabsList` > `TabsTrigger` x5
- `TabsContent` x5 each containing `Card`
- `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` -- leaderboard, rewards, channel multipliers, role multipliers
- `Button` -- pagination (x2), add reward, save exclusions, add multiplier, remove reward (per row), remove multiplier (per row)
- `Input` -- xpPerMessage, xpCooldown, voiceXpPerMinute, rewardLevel, rewardRole, noXpChannels, noXpRoles, multiplierId, multiplierValue
- `Switch` -- enabled, voiceXpEnabled, announceEnabled
- `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` -- announceChannel (same/dm), multiplierType (channels/roles)
- `Textarea` -- announceMessage
- `Separator` -- multiple, between settings sections, before add forms
- `Label` -- for all form inputs
- `Icon` -- delete icons in reward/multiplier rows

---

## Components Inventory

| Component | Variant/Props | Count | Notes |
|-----------|--------------|-------|-------|
| `PageHeader` | title, subtitle | 1 | No label or actions prop used |
| `StatsCard` | label, value | 3 | No accentColor, no valueClassName, no tooltip |
| `Tabs` | defaultValue="leaderboard" | 1 | Uncontrolled |
| `TabsTrigger` | value | 5 | leaderboard, settings, rewards, exclusions, multipliers |
| `Card` | className="bg-surface p-6" | 5 | One per tab content |
| `Table` | -- | 4 max | Leaderboard, rewards, channel multipliers, role multipliers |
| `Button` | variant="outline" size="sm" | 2 | Pagination prev/next |
| `Button` | variant="ghost" size="sm" | varies | Delete reward, delete multiplier |
| `Button` | default variant | 3 | Add reward, save exclusions, add multiplier |
| `Switch` | checked, onCheckedChange | 3 | enabled, voiceXpEnabled, announceEnabled |
| `Input` | type="number", className="w-24" | 4 | xpPerMessage, xpCooldown, voiceXpPerMinute, multiplierValue |
| `Input` | type="text" | 4 | rewardRole, noXpChannels, noXpRoles, multiplierId |
| `Input` | type="number" min/max | 1 | rewardLevel |
| `Select` | -- | 2 | Announce channel, multiplier type |
| `Textarea` | -- | 1 | Announce message |
| `Separator` | -- | ~8 | Between settings rows, before add forms |
| `Label` | htmlFor | 8 | All labeled inputs |
| `Icon` | name="delete" size={16} className="text-danger" | varies | In ghost buttons |

### Conditional Rendering

- **voiceXpPerMinute** input: only rendered when `settings.voiceXpEnabled` is true
- **Announce channel/message**: only rendered when `settings.announceEnabled` is true
- **Pagination**: only rendered when `totalPages > 1`
- **Channel multipliers table**: only when `settings.xpMultipliers.channels` has entries
- **Role multipliers table**: only when `settings.xpMultipliers.roles` has entries
- **Settings form**: only when `settings` is truthy (not loading, not null)

---

## Interaction Behavior

### Hover/Focus/Active/Disabled States

- **Pagination buttons**: `disabled` when at first/last page; uses shadcn `Button` variant="outline" size="sm" (built-in hover/focus ring)
- **Delete buttons (rewards/multipliers)**: variant="ghost" size="sm"; disabled via `removeReward.isPending`
- **Add reward button**: disabled via `addReward.isPending`
- **Save exclusions button**: disabled via `updateSettings.isPending`
- **Add multiplier button**: disabled via `updateSettings.isPending`
- **Switch components**: standard shadcn toggle behavior
- **Inputs**: standard shadcn focus ring via `focus-visible:ring`

### Click Handlers

| Element | Handler | Side Effect |
|---------|---------|-------------|
| Pagination prev/next | `setPage` | Updates page state |
| Switch (enabled) | `handleToggleSetting("enabled", ...)` | Mutation call + error toast |
| Switch (voiceXp) | `handleToggleSetting("voiceXpEnabled", ...)` | Mutation call + error toast |
| Switch (announce) | `handleToggleSetting("announceEnabled", ...)` | Mutation call + error toast |
| Number inputs | `handleNumberSetting(...)` | Immediate mutation on each change event |
| Announce channel select | `handleAnnounceChannelChange(...)` | Mutation |
| Announce message textarea | `handleAnnounceMessageChange(...)` | Immediate mutation on each change |
| Add reward button | `handleAddReward()` | Validation + mutation + toast |
| Remove reward button | `handleRemoveReward(id)` | Mutation + toast |
| Save exclusions button | `handleSaveExclusions()` | Mutation + toast |
| Add multiplier button | `handleAddMultiplier()` | Validation + mutation + toast |
| Remove multiplier button | `handleRemoveMultiplier(type, id)` | Mutation + toast |

### Form Validation

- **Reward level**: `parseInt`, must be finite, 1-100
- **Reward role**: must be non-empty after trim
- **Multiplier ID**: must be non-empty after trim
- **Multiplier value**: `parseFloat`, must be finite, >0, <=10
- **Number settings**: `parseInt`, must be finite, >=0
- All validation errors shown via `toast.error()`

### Tab Behavior

- Uncontrolled `Tabs` with `defaultValue="leaderboard"`
- 5 tabs: leaderboard, settings, rewards, exclusions, multipliers
- No URL persistence of active tab

---

## Dynamic States

### Loading States

- **Leaderboard tab**: `leaderboardLoading` -> renders `<p className="text-text-muted">{t("loading")}</p>`
- **Settings tab**: `settingsLoading` -> renders `<p className="text-text-muted">{t("loadingGeneric")}</p>`
- **Rewards tab**: `rewardsLoading` -> renders `<p className="text-text-muted">{t("loadingGeneric")}</p>`
- **Stats cards**: show "..." string while loading

### Empty States

- **Leaderboard**: `<p className="text-text-muted">{t("emptyLeaderboard")}</p>` -- plain text, no icon or CTA
- **Rewards**: `<p className="mb-4 text-text-muted">{t("roleRewards.noRewards")}</p>` -- plain text
- **Multipliers**: No explicit empty state for current multipliers section (just hidden)

### Error States

- No dedicated error UI; all errors handled via `toast.error()` from mutation callbacks
- No error boundary or retry mechanism visible

### Success States

- Reward added: `toast.success()` + form reset
- Reward removed: `toast.success()`
- Exclusion updated: `toast.success()`
- Multiplier added: `toast.success()` + form reset
- Multiplier removed: `toast.success()`

---

## RTL Analysis

### Hardcoded LTR Styles

| Location | Class/Style | Issue |
|----------|------------|-------|
| Line 305 | `flex items-center justify-between` | OK -- flexbox mirrors in RTL |
| Line 309 | `flex gap-2` | OK |
| Line 535 | `flex flex-col gap-3 sm:flex-row sm:items-end` | OK -- `flex-row` does not auto-mirror in RTL; items will still flow LTR. Should use logical direction or rely on `dir` attribute |
| Line 692 | `flex flex-col gap-3 sm:flex-row sm:items-end` | Same issue as above |

### Missing Logical Properties

- No usage of `ms-*`/`me-*` (margin-inline-start/end) -- but also no `ml-*`/`mr-*` used in this file, so this is OK
- No `ps-*`/`pe-*` needed
- No `text-left`/`text-right` hardcoded

### Icon Direction

- `Icon name="delete"` -- symmetrical, no RTL concern

### Flex Direction

- `sm:flex-row` on add reward form (line 535) and add multiplier form (line 692): in RTL mode, `flex-row` still renders LTR. Tailwind CSS 4 with `dir="rtl"` on a parent should handle this via the browser's default flex behavior, but only if the HTML `dir` attribute is set. No explicit RTL overrides present.

### Overall RTL Assessment

**Low risk.** No hardcoded `left`/`right`, `ml`/`mr`, `pl`/`pr`, or `text-left`/`text-right`. The page relies on flex and grid which generally respect document direction. The only concern is whether the app root sets `dir="rtl"` for RTL locales.

---

## Responsive Analysis

### Breakpoint Usage

| Breakpoint | Usage | Lines |
|-----------|-------|-------|
| `sm:grid-cols-3` | Stats row: 1 col mobile, 3 cols sm+ | 246 |
| `sm:flex-row sm:items-end` | Add reward form: stacked on mobile, row on sm+ | 535 |
| `sm:flex-row sm:items-end` | Add multiplier form: stacked on mobile, row on sm+ | 692 |

### Mobile Behavior

- Stats cards stack to single column on mobile
- Leaderboard table: **No horizontal scroll wrapper** -- the 6-column table will overflow on small screens
- Rewards table: 3 columns, narrower, more manageable
- Multiplier tables: 3 columns, manageable
- Add forms stack vertically on mobile via `flex-col` -> `sm:flex-row`
- Settings form: `flex items-center justify-between` -- label and control side by side; may be tight on very small screens but functional

### Grid/Flex Responsiveness

- Grid: `grid-cols-1 sm:grid-cols-3` for stats
- Flex: `flex-col sm:flex-row` for add forms
- No `md:` or `lg:` breakpoints used -- only `sm:`

### Potential Issues

1. **Leaderboard table overflow on mobile** -- 6 columns (rank, userId, level, xp, messages, voiceTime) with no horizontal scroll container. The `userId` column with `font-mono` text will be wide.
2. **Multiplier tables** may also overflow if IDs are long, though they only have 3 columns.

---

## Modals/Overlays

**None.** This page uses no Dialog, Popover, DropdownMenu, or other overlay components. All interactions are inline within tab panels.

---

## Design System Compliance

### Color Tokens

| Usage | Value | Compliant? |
|-------|-------|-----------|
| `bg-surface` | Card backgrounds | Yes -- design token |
| `text-text-muted` | Secondary text, loading, empty states | Yes -- design token |
| `text-danger` | Delete icon color | Yes -- design token |
| `font-mono` | IDs, rank numbers | Yes -- maps to JetBrains Mono per design system |

### Typography

| Usage | Classes | Compliant? |
|-------|---------|-----------|
| Tab section title | `text-lg font-semibold` | Yes |
| Sub-heading | `text-sm font-semibold` | Yes |
| Body/description | `text-sm text-text-muted` | Yes |
| Rank number | `font-mono text-xs font-bold` | Yes |
| Table IDs | `font-mono text-xs` | Yes |
| Pagination info | `text-sm text-text-muted` | Yes |

### Spacing

| Pattern | Classes | Notes |
|---------|---------|-------|
| Page vertical rhythm | `space-y-8` | Consistent with other pages |
| Card padding | `p-6` | Standard |
| Stats gap | `gap-4` | Standard |
| Section gap | `space-y-6` | Settings sections |
| Form gap | `gap-3` | Consistent |
| Separator margin | `my-6` | Consistent |

### Component Usage

- All shadcn/ui components used correctly (Button, Input, Label, Card, Switch, Textarea, Select, Table, Separator, Tabs)
- No raw HTML `<select>`, `<input>`, or `<button>` used
- `Icon` component used for Material Symbols

### Hardcoded Values

| Location | Value | Should Be |
|----------|-------|-----------|
| `className="w-24"` | Fixed width on number inputs | Acceptable -- small input fields |
| `className="w-48"` | Fixed width on role/ID inputs | Acceptable |
| `className="w-64"` | Fixed width on announce select | Acceptable |
| `className="w-32"` | Fixed width on multiplier type select | Acceptable |
| `className="w-16"` | Fixed width on rank/action columns | Acceptable -- table column widths |

### Missing Design System Usage

- **No `glass-edge`** class on Cards (StatsCard has it, but main Cards do not)
- **No `section-label`** class on tab content headings (only used inside StatsCard)
- **Loading states** use plain `<p>` text -- no skeleton components used
- **Empty states** are plain text only -- no empty state illustration or icon pattern

---

## Findings Summary

### Issues

1. **Leaderboard table not responsive** -- no horizontal scroll wrapper for 6-column table on mobile
2. **No skeleton loading states** -- just "..." text in stats and plain text in tab content
3. **Empty states lack visual treatment** -- plain muted text, no icon or CTA button
4. **Number/text inputs fire mutations on every keystroke** (`onChange` -> immediate `mutate()` for xpPerMessage, xpCooldown, voiceXpPerMinute, announceMessage) -- no debounce
5. **Exclusion inputs** use a fallback pattern (`noXpChannelsInput || settings?.noXpChannels.join(", ")`) that resets user input if the component re-renders before they save
6. **No error state UI** -- only toast notifications, no inline error messages
7. **Tab state not persisted** in URL -- navigating away and back always resets to "leaderboard"
8. **`w` unit in SelectItem for weeks** is not present in the duration unit select on this page (this is correct, just noting for cross-page consistency)
