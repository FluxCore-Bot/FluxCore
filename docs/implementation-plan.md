# FluxCore Implementation Plan

> **Created:** 2026-03-24
> **Status:** Active
> **Purpose:** Agent-friendly master plan for all planned features. Each feature links to a detailed spec in `docs/features/`.

---

## Decision Log

### Skipped Features (Discord Native Covers These)

These features are handled well enough by Discord's built-in tools. No bot implementation needed.

| Feature | Discord Native Tool | Why Skip |
|---------|-------------------|----------|
| Polls | Native polls (Apr 2024) — 10 options, duration presets, vote tracking | Good enough for 90% of use cases |
| AutoMod Keyword Filters | 6 KEYWORD rules, 1000 keywords each, wildcards + regex | Strong native implementation |
| AutoMod Spam Detection | ML-trained content spam + mention spam filter | Discord's ML beats any bot |
| Timeout | Native timeout: 60s–1 week, audit logged, AutoMod can auto-apply up to 4 weeks | Complete — we use it, not replace it |
| Onboarding | Full onboarding flow with customization questions, role/channel assignment | Very strong native |
| Server Guide | Welcome sign, new member to-dos, resource pages | Good native |
| Welcome Screen | Recommended channels with descriptions | Basic but sufficient for channel discovery |
| Verification Levels | 5 levels: None → Email → 5min → 10min → Phone | Good native |
| Forum Channels | Structured threads with tags, sorting | Complete native |
| Threads | Auto-archive, public/private | Complete native |
| Slowmode | Per-channel message rate limiting | Complete native |
| Server Insights | Member growth, activity, retention (500+ member servers) | Basic but adequate |
| Permissions | Granular role/channel permissions (Feb 2026: Pin Messages separated) | Complete native |
| Pause Invites | Temporarily disable all invites during raids | Good raid tool |
| Invite Tracking | Audit log shows invite used per join | Basic but sufficient |

### Scheduled for Later

| Feature | Why Later |
|---------|-----------|
| Economy System | High complexity (currency, shops, casino, pets). Build after core features stabilize. See `docs/features/economy.md` when ready. |

---

## Implementation Phases

### Phase 1 — Moderation Foundation

> **Goal:** Complete the moderation toolkit that every server expects.
> **Depends on:** Nothing (foundational)

| Module | Spec | Status | Priority |
|--------|------|--------|----------|
| Warn System + Escalation | [warn-system.md](features/warn-system.md) | Not Started | P0 |
| Enhanced Moderation Commands | [moderation.md](features/moderation.md) | Not Started | P0 |
| Logging System | [logging.md](features/logging.md) | Not Started | P0 |

**Why first:** Moderation is the foundation everything else builds on. Warns feed into logging, logging supports all other features, and enhanced mod commands are expected by every server admin.

### Phase 2 — Community Engagement

> **Goal:** Features that make members want to stay and participate.
> **Depends on:** Phase 1 (logging captures engagement events)

| Module | Spec | Status | Priority |
|--------|------|--------|----------|
| Welcome & Farewell | [welcome-farewell.md](features/welcome-farewell.md) | Not Started | P0 |
| Reaction/Button/Dropdown Roles | [reaction-roles.md](features/reaction-roles.md) | Not Started | P0 |
| Leveling / XP System | [leveling.md](features/leveling.md) | Not Started | P1 |

**Why second:** Welcome messages are the first impression. Reaction roles let members self-organize. Leveling drives long-term engagement.

### Phase 3 — Community Tools

> **Goal:** Tools for community feedback, support, and fun.
> **Depends on:** Phase 1 (logging), Phase 2 (roles for ticket staff assignment)

| Module | Spec | Status | Priority |
|--------|------|--------|----------|
| Ticket System | [tickets.md](features/tickets.md) | Not Started | P1 |
| Suggestions | [suggestions.md](features/suggestions.md) | Not Started | P2 |
| Starboard | [starboard.md](features/starboard.md) | Not Started | P2 |
| Giveaways | [giveaways.md](features/giveaways.md) | Not Started | P2 |

