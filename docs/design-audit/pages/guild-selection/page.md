# Guild Selection Page - UI Audit

**File:** `apps/dashboard/src/client/routes/index.tsx`
**Component:** `IndexPage`
**Namespace:** `guilds` (i18n)

---

## Structure

### Full Layout Hierarchy

```
RootLayout (__root.tsx)
  -> nav (top bar, h-14) [only when authenticated]
  -> main#main-content
       -> IndexPage
```

Note: This page renders at the root route `/` and does NOT have the guild layout or sidebar.

### Component Tree - Four Distinct States

```
[State 1: Auth Loading]
div.flex.items-center.justify-center.pt-32
  div.flex.items-center.gap-3
    Skeleton.h-8.w-8.rounded-full
    Skeleton.h-4.w-32

[State 2: Not Authenticated]
LandingPage (full landing page component)

[State 3: Guilds Loading]
div.mx-auto.max-w-7xl.px-4.py-8.sm:px-6.sm:py-12
  h1.mb-2.text-4xl.font-semibold.tracking-tight
  p.mb-8.text-lg.text-text-muted
  div.grid.grid-cols-1.sm:grid-cols-2.lg:grid-cols-3.xl:grid-cols-4.gap-4
    Skeleton.h-32.w-full.rounded-lg  x8

[State 4a: No Guilds]
div.mx-auto.max-w-7xl.px-4.py-8.sm:px-6.sm:py-12
  h1.mb-2.text-4xl.font-semibold.tracking-tight
  p.text-lg.text-text-muted
  div.py-12
    EmptyState
      icon="dns"
      title
      description
      action: a.inline-flex (invite link button)

[State 4b: Guilds Available]
div.mx-auto.max-w-7xl.px-4.py-8.sm:px-6.sm:py-12
  header.mb-8.flex.flex-col.gap-4.sm:mb-12.sm:flex-row.sm:items-end.sm:justify-between
    div
      h1.mb-2.text-3xl.font-semibold.tracking-tight.sm:text-4xl
      p.text-base.text-text-muted.sm:text-lg
    a (invite link button, conditional on botInfo)
  div.grid.grid-cols-1.sm:grid-cols-2.lg:grid-cols-3.xl:grid-cols-4.gap-4
    GuildCard (per guild)
```

### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Guild cards | clickable cards (Link) | Navigate to `/guild/$guildId/overview` |
| "Add to Server" button | external link | Opens Discord bot invite URL |

---

## Components Inventory

### shadcn/ui Components Used

| Component | Import Path | Variants/Props Used |
|-----------|------------|---------------------|
| Skeleton | `ui/skeleton` | `className="h-8 w-8 rounded-full"`, `className="h-4 w-32"`, `className="h-32 w-full rounded-lg"` |

### Custom Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| GuildCard | `components/GuildCard` | Individual guild card with icon, name, link |
| EmptyState | `components/EmptyState` | No guilds state with icon, title, description, action |
| Icon | `components/Icon` | `add_circle` icon on invite button |
| LandingPage | `components/landing/LandingPage` | Full landing page for unauthenticated users |

### GuildCard Subcomponent

```
Link (to="/guild/$guildId/overview")
  Card.group.relative.border.border-transparent.p-5.transition-all.duration-300.hover:border-outline-variant/20
    div.mb-4
      [Has icon: img.h-16.w-16.rounded-xl.border.border-outline-variant/10.object-cover.shadow-lg]
      [No icon: div.flex.h-16.w-16.items-center.justify-center.rounded-xl.border.text-2xl.font-bold.text-secondary]
    h3.text-lg.font-bold.tracking-tight.text-text.group-hover:text-accent
```

### EmptyState Subcomponent

```
div.flex.flex-col.items-center.justify-center.rounded-lg.bg-surface-low.p-12.text-center.glass-edge
  div.mb-4.flex.h-12.w-12.items-center.justify-center.rounded-full.bg-surface-high
    Icon
  h3.text-lg.font-semibold
  p.mt-1.max-w-sm.text-sm.text-text-muted
  div.mt-4
    [action slot]
```

### States

| State | Trigger | Render |
|-------|---------|--------|
| Auth loading | `authLoading === true` | Centered skeleton (avatar + text) |
| Not authenticated | `!user` | `LandingPage` component |
| Guilds loading | `guildsLoading === true` | Header + 8 skeleton cards in grid |
| No guilds | `guilds.length === 0` | Header + EmptyState with invite action |
| Guilds available | `guilds.length > 0` | Header + guild card grid |

---

## RTL Analysis

### Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| No directional issues | Throughout | OK | All spacing uses direction-agnostic utilities |
| `px-4`, `py-8` | Container padding | OK | Symmetrical padding, no directional concern |
| `inline-flex` on invite button | Lines 63, 87 | OK | Direction-agnostic |
| `sm:flex-row` on header | Line 77 | OK | Flexbox direction mirrors correctly in RTL |
| GuildCard: `mb-4` only | GuildCard.tsx | OK | Vertical margin only |

