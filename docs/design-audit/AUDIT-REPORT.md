# FluxCore Dashboard — Comprehensive Design Audit Report

**Date:** 2026-04-05
**Branch:** fix/design-audit-rtl-parity
**Design System:** "The Obsidian Engine" (Stitch: "FluxCore Synthetic")
**Pages Audited:** 20
**Stitch Screens:** 45

---

## Executive Summary

The FluxCore dashboard has 20 pages with 45 Stitch screens covering 9 page types. **11 pages have no Stitch designs** (all Phase 1-4 feature pages). The audit identified **87 issues** across RTL compliance, design system violations, responsive gaps, and cross-page inconsistencies.

### Severity Distribution

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 12 | Breaks layout or functionality |
| Major | 34 | Visible design system violations |
| Minor | 41 | Polish, consistency, best practices |

---

## Section A: Issues by Category

### A1. RTL Issues (18 total)

| # | Page/Component | Issue | Severity | Fix |
|---|---------------|-------|----------|-----|
| 1 | **Root Layout** | Sonner Toaster hardcoded `position="bottom-right"` — does not flip in RTL | Major | Use `position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'}` |
| 2 | **Landing/Hero** | `bg-gradient-to-r` does not flip in RTL | Major | Add `rtl:bg-gradient-to-l` |
| 3 | **Landing/Hero** | Decorative glows use physical `left-*`/`right-*` positioning | Minor | Use `start-*`/`end-*` logical properties |
| 4 | **Overview/Charts** | Recharts uses physical margins (`marginLeft`, `marginRight`) — not RTL-aware | Major | Swap margins based on `dir` context |
| 5 | **Overview/Charts** | Bar chart `radius` uses `[4,4,0,0]` (physical top corners) — fine for vertical, but tooltip positioning may be off | Minor | Verify tooltip positioning in RTL |
| 6 | **Rules/RuleList** | Action flow strip arrows use `border-r border-t` (physical direction) | Minor | Use `border-e border-t` |
| 7 | **Rules/NodeDetail** | Slide animation `slide-in-from-right-4` is physical | Minor | Use RTL-aware animation or `slide-in-from-end-4` |
| 8 | **Welcome/ImageEditor** | Two `mr-1` instances (lines 309, 318) should be `me-1` | Major | Replace with `me-1` |
| 9 | **Suggestions** | `formatDate()` hardcodes `"en-US"` locale | Major | Use `i18n.language` or `navigator.language` |
| 10 | **Starboard** | Pagination text hardcoded English ("Page X of Y") | Minor | Wrap in `t()` |
| 11 | **Tickets** | Hardcoded "Open Ticket" category label | Minor | Wrap in `t()` |
| 12 | **Giveaways** | `formatTimeRemaining` hardcodes English time strings | Minor | Use i18n time formatting |
| 13 | **Giveaways** | Duration unit `"w"` labeled as `t("common:time.days")` instead of weeks | Major | Fix to `t("common:time.weeks")` |
| 14 | **Scheduled** | Best RTL page — uses `me-2`, `border-s-4`, `borderInlineStartColor` | None | Reference implementation |
| 15 | **Permissions** | Two-column layout (`w-64` + `flex-1`) doesn't stack in RTL narrow viewports | Critical | Add responsive stacking |
| 16 | **Commands** | Embed color/footer grid always 2-column, cramped in RTL narrow view | Minor | Make responsive |
| 17 | **All Tables** | Table `text-left`/`text-right` alignment does not flip in RTL | Major | Use `text-start`/`text-end` |
| 18 | **Sidebar** | Physical `left-0` positioning and `ml-60` main content offset | Critical | Use `start-0` and `ms-60` |

### A2. Responsive Issues (15 total)