### Phase 4 — Automation & Protection

> **Goal:** Advanced automation and server protection.
> **Depends on:** Phase 1 (warn system for escalation, logging for audit trail)

| Module | Spec | Status | Priority |
|--------|------|--------|----------|
| Anti-Raid | [anti-raid.md](features/anti-raid.md) | Not Started | P1 |
| Custom Commands / Auto-Responder | [custom-commands.md](features/custom-commands.md) | Not Started | P2 |
| Scheduled Messages | [scheduled-messages.md](features/scheduled-messages.md) | Not Started | P2 |

### Phase 5 — Economy (Scheduled)

> **Goal:** Virtual currency and gamification.
> **Depends on:** Phase 2 (leveling system for potential XP↔currency integration)

| Module | Spec | Status | Priority |
|--------|------|--------|----------|
| Economy System | [economy.md](features/economy.md) | Scheduled | P3 |

---

## Cross-Cutting Concerns

### Database Conventions

- All models use `Int @id @default(autoincrement())`
- Discord IDs are always `String` (snowflakes)
- JSON columns use `String @default("[]")` or `String @default("{}")`
- Compound indexes: `@@index([guildId, ...])` on every model
- Compound uniques where applicable: `@@unique([guildId, name])`
- Timestamps: `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`

### API Conventions

- Routes: `GET/POST/PUT/DELETE /api/guilds/:guildId/{feature}/{resource}`
- Middleware: `[requireAuth, requireGuildAdmin]` on all guild routes
- Validation: helper function returns `string | null`, early return with `reply.code(400)`
- Response: `reply.send(data)` for 200, `reply.code(201).send(data)` for creates

### Bot Command Conventions

- One file per command in `apps/bot/src/commands/{category}/`
- Export `const command: Command = { data, category, cooldown, execute }`
- Use `SlashCommandBuilder` with `setDefaultMemberPermissions`
- Error handling: `try/catch` → `errorEmbed` → `interaction.editReply`
- Permission checks: `checkPermissions()`, `checkBotPermissions()`, `isAboveTarget()`

### Dashboard Page Conventions

- File: `apps/dashboard/src/client/routes/guild/$guildId/{feature}.tsx`
- Data: TanStack Query hooks in `lib/hooks/use{Feature}.ts`
- State: `useState` for local, `useMemo` for derived
- Mutations: `useCreate{Resource}`, `useUpdate{Resource}`, `useDelete{Resource}`
- Notifications: `toast.success()` / `toast.error()` via `sonner`
- Components: Shadcn/ui + Radix primitives + Lucide icons

### Package Organization

- Types: `packages/types/src/{feature}.ts` — shared interfaces
- Systems: `packages/systems/src/{feature}/` — business logic + persistence
- Config: `packages/config/` — environment variables
- Utils: `packages/utils/` — logger, embeds, permissions

---

## How to Use This Plan

### For Agents (Claude Code)

1. **Before starting a feature:** Read its spec file in `docs/features/`
2. **Follow the phase order:** Don't start Phase 2 before Phase 1 is complete
3. **Check dependencies:** Each spec lists what it depends on
4. **Update status:** Mark features as "In Progress" → "Complete" in this file
5. **Follow conventions:** Match existing codebase patterns exactly (see Cross-Cutting Concerns above)

### For Developers

1. Each feature spec contains: database schema, API endpoints, bot commands, dashboard pages, and implementation notes
2. Specs are designed to be self-contained — you can implement one feature without reading others
3. Phase order is a recommendation, not a hard requirement — but dependencies matter

---

## Progress Tracker

| Phase | Features | Complete | Status |
|-------|----------|----------|--------|
| Phase 1 | 3 | 0/3 | Not Started |
| Phase 2 | 3 | 0/3 | Not Started |
| Phase 3 | 4 | 0/4 | Not Started |
| Phase 4 | 3 | 0/3 | Not Started |
| Phase 5 | 1 | 0/1 | Scheduled |
| **Total** | **14** | **0/14** | |
