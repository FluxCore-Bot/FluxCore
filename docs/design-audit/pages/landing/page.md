# Root Layout + Landing Page - UI Audit

**Files:**
- `apps/dashboard/src/client/routes/__root.tsx` (RootLayout)
- `apps/dashboard/src/client/routes/guild/$guildId.tsx` (GuildLayout)
- `apps/dashboard/src/client/components/landing/LandingPage.tsx`
- `apps/dashboard/src/client/components/landing/HeroSection.tsx`
- `apps/dashboard/src/client/components/landing/FeaturesSection.tsx`
- `apps/dashboard/src/client/components/landing/CTASection.tsx`
- `apps/dashboard/src/client/components/landing/Footer.tsx`
- `apps/dashboard/src/client/components/Sidebar.tsx`

---

## Part 1: Root Layout (`__root.tsx`)

### Component: `RootLayout`

### Structure

```
MobileSidebarContext.Provider
  TooltipProvider
    div.min-h-screen.flex.flex-col
      a (skip-to-content link, sr-only, WCAG AA)
      [Conditional: user authenticated]
        nav.sticky.top-0.z-50.flex.h-14.w-full.items-center.justify-between.border-b.border-border/50.bg-surface-low.px-3.sm:px-6
          [Left side]
          div.flex.items-center.gap-3.sm:gap-8
            [Conditional: params.guildId]
              Tooltip > Button (hamburger, ghost, icon, lg:hidden)
            Link (to="/", brand name)
          [Right side]
          div.flex.items-center.gap-1.sm:gap-2
            Tooltip > Button (notifications, ghost, icon)
            Tooltip > Button (settings, ghost, icon, hidden sm:inline-flex)
            [Conditional: params.guildId]
              RefreshDataWidget
            Separator (vertical, hidden sm:block)
            LanguageSwitcher
            Separator (vertical, hidden sm:block)
            span (username, hidden sm:inline)
            a (logout link)
      main#main-content.flex-1 (role="main")
        Outlet
      Toaster (position="bottom-right")
```

### Interactive Elements (Nav)

| Element | Type | Behavior |
|---------|------|----------|
| Skip to content | sr-only link | Jumps to #main-content on focus (keyboard navigation) |
| Hamburger button | ghost icon button | Toggles mobile sidebar (lg:hidden) |
| Brand link | Link | Navigates to `/` |
| Notifications button | ghost icon button | Placeholder (no action defined) |
| Settings button | ghost icon button | Placeholder (hidden on mobile) |
| RefreshDataWidget | custom component | Refreshes guild data |
| LanguageSwitcher | custom component | Changes UI language |
| Logout link | anchor | Navigates to `/auth/logout` |

### RTL Analysis (Root Layout)

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| `focus:inset-s-2` on skip link | Line 30 | OK | Logical property, RTL-safe |
| `px-3 sm:px-6` on nav | Line 38 | OK | Symmetrical padding |
| No `ml-*`/`mr-*` | Throughout | OK | Uses `gap-*` and `mx-*` |
| `hidden sm:block` separators | Lines 82, 84 | OK | Visibility, not directional |
| `hidden sm:inline-flex` on settings | Line 75 | OK | Visibility |
| `hidden sm:inline` on username | Line 85 | OK | Visibility |

**RTL Verdict: SAFE** -- Uses logical properties where needed, all layout is direction-agnostic.

### Responsive Analysis (Root Layout)

| Breakpoint | Usage |
|------------|-------|
| `sm:` | Nav padding `sm:px-6`; hamburger gap `sm:gap-8`; right side gap `sm:gap-2`; settings visible `sm:inline-flex`; separators visible `sm:block sm:mx-2`; username visible `sm:inline`; logout padding `sm:px-3` |
| `lg:` | Hamburger hidden `lg:hidden` (only shows on mobile/tablet) |

**Mobile behavior**: Settings button hidden, username hidden, separators hidden, logout has compact padding. Hamburger visible when inside a guild.

### Design System Compliance (Root Layout)