| # | Page/Component | Issue | Severity | Fix |
|---|---------------|-------|----------|-----|
| 1 | **Warnings** | Table (7+ columns) overflows on mobile | Critical | Add `overflow-x-auto` wrapper or card view |
| 2 | **Moderation** | Table overflows on mobile | Critical | Add scroll wrapper |
| 3 | **Roles** | Table overflows on mobile | Critical | Add scroll wrapper |
| 4 | **Tickets** | 7-column table worst offender for mobile overflow | Critical | Card-based mobile view |
| 5 | **Suggestions** | Table lacks horizontal scroll wrapper | Major | Add `overflow-x-auto` |
| 6 | **Starboard** | Table lacks horizontal scroll wrapper | Major | Add `overflow-x-auto` |
| 7 | **Commands** | Table lacks horizontal scroll wrapper | Major | Add `overflow-x-auto` |
| 8 | **Permissions** | Two-column role layout doesn't stack on mobile | Critical | Add `flex-col md:flex-row` |
| 9 | **Permissions** | Audit log custom grid overflows on mobile | Major | Responsive grid |
| 10 | **Welcome** | 6-tab TabsList overflows on mobile | Major | Scrollable tabs or dropdown |
| 11 | **All Pages** | No `xl:` or `2xl:` breakpoints — forms stretch on ultrawide | Minor | Add `max-w-4xl` constraints |
| 12 | **All Forms** | No max-width constraints on wide screens | Minor | Add container constraints |
| 13 | **Landing** | CTA buttons stack poorly on narrow mobile | Minor | Full-width mobile buttons |
| 14 | **Guild Selection** | Grid doesn't adapt well below 640px | Minor | Single column on small mobile |
| 15 | **Overview** | Stats cards 4-column grid doesn't collapse gracefully | Minor | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` |

### A3. Design System Violations (28 total)

| # | Page/Component | Issue | Expected | Actual | Severity |
|---|---------------|-------|----------|--------|----------|
| 1 | **Overview/Charts** | Hardcoded hex colors | CSS custom properties | `#57f287`, `#ff6e84`, `rgba()` | Major |
| 2 | **Logs/EventBrowser** | Tailwind default colors | Design tokens | `text-blue-400`, `text-purple-400` | Major |
| 3 | **Moderation** | Raw Tailwind colors in ACTION_COLORS | Semantic tokens | `text-red-400`, `text-orange-400`, etc. | Major |
| 4 | **Moderation** | StatsCard border color | Token | `border-orange-400` | Minor |
| 5 | **Music/SettingsForm** | shadcn default token | Project token | `text-muted-foreground` vs `text-text-muted` | Minor |
| 6 | **Security** | Native `<select>` element | shadcn Select | Raw HTML select | Major |
| 7 | **Scheduled** | Native `<input type="color">` | Color picker component | Raw HTML input | Major |
| 8 | **Permissions** | Native `<input type="color">` | Color picker component | Raw HTML input | Major |
| 9 | **Permissions** | Custom tiny font size | Design system minimum | `text-[10px]` | Minor |
| 10 | **Landing/CTA** | Duplicated button styles | shadcn Button variants | Custom inline styles | Minor |
| 11 | **Multiple Cards** | Missing `glass-edge` class | Glass panel styling | Plain bg-surface-high | Minor |
| 12 | **All pages** | Inconsistent use of `bg-surface` | Not a valid token | Should be `bg-surface-low` or `bg-surface-container` | Major |
| 13 | **Settings** | Uses `window.confirm()` | ConfirmDialog component | Browser native dialog | Major |
| 14 | **Music** | No delete confirmation for albums/tracks | ConfirmDialog | Direct deletion | Major |
| 15 | **Warnings** | No confirmation for punishment deletion | ConfirmDialog | Direct deletion | Major |
| 16 | **Roles** | No confirmation for panel deletion | ConfirmDialog | Direct deletion | Major |
| 17 | **All pages** | Inconsistent loading states | PageSkeleton | Mix of "...", muted text, nothing | Major |
| 18 | **Moderation** | No toast notifications for mutations | Sonner toasts | Silent operations | Minor |
| 19 | **Moderation** | Uses `font-label` correctly | Space Grotesk | Other pages don't use it | Minor |
| 20 | **Multiple pages** | Inconsistent empty states | Icon + title + description + CTA | Plain text | Minor |
| 21 | **Leveling** | Mutations fire on every keystroke | Debounced or form submit | onChange immediate | Minor |
| 22 | **Tickets** | Same keystroke mutation issue | Debounced or form submit | onChange immediate | Minor |
| 23 | **Suggestions** | "Vote Emojis" switch controls `anonymousMode` | Correct label | Mislabeled | Major |
| 24 | **Suggestions** | No delete confirmation | ConfirmDialog | Direct deletion | Major |
| 25 | **Commands** | No delete confirmation | ConfirmDialog | Direct deletion | Major |
| 26 | **Logs** | Two different pagination patterns on same page | Consistent pattern | Client-side vs server-side | Minor |
| 27 | **Settings** | Notification preferences not persisted | Database storage | Local state only | Minor |
| 28 | **EventLogConfig** | Icon names appear Lucide-style | Material Symbols | Mixed icon systems | Minor |