### RTL-Safe Patterns Used
- `gap-*` for all inter-element spacing
- `px-*` symmetrical padding
- `flex flex-col sm:flex-row` responsive stacking
- `items-center justify-center` for centered content
- `text-center` for centered text

### RTL Verdict: SAFE
No directional issues found. All utilities are direction-agnostic.

---

## Responsive Analysis

### Breakpoints Used

| Breakpoint | Usage |
|------------|-------|
| `sm:` | Container: `sm:px-6 sm:py-12`; Header: `sm:mb-12 sm:flex-row sm:items-end sm:justify-between`; Title: `sm:text-4xl`; Subtitle: `sm:text-lg`; Grid: `sm:grid-cols-2` |
| `lg:` | Grid: `lg:grid-cols-3` |
| `xl:` | Grid: `xl:grid-cols-4` |

### Mobile Behavior (< 640px)

- Title at `text-3xl` (guilds state) or `text-4xl` (loading/empty state -- inconsistency)
- Subtitle at `text-base`
- Grid stacks to 1 column
- Header stacks vertically (`flex-col`)
- Invite button is full-width capable via `w-fit`
- Skeleton cards show 8 items stacked
- Container padding: `px-4 py-8`

### Tablet Behavior (640px-1023px)

- Title at `text-4xl`
- Grid becomes 2 columns
- Header becomes horizontal row
- Container padding: `px-6 py-12`

### Desktop Behavior (1024px+)

- Grid becomes 3 columns at `lg:`
- Grid becomes 4 columns at `xl:`
- Full `max-w-7xl` container

### Responsive Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Inconsistent title size | LOW | Loading state uses `text-4xl`, guilds state uses `text-3xl sm:text-4xl`. Empty state uses `text-4xl`. Should be consistent. |
| Auth loading skeleton is minimal | LOW | Single avatar + text skeleton. Could show more contextual loading UI. |
| No max-width on GuildCard | OBSERVATION | Cards stretch to fill grid column. This is correct behavior for a grid. |

---

## Design System Compliance

### Token Usage

| Category | Compliant | Details |
|----------|-----------|---------|
| Background colors | YES | `bg-accent`, `bg-surface-low`, `bg-surface-high`, `bg-surface-hover` |
| Text colors | YES | `text-text`, `text-text-muted`, `text-bg`, `text-secondary`, `text-accent` |
| Typography | YES | `font-semibold`, `font-bold`, `tracking-tight`, `tracking-tighter` |
| Border | YES | `border-outline-variant/10`, `border-outline-variant/20`, `border-transparent` |
| Shadow | YES | `shadow-lg shadow-accent/20` on invite button |

### Invite Button Styling (repeated twice)

```css
/* Line 63 (empty state) and Line 87 (header) */
inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-5
text-sm font-semibold text-bg shadow-lg shadow-accent/20
transition-all hover:brightness-110 active:scale-[0.98]
```

This is a custom button style, not using the shadcn `Button` component. It should ideally use `<Button>` with an appropriate variant or be extracted into a shared component.

### Hardcoded Values Found

| Value | Location | Should Be |
|-------|----------|-----------|
| `active:scale-[0.98]` | Invite button lines 63, 87 | Custom scale transform -- acceptable for press feedback |
| `hover:brightness-110` | Invite button | Custom brightness filter -- could be a design token |
| `duration-300` | GuildCard hover | Transition duration -- consistent with design system |

### Missing Design System Patterns

| Pattern | Expected | Found |
|---------|----------|-------|
| `glass-edge` on GuildCard | Could enhance the card | Not applied (EmptyState has it) |
| `section-label` for grid header | Could be used | Not applicable here |
| Consistent button component | shadcn Button | Invite link uses custom `<a>` styling instead of Button |

---

## Additional Observations

1. **LandingPage delegation**: When unauthenticated, the entire page delegates to `LandingPage`. This is clean separation -- see the landing page audit for details.

2. **Invite URL conditional**: The invite button only renders if `botInfo?.inviteUrl` exists. Good defensive rendering.

3. **Loading skeleton count**: Shows 8 skeleton cards during loading, which approximates a typical guild count for visual consistency.

4. **GuildCard interaction**: Uses `group` class for hover effects that propagate from Card to h3 text color (`group-hover:text-accent`). Clean pattern.

5. **GuildCard icon fallback**: When guild has no icon, renders first character of guild name in a styled div. Good UX fallback.

6. **No search/filter**: For users with many guilds, there is no search bar or filter mechanism. Consider adding for users with 10+ guilds.

7. **No pagination**: All guilds render in a single grid. For users with many servers, this could be a long page.

8. **EmptyState uses `glass-edge`**: The EmptyState component applies `glass-edge` class, which is proper design system compliance.
