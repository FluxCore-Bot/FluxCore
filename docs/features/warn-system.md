# Warn System + Escalation

> **Phase:** 1 — Moderation Foundation
> **Priority:** P0
> **Status:** Not Started
> **Depends on:** Nothing

## Overview

A formal warning system where moderators issue tracked warnings to users. Warnings accumulate per user per guild and can trigger automatic punishment escalation (e.g., 3 warns → mute, 5 → kick, 7 → ban).

Discord has no native warn tracking — timeouts are one-level only.

**Design principle:** Fast actions (warn, view, clear) are slash commands. All configuration (escalation thresholds, DM toggle, reason requirements) is dashboard-only. This conserves Discord's limited slash command slots and keeps the bot's command surface minimal.

## Features

| Feature | Description |
|---------|-------------|
| `/warn` | Issue a warning to a user with reason |
| `/warnings` | View warning history for a user |
| `/clearwarnings` | Clear all or specific warnings for a user |
| DM on Warn | Optionally DM the user when warned (dashboard config) |
| Punishment Escalation | Auto-execute actions at warn thresholds |
| Mod Log Integration | All warns logged to logging system (Phase 1) |
| Dashboard Page | View/manage warnings and configure escalation |

## Database Schema

```prisma
model Warning {
  id        Int      @id @default(autoincrement())
  guildId   String
  userId    String
  moderatorId String
  reason    String
  createdAt DateTime @default(now())

  @@index([guildId, userId])
  @@index([guildId, createdAt])
}

model WarnPunishment {
  id        Int      @id @default(autoincrement())
  guildId   String
  threshold Int      // Number of active warns to trigger
  action    String   // "timeout" | "kick" | "ban"
  duration  Int?     // Duration in seconds (for timeout)

  @@unique([guildId, threshold])
  @@index([guildId])
}

model WarnGuildSettings {
  guildId       String  @id
  dmOnWarn      Boolean @default(true)
  reasonRequired Boolean @default(false)
  maxWarnings   Int     @default(0) // 0 = unlimited
}
```

## Bot Commands

### `/warn <user> [reason]`

```
Options:
  user: User (required)
  reason: String (optional, max 500 chars)
Permission: ManageMessages
Cooldown: 3s
```

**Flow:**
1. `checkPermissions(interaction, [ManageMessages])`
2. `isAboveTarget(moderator, target)` — can't warn higher roles
3. Create `Warning` row
4. Count active warnings for user
5. Check `WarnPunishment` thresholds — execute if reached
6. DM user if `dmOnWarn` enabled (catch DM failure silently)
7. Reply with `successEmbed` showing warn count
8. Emit to logging system

### `/warnings <user>`

```
Options:
  user: User (required)
Permission: ManageMessages
```

**Flow:**
1. Fetch all `Warning` rows for user in guild, ordered by `createdAt DESC`
2. Paginate (10 per page) using button components
3. Display: `#ID | <moderator> | <reason> | <date>`

### `/clearwarnings <user> [id]`

```
Options:
  user: User (required)
  id: Integer (optional — specific warning ID)
Permission: ManageMessages
```

**Flow:**
1. If `id` provided: delete specific warning (verify it belongs to user+guild)
2. If no `id`: delete all warnings for user in guild
3. Reply with count of cleared warnings

## API Endpoints

```
GET    /api/guilds/:guildId/warnings?userId=&page=&limit=    → List warnings (filterable)
POST   /api/guilds/:guildId/warnings                          → Create warning
DELETE /api/guilds/:guildId/warnings/:warningId                → Delete warning
DELETE /api/guilds/:guildId/warnings/user/:userId              → Clear all for user

GET    /api/guilds/:guildId/warn-punishments                   → List punishment config
POST   /api/guilds/:guildId/warn-punishments                   → Add punishment threshold
DELETE /api/guilds/:guildId/warn-punishments/:id               → Remove punishment

GET    /api/guilds/:guildId/warn-settings                      → Get guild warn settings
PUT    /api/guilds/:guildId/warn-settings                      → Update settings
```

## System Package

**Location:** `packages/systems/src/warnings/`

```
warnings/
  types.ts        — Warning, WarnPunishment, WarnGuildSettings interfaces
  constants.ts    — MAX_REASON_LENGTH, VALID_ACTIONS, DEFAULT_SETTINGS
  persistence.ts  — CRUD operations (createWarning, getWarnings, deleteWarning, etc.)
  escalation.ts   — checkAndExecutePunishment(guildId, userId, warnCount)
  config.ts       — Guild settings + punishment config CRUD
```

## Dashboard Page

**Route:** `/guild/:guildId/warnings`

**Sections:**
1. **Stats bar** — Total warnings, active warnings, most warned users
2. **Warnings table** — Filterable by user, moderator, date range. Actions: delete
3. **Escalation config** — Table of threshold → action mappings. Add/remove rows (dashboard-only, no bot command equivalent)
4. **Settings panel** — DM toggle, reason requirement toggle, max warnings limit (dashboard-only, no bot command equivalent)

## Implementation Notes

- Warnings never expire automatically (mod decides to clear)
- Punishment escalation checks CURRENT total warns, not lifetime
- When a warn triggers escalation, the action is logged as both a "warn" and the escalation action
- If DM fails (user has DMs closed), warn still succeeds — log DM failure silently
- Dashboard shows warning history even for users who've left the guild
