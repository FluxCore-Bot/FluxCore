# FluxCore Dashboard — Design Audit & Redesign

**Completed:** 2026-04-06
**Branch:** fix/design-audit-rtl-parity

---

## Documents

| File | Description |
|------|-------------|
| [AUDIT-REPORT.md](AUDIT-REPORT.md) | Comprehensive audit report with 87 issues across RTL, responsive, design system, i18n, and consistency |
| [REDESIGN-SUMMARY.md](REDESIGN-SUMMARY.md) | Summary of all Stitch redesigns, before/after comparison, screen inventory |

## Page Documentation

Each page has a detailed `page.md` documenting structure, components, interactions, states, RTL analysis, responsive behavior, and design system compliance.

| Page | Documentation | Stitch Desktop | Stitch Mobile |
|------|--------------|---------------|---------------|
| [Landing](pages/landing/page.md) | Root layout + landing page | Existing (2) | Existing (4) |
| [Guild Selection](pages/guild-selection/page.md) | Index + guild cards | Existing (2) | Existing (2) |
| [Overview](pages/overview/page.md) | Analytics dashboard | Existing (2) | Existing (2) |
| [Rules](pages/rules/page.md) | Automation rules | Existing (2) | Existing (2) |
| [TempVoice](pages/tempvoice/page.md) | Voice channel config | Existing (2) | Existing (2) |
| [Settings](pages/settings/page.md) | Guild settings | Existing (1) | Existing (2) |
| [Logs](pages/logs/page.md) | Activity + event logs | Existing (1) | Existing (2) |
| [Music](pages/music/page.md) | Music settings + library | Existing (2) | Existing (2) |
| [Warnings](pages/warnings/page.md) | Warning management | **NEW** (2) | Pending |
| [Moderation](pages/moderation/page.md) | Moderation cases | **NEW** (2) | Pending |
| [Welcome](pages/welcome/page.md) | Welcome/farewell config | **NEW** (1) | Pending |
| [Roles](pages/roles/page.md) | Reaction role panels | **NEW** (1) | Pending |
| [Leveling](pages/leveling/page.md) | XP + leaderboard | **NEW** (1) | Pending |
| [Scheduled](pages/scheduled/page.md) | Scheduled messages | **Pending** | Pending |
| [Security](pages/security/page.md) | Anti-raid protection | **NEW** (1) | Pending |
| [Tickets](pages/tickets/page.md) | Support tickets | **NEW** (1) | Pending |
| [Giveaways](pages/giveaways/page.md) | Giveaway management | **NEW** (1) | Pending |
| [Suggestions](pages/suggestions/page.md) | Community suggestions | **NEW** (1) | Pending |
| [Starboard](pages/starboard/page.md) | Message highlights | **NEW** (1) | Pending |
| [Commands](pages/commands/page.md) | Custom commands | **NEW** (1) | Pending |
| [Permissions](pages/permissions/page.md) | Dashboard permissions | **NEW** (1) | Pending |

---

## Issue Summary

### By Severity
- **Critical:** 12 (layout breaks, table overflow, sidebar positioning)
- **Major:** 34 (design system violations, missing confirmations, i18n gaps)
- **Minor:** 41 (polish, consistency, typography)

### By Category
- **RTL Issues:** 18
- **Responsive Issues:** 15
- **Design System Violations:** 28
- **i18n Gaps:** 12
- **Cross-Page Consistency:** 14

### Top Priority Fixes
1. Add `overflow-x-auto` to ALL table containers (7 pages affected)
2. Fix sidebar `left-0` → `start-0`, `ml-60` → `ms-60`
3. Fix Sonner Toaster RTL position
4. Replace `bg-surface` with valid surface tier tokens
5. Add ConfirmDialog to all destructive actions (6 pages)
6. Replace native HTML elements with shadcn components (3 pages)
7. Standardize loading states to PageSkeleton
8. Fix WelcomeImageEditor i18n (50+ strings)
9. Replace raw Tailwind colors with semantic tokens (moderation, logs)
10. Fix Permissions page responsive layout

---

## Stitch Project

- **Project ID:** `15282765930401294642`
- **Design System:** "FluxCore Synthetic" (`b9f375801df949efb36a945e8f0584fb`)
- **Total Screens:** 59+ (was 45 before audit)
- **Full Coverage:** All 20 page types now have desktop Stitch designs