| Category | Compliant | Details |
|----------|-----------|---------|
| Nav background | YES | `bg-surface-low` |
| Nav border | YES | `border-border/50` |
| Nav shadow | CUSTOM | `shadow-[0px_1px_0px_0px_rgba(255,255,255,0.05)]` -- subtle white line effect |
| Typography | YES | `text-sm font-medium tracking-tight` |
| Hover states | YES | `hover:bg-surface-high hover:text-text` on logout |
| Accessibility | EXCELLENT | Skip link, `aria-label` on nav, `aria-expanded` on hamburger, `role="main"` on main |

### Hardcoded Values

| Value | Location | Notes |
|-------|----------|-------|
| `shadow-[0px_1px_0px_0px_rgba(255,255,255,0.05)]` | Nav line 38 | Custom subtle top-border shadow. Acceptable design decision. |
| `z-50` | Nav | Standard z-index layer |
| `h-14` | Nav height | Fixed nav height (56px) |
| `position="bottom-right"` | Toaster | Hardcoded position -- in RTL should be `bottom-left`. **RTL ISSUE.** |

---

## Part 2: Guild Layout (`$guildId.tsx`)

### Component: `GuildLayout`

### Structure

```
div.flex.min-h-[calc(100vh-56px)]
  [Conditional: isOpen]
    div.fixed.inset-0.z-40.bg-black/60.backdrop-blur-sm.lg:hidden  [Backdrop]
  Sidebar (guildId, isOpen, onClose)
  main.w-full.min-h-full.lg:ms-60
    div.mx-auto.max-w-6xl.p-4.sm:p-6.lg:p-8
      Outlet
```

### RTL Analysis (Guild Layout)

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| `lg:ms-60` | Line 28 | OK | Logical property (margin-start), RTL-safe |
| `min-h-[calc(100vh-56px)]` | Line 17 | OK | Not directional |
| `inset-0` on backdrop | Line 21 | OK | Full screen overlay |

**RTL Verdict: SAFE**

### Responsive Analysis (Guild Layout)

| Breakpoint | Usage |
|------------|-------|
| `sm:` | Content padding `sm:p-6` |
| `lg:` | Content padding `lg:p-8`; main margin `lg:ms-60`; backdrop hidden `lg:hidden` |

**Mobile**: No sidebar margin, sidebar is an overlay. Content padding is `p-4`.
**Desktop**: Sidebar takes 240px (w-60), content has `ms-60` offset.

---

## Part 3: Sidebar (`Sidebar.tsx`)

### Structure

```
aside.fixed.inset-s-0.top-14.z-50.flex.h-[calc(100vh-56px)].w-60.flex-col.border-e.border-border.bg-bg.p-4
  [Mobile close button, lg:hidden]
  Tooltip > button
    Icon (close)
  [Brand section]
  div.mb-8.flex.items-center.gap-3.px-2
    div.flex.h-8.w-8 (accent icon container)
      Icon (bolt)
    div
      h1.font-label.font-bold.text-accent
      div (status: online dot + latency)
  [Navigation]
  ScrollArea.flex-1
    nav (aria-label)
      ul.space-y-1 (role="list")
        li per navItem
          Tooltip > Link
            Icon + span
  [Footer]
  div.mt-auto.space-y-4.pt-4
    Separator
    a (invite link, bg-accent/10)
    a (docs link)
    a (support link)
    Link (back to servers, with rtl:rotate-180 on arrow icon)
```

### Navigation Items (18 total)

| Path | i18n Key | Icon | Permission |
|------|----------|------|------------|
| overview | nav.overview | dashboard | -- |
| rules | nav.automation | bolt | actions.rules.view |
| music | nav.music | library_music | music.settings.view |
| tempvoice | nav.tempvoice | settings_voice | tempvoice.config.view |
| welcome | nav.welcome | waving_hand | welcome.config.view |
| moderation | nav.moderation | shield | moderation.cases.view |
| warnings | nav.warnings | warning | moderation.warnings.view |
| roles | nav.rolePanels | badge | roles.panels.view |
| leveling | nav.leveling | trending_up | leveling.leaderboard.view |
| scheduled | nav.scheduled | schedule | scheduled.messages.view |
| commands | nav.commands | terminal | commands.list.view |
| security | nav.security | security | security.config.view |
| tickets | nav.tickets | confirmation_number | tickets.list.view |
| giveaways | nav.giveaways | celebration | giveaways.list.view |
| suggestions | nav.suggestions | lightbulb | suggestions.list.view |
| starboard | nav.starboard | star | starboard.entries.view |
| logs | nav.logs | description | logging.entries.view |
| permissions | nav.permissions | admin_panel_settings | dashboard.roles.view |
| settings | nav.settings | tune | dashboard.settings.manage |