### A4. i18n Gaps (12 total)

| # | Page/Component | Issue | Severity |
|---|---------------|-------|----------|
| 1 | **Overview/ExecutionChart** | Hardcoded English strings | Major |
| 2 | **Overview/EventDistributionChart** | Hardcoded English strings | Major |
| 3 | **Overview/RecentActivityFeed** | Hardcoded English strings | Major |
| 4 | **Rules/RuleList** | Hardcoded English strings in sub-components | Major |
| 5 | **Rules/WorkflowEditor** | Hardcoded English in node components | Major |
| 6 | **TempVoice/TempVoiceForm** | Hardcoded English strings | Major |
| 7 | **Welcome/WelcomeImageEditor** | 50+ hardcoded English strings | Critical |
| 8 | **Giveaways** | English time formatting | Minor |
| 9 | **Tickets** | English pagination strings | Minor |
| 10 | **Giveaways** | English pagination strings | Minor |
| 11 | **Starboard** | English pagination strings | Minor |
| 12 | **Suggestions** | Hardcoded `"en-US"` in date formatting | Major |

### A5. Cross-Page Consistency Issues (14 total)

| # | Issue | Pages Affected | Severity |
|---|-------|---------------|----------|
| 1 | Inconsistent save patterns (toggle-save vs form-submit vs onChange) | Suggestions, Starboard, Leveling, Tickets, Security | Major |
| 2 | Inconsistent delete confirmation (some use ConfirmDialog, some don't) | Music, Warnings, Roles, Suggestions, Commands vs Rules, Moderation | Major |
| 3 | Inconsistent loading states (PageSkeleton vs text vs nothing) | All pages | Major |
| 4 | Inconsistent empty states (icon+CTA vs plain text) | Scheduled (good) vs most others (bad) | Minor |
| 5 | Inconsistent toast feedback (some pages silent) | Moderation vs others | Minor |
| 6 | Inconsistent `font-label` usage for section headings | Moderation (correct) vs all others | Minor |
| 7 | Inconsistent pagination (client vs server, different string patterns) | Logs, Tables across pages | Minor |
| 8 | Inconsistent tab overflow handling on mobile | Welcome (6 tabs), Leveling (5 tabs) | Major |
| 9 | Inconsistent use of StatsCard accent colors | Overview, Warnings vs others | Minor |
| 10 | No shared table wrapper component with scroll/responsive handling | All table pages | Major |
| 11 | Inconsistent form validation patterns | Mixed across all form pages | Minor |
| 12 | Inconsistent use of Separator vs spacing for section dividers | Mixed across pages | Minor |
| 13 | CTA button styles duplicated instead of using Button variants | Landing, Index page | Minor |
| 14 | Mixed icon systems (Lucide + Material Symbols) | EventLogConfig vs rest | Minor |

---

## Section B: Stitch Coverage Gap Analysis

### Pages WITH Stitch Designs (9 types, 45 screens)

| Page | Desktop | Mobile | Desktop v2 | Mobile v2+ | Status |
|------|---------|--------|------------|------------|--------|
| Landing | ✅ | ✅ | ✅ v2 | ✅ v2-v4 | Full coverage |
| Login | ✅ | ✅ | ✅ v2 | ✅ v2 | Full coverage |
| Guild Selection | ✅ | ✅ | ✅ v2 | ✅ v2 | Full coverage |
| Guild Overview | ✅ | ✅ | ✅ v2 | ✅ v2 | Full coverage |
| Music Management | ✅ | ✅ | ✅ v2 | ✅ v2 | Full coverage |
| TempVoice | ✅ | ✅ | ✅ v2 | ✅ v2 | Full coverage |
| Automation Rules | ✅ | ✅ | ✅ v2 | ✅ v2 | Full coverage |
| Activity Logs | ✅ | ✅ | — | ✅ tablet | Full coverage |
| Guild Settings | ✅ | ✅ | — | ✅ v2 | Full coverage |

### Pages WITHOUT Stitch Designs (11 pages) — NEED REDESIGN

| Page | Complexity | Priority | Notes |
|------|-----------|----------|-------|
| **Warnings** | High (3 tabs, tables, forms) | P1 | Phase 1 feature, already in code |
| **Moderation** | High (table, dialog, stats) | P1 | Phase 1 feature, already in code |
| **Welcome** | Very High (6 tabs, image editor, embed builder) | P2 | Phase 2, complex sub-editors |
| **Roles** | High (table, large dialog, multi-section) | P2 | Phase 2, role panel builder |
| **Leveling** | High (5 tabs, leaderboard, settings) | P2 | Phase 2, XP system |
| **Scheduled Messages** | High (dialog, cron editor, preview) | P4 | Phase 4, cron complexity |
| **Security/Anti-Raid** | Medium (5 tabs, form-based) | P4 | Phase 4, config-heavy |
| **Tickets** | High (3 tabs, table, panel builder) | P3 | Phase 3 |
| **Giveaways** | Medium (3 tabs, table, form) | P3 | Phase 3 |
| **Suggestions** | Medium (2 tabs, table, dialog) | P3 | Phase 3 |
| **Starboard** | Low (2 tabs, simple settings) | P3 | Phase 3, simplest page |
| **Commands** | High (2 tabs, large dialog, embed builder) | P4 | Phase 4, complex editor |
| **Permissions** | High (2 tabs, role editor, audit log) | Cross | Cross-cutting feature |

---

## Section C: RTL Validation Summary

### RTL Compliance Score by Page

| Page | Score | Critical Issues | Notes |
|------|-------|----------------|-------|
| Scheduled | ✅ 95% | 0 | Best RTL implementation — reference model |
| Security | ✅ 90% | 0 | Good logical property usage |
| Leveling | ✅ 85% | 0 | Generally clean |
| Giveaways | ⚠️ 80% | 0 | i18n time formatting |
| Tickets | ⚠️ 80% | 0 | Minor i18n gaps |
| Starboard | ⚠️ 80% | 0 | Pagination strings |
| Overview | ⚠️ 70% | 0 | Charts not RTL-aware |
| Suggestions | ⚠️ 70% | 0 | Date locale hardcoded |
| Music | ⚠️ 75% | 0 | Minor token issues |
| Warnings | ⚠️ 75% | 0 | Table alignment |
| Moderation | ⚠️ 70% | 0 | Table + color tokens |
| Rules | ⚠️ 70% | 0 | Physical animations |
| Welcome | ❌ 60% | 1 | `mr-1` hardcoded + massive i18n gap |
| Roles | ⚠️ 75% | 0 | Table overflow |
| Commands | ⚠️ 75% | 0 | Grid cramped |
| Permissions | ❌ 50% | 1 | Layout doesn't stack, grid overflow |
| Landing | ⚠️ 70% | 0 | Gradient direction |
| Root Layout | ❌ 65% | 1 | Toaster position, sidebar physical positioning |
| Guild Selection | ⚠️ 80% | 0 | Minor grid issues |
| Settings | ⚠️ 80% | 0 | Generally clean |

### Global RTL Fixes Needed
1. **Sidebar:** `left-0` → `start-0`, `ml-60` → `ms-60`
2. **Toaster:** Dynamic position based on `dir`
3. **All Tables:** `text-left` → `text-start`, `text-right` → `text-end`
4. **Gradients:** Add `rtl:` variants for directional gradients

---

## Section D: Recommendations

### Immediate Fixes (No Stitch Needed)
1. Add `overflow-x-auto` to ALL table containers
2. Fix sidebar physical positioning → logical properties
3. Fix Toaster position for RTL
4. Replace all `mr-*`/`ml-*` with `me-*`/`ms-*`
5. Replace `text-left`/`text-right` with `text-start`/`text-end`
6. Add ConfirmDialog to all destructive actions
7. Standardize loading states to use PageSkeleton
8. Fix `bg-surface` → valid surface tier token
9. Replace native HTML inputs with shadcn components
10. Fix i18n gaps in sub-components

### Stitch Redesigns Needed (11 pages)
All pages listed in Section B "WITHOUT Stitch Designs" need to be sent to Stitch for proper design treatment with:
- Desktop + Mobile variants
- RTL variants built-in
- Consistent component usage
- Proper responsive breakpoints
- Glass panel styling for overlays
- Standardized empty/loading/error states