### RTL Analysis (Sidebar)

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| `inset-s-0` | Line 58 | OK | Logical property (start edge) |
| `border-e` | Line 58 | OK | Logical property (end border) |
| `translate-x-0 rtl:translate-x-0` | Line 60 (open) | OK | Explicit RTL handling |
| `-translate-x-full rtl:translate-x-full` | Line 61 (closed) | OK | Explicit RTL handling |
| `lg:translate-x-0 rtl:lg:translate-x-0` | Line 58 | OK | Explicit RTL handling for desktop |
| `rtl:rotate-180` on back arrow | Line 170 | EXCELLENT | Flips arrow icon for RTL |
| `pe-2` on nav | Line 99 | OK | Logical property (padding-end) |
| `ms-auto` on Badge in sidebar | N/A (in Permissions page) | OK | N/A here |

**RTL Verdict: EXCELLENT** -- Has explicit `rtl:` prefixed classes for sidebar slide animation. Uses logical properties throughout. Arrow icon rotation for RTL. Best RTL handling in the codebase.

### Responsive Analysis (Sidebar)

| Breakpoint | Usage |
|------------|-------|
| `lg:` | `lg:z-auto lg:translate-x-0 rtl:lg:translate-x-0` -- sidebar always visible on desktop; close button `lg:hidden` |

**Mobile/Tablet**: Sidebar is a fixed overlay, slides in from the start edge. Controlled by `isOpen` prop via MobileSidebarContext.
**Desktop**: Sidebar is always visible, positioned fixed.

### Active State Styling

```css
/* Active nav item */
bg-surface-high font-semibold text-accent shadow-[0px_0px_12px_0px_rgba(163,166,255,0.1)]

/* Inactive nav item */
text-text-muted hover:bg-surface-high/50 hover:text-text
```

The active shadow uses a hardcoded RGBA value `rgba(163,166,255,0.1)` which is the accent color (#a3a6ff) at 10% opacity.

---

## Part 4: Landing Page Components

### LandingPage (`LandingPage.tsx`)

```
div.flex.min-h-screen.flex-col.bg-bg
  HeroSection
  FeaturesSection
  CTASection
  Footer
```

### HeroSection (`HeroSection.tsx`)

#### Structure

```
section.relative.flex.min-h-[85vh].items-center.justify-center.overflow-hidden.px-4.py-20.sm:min-h-[90vh].sm:px-6.sm:py-32
  [Background glow]
  div.pointer-events-none.absolute.inset-0
    div.absolute.left-1/2.top-1/3.h-[600px].w-[600px].-translate-x-1/2.-translate-y-1/2.rounded-full.bg-accent/5.blur-[120px]
    div.absolute.right-1/4.top-2/3.h-[400px].w-[400px].rounded-full.bg-secondary/5.blur-[100px]
  div.relative.z-10.mx-auto.max-w-4xl.text-center
    [Badge]
    div.mb-8.inline-flex.items-center.gap-2.rounded-full.bg-surface-low.px-4.py-2.glass-edge
      span (animated ping dot)
      span.section-label.text-accent
    [Headline]
    h1.mb-6.text-5xl.font-extrabold.leading-[1.1].tracking-tighter.text-text.md:text-7xl
      span.bg-gradient-to-r.from-accent.to-secondary.bg-clip-text.text-transparent
    [Subtitle]
    p.mx-auto.mb-10.max-w-2xl.text-lg.leading-relaxed.text-text-muted.md:text-xl
    [CTA Buttons]
    div.flex.flex-col.items-center.justify-center.gap-4.sm:flex-row
      a (Add to Server, primary CTA)
      a (Open Dashboard, secondary CTA)
      a (Explore Features, tertiary CTA)
    [Stats Strip]
    div.mt-12.grid.grid-cols-2.gap-6.sm:mt-16.sm:flex.sm:flex-wrap.sm:items-center.sm:justify-center.sm:gap-8.md:gap-12
      div.text-center (per stat)
        p.font-mono.text-xl.font-bold.text-text-secondary.sm:text-2xl
        p.section-label
```

#### RTL Issues (HeroSection)

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| `left-1/2` on background glow | Line 12 | LOW | Background decoration. Physical property but purely decorative -- no functional impact. |
| `right-1/4` on background glow | Line 13 | LOW | Same as above -- decorative. |
| `-translate-x-1/2` | Line 12 | LOW | Used with `left-1/2` for centering. Decorative element. |
| `bg-gradient-to-r` | Line 32 | MEDIUM | Gradient direction is hardcoded LTR. In RTL, gradient should flow `to-l`. Should use `bg-gradient-to-r rtl:bg-gradient-to-l` or use logical gradient. |

#### Responsive (HeroSection)

| Breakpoint | Usage |
|------------|-------|
| `sm:` | Min height `sm:min-h-[90vh]`, padding `sm:px-6 sm:py-32`, CTA buttons `sm:flex-row`, stats `sm:mt-16 sm:flex sm:gap-8` |
| `md:` | Title `md:text-7xl`, subtitle `md:text-xl`, stats gap `md:gap-12` |

**Mobile**: Title 5xl, CTA buttons stacked, stats in 2-column grid.
**Desktop**: Title 7xl, CTA buttons in row, stats in flex wrap.

### FeaturesSection (`FeaturesSection.tsx`)

#### Structure

```
section#features.px-4.py-16.sm:px-6.sm:py-24
  div.mx-auto.max-w-6xl
    div.mb-16.text-center
      p.mb-3.section-label.text-accent
      h2.mb-4.text-3xl.font-bold.tracking-tight.text-text.md:text-4xl
      p.mx-auto.max-w-lg.text-text-muted
    div.grid.grid-cols-1.gap-5.md:grid-cols-2.lg:grid-cols-3
      div.group.rounded-lg.bg-surface-low.p-6.transition-all.duration-300.hover:bg-surface-high.glass-edge
        div.mb-4.inline-flex.rounded-lg.bg-accent/10.p-2.5
          Icon
        h3.mb-2.text-base.font-semibold.tracking-tight.text-text
        p.text-sm.leading-relaxed.text-text-muted
```

6 feature cards: automation, music, tempVoice, logs, webhooks, dashboard.

#### RTL: SAFE -- No directional issues. Grid and centered text are direction-agnostic.

#### Responsive

| Breakpoint | Usage |
|------------|-------|
| `sm:` | Padding `sm:px-6 sm:py-24` |
| `md:` | Title `md:text-4xl`, grid `md:grid-cols-2` |
| `lg:` | Grid `lg:grid-cols-3` |

### CTASection (`CTASection.tsx`)

#### Structure

```
section.px-4.py-16.sm:px-6.sm:py-24
  div.relative.mx-auto.max-w-4xl.overflow-hidden.rounded-2xl.bg-surface-low.p-8.text-center.sm:p-12.md:p-16.glass-edge
    [Background glow]
    div.relative.z-10
      h2.mb-4.text-3xl.font-bold.tracking-tight.text-text.md:text-4xl
      p.mx-auto.mb-8.max-w-lg.text-text-muted
      div.flex.flex-col.items-center.justify-center.gap-4.sm:flex-row
        a (Add to Server, primary)
        a (Open Dashboard, secondary)
```

#### RTL Issues

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| `left-1/2` on background glow | Line 13 | LOW | Decorative, same as HeroSection |

#### Responsive

| Breakpoint | Usage |
|------------|-------|
| `sm:` | Padding `sm:p-12`, buttons `sm:flex-row` |
| `md:` | Padding `md:p-16`, title `md:text-4xl` |

### Footer (`Footer.tsx`)

#### Structure

```
footer.border-t.border-outline-variant/10.bg-bg.px-4.py-8.sm:px-6.sm:py-12
  div.mx-auto.flex.max-w-6xl.flex-col.items-center.justify-between.gap-6.md:flex-row
    div.flex.flex-col.gap-2
      div.flex.items-center.gap-2
        Icon (bolt)
        span.font-bold.tracking-tighter.text-text
      p.text-xs.text-text-tertiary (copyright)
    nav.flex.flex-wrap.justify-center.gap-4.sm:gap-8
      a.text-xs.text-text-tertiary (per link, 5 links)
```

#### RTL: SAFE -- Flexbox layout, `justify-between`/`justify-center`, `flex-wrap`.

#### Responsive

| Breakpoint | Usage |
|------------|-------|
| `sm:` | Padding `sm:px-6 sm:py-12`, link gap `sm:gap-8` |
| `md:` | Layout `md:flex-row` (horizontal on desktop) |

**Mobile**: Footer stacks vertically, centered. Links wrap.
**Desktop**: Footer is horizontal with brand left, links right.

---

## Design System Compliance Summary (All Landing Components)

### Token Usage

| Category | Compliant | Details |
|----------|-----------|---------|
| Background | YES | `bg-bg`, `bg-surface-low`, `bg-surface-high`, `bg-surface-hover`, `bg-accent`, `bg-accent/5`, `bg-accent/10`, `bg-secondary/5` |
| Text | YES | `text-text`, `text-text-muted`, `text-text-secondary`, `text-text-tertiary`, `text-bg`, `text-accent` |
| Typography | EXCELLENT | `section-label`, `font-label` (sidebar), `font-mono`, `tracking-tight`, `tracking-tighter` |
| Effects | YES | `glass-edge` on badge, feature cards, CTA card, EmptyState |
| Borders | YES | `border-border`, `border-border/50`, `border-outline-variant/10`, `border-outline-variant/20` |

### Hardcoded Values

| Value | Location | Notes |
|-------|----------|-------|
| `min-h-[85vh]` / `min-h-[90vh]` | HeroSection | Acceptable viewport-relative values |
| `h-[600px]` / `w-[600px]` / `h-[400px]` / `w-[400px]` | Background glows | Decorative elements, acceptable |
| `blur-[120px]` / `blur-[100px]` / `blur-[80px]` | Background glows | Decorative blur, acceptable |
| `leading-[1.1]` | Hero title | Custom line height for large display text |
| `shadow-[0px_0px_12px_0px_rgba(163,166,255,0.1)]` | Sidebar active item | Accent glow shadow |
| `shadow-[0px_1px_0px_0px_rgba(255,255,255,0.05)]` | Nav bar | Subtle white line |
| `active:scale-[0.98]` | CTA buttons | Press feedback |
| `hover:brightness-110` | CTA buttons | Hover effect on accent buttons |

### CTA Button Styles (Duplicated)

The primary CTA button style is duplicated across HeroSection, CTASection, and IndexPage:

```css
group inline-flex h-12 items-center gap-2.5 rounded-lg bg-accent px-8
font-semibold text-bg shadow-lg shadow-accent/20 transition-all duration-200
hover:brightness-110 active:scale-[0.98]
```

This should be extracted into a shared component or Button variant.

### Secondary CTA Button Styles (Duplicated)

```css
inline-flex h-12 items-center gap-2.5 rounded-lg border border-outline-variant/20
bg-surface-low px-8 font-semibold text-text transition-all duration-200
hover:bg-surface-high active:scale-[0.98]
```

Also duplicated across sections.

---

## Cross-Cutting RTL Issue

**Toaster position**: In `__root.tsx`, the Sonner Toaster uses `position="bottom-right"`. In RTL layouts, toast notifications should appear at `bottom-left`. This is a global issue affecting all pages.

---

## Cross-Cutting Accessibility Strengths

1. **Skip to content link**: `sr-only focus:not-sr-only` pattern with proper z-index and styling
2. **ARIA labels**: Nav has `aria-label`, hamburger has `aria-label` and `aria-expanded`
3. **Main landmark**: `role="main"` on `<main>` element
4. **Sidebar nav**: `aria-label` on nav, `role="list"` on ul, `aria-current="page"` on active link
5. **Status indicator**: `aria-hidden="true"` on decorative elements (online dot, separator)
6. **TooltipProvider**: Wraps entire app for consistent tooltip behavior
7. **Keyboard navigation**: Skip link and proper focus management
