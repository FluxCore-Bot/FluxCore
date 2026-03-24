# Enhanced Moderation Commands

> **Phase:** 1 — Moderation Foundation
> **Priority:** P0
> **Status:** Not Started
> **Depends on:** Warn System (for escalation integration)

## Overview

Extend FluxCore's existing moderation commands (ban, kick, timeout, clear) with missing essentials: tempban, softban, lock/unlock, slowmode control, case system, mod notes, and DM on punishment.

## Features

| Feature | Description | Existing? |
|---------|-------------|-----------|
| `/tempban` | Ban with auto-unban after duration | No |
| `/softban` | Ban + immediate unban (purges messages) | No |
| `/lock` / `/unlock` | Lock/unlock channel for @everyone | No |
| `/case` | View moderation case by ID | No |
| `/cases` | List cases for a user | No |
| `/note` | Internal mod note on a user (not visible to user) | No |
| `/purge` (enhanced) | Filters: by user, bots-only, contains text, has attachments, has links | Partial (basic `/clear`) |
| DM on Punishment | DM user with reason before ban/kick/timeout | No |

## Database Schema

```prisma
model ModCase {
  id          Int      @id @default(autoincrement())
  guildId     String
  targetId    String   // User who was punished
  moderatorId String
  action      String   // "ban" | "tempban" | "kick" | "timeout" | "softban" | "warn" | "note"
  reason      String?
  duration    Int?     // Seconds (for tempban, timeout)
  expiresAt   DateTime? // When tempban/timeout expires
  active      Boolean  @default(true) // For tempbans: false after unban
  createdAt   DateTime @default(now())

  @@index([guildId, targetId])
  @@index([guildId, createdAt])
  @@index([guildId, action])
  @@index([expiresAt, active]) // For tempban scheduler
}

model ModGuildSettings {
  guildId         String  @id
  dmOnPunishment  Boolean @default(true)
  modLogChannelId String? // Dedicated mod log channel
}
```

## Bot Commands

### `/tempban <user> <duration> [reason] [delete_days]`

```
Options:
  user: User (required)
  duration: String (required) — "1h", "1d", "7d", "30d"
  reason: String (optional)
  delete_days: Integer (optional, 0-7, default 0)
Permission: BanMembers
```

**Flow:**
1. Parse duration string to seconds
2. Create `ModCase` with `expiresAt`
3. DM user (if enabled): "You have been temporarily banned from {server} for {duration}. Reason: {reason}"
4. Execute `member.ban({ reason, deleteMessageSeconds })`
5. Schedule unban (see Scheduler section)

### `/softban <user> [reason]`

```
Permission: BanMembers
```

**Flow:**
1. `member.ban({ reason, deleteMessageSeconds: 7 * 86400 })`
2. Immediately `guild.members.unban(userId, "Softban")`
3. Create `ModCase` with action "softban"

### `/lock [channel] [reason]`

```
Options:
  channel: Channel (optional, defaults to current)
  reason: String (optional)
Permission: ManageChannels
```

**Flow:**
1. Override `@everyone` role: `channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false })`
2. Send embed in channel: "🔒 This channel has been locked. Reason: {reason}"
3. Create `ModCase`

### `/unlock [channel]`

```
Permission: ManageChannels
```

**Flow:**
1. Reset `@everyone` override: `channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null })`
2. Send embed: "🔓 This channel has been unlocked."

### `/case <id>`

```
Permission: ManageMessages
```

**Flow:** Fetch `ModCase` by ID + guildId, display embed with all details.

### `/cases <user>`

```
Permission: ManageMessages
```

**Flow:** Fetch all `ModCase` rows for user, paginate (10/page), display as list.

### `/note <user> <text>`

```
Permission: ManageMessages
```

**Flow:** Create `ModCase` with action "note". Not DM'd to user. Visible only to mods via `/cases`.

### `/purge` (enhanced)

```
Options:
  amount: Integer (1-100, required)
  user: User (optional — filter by user)
  bots: Boolean (optional — only bot messages)
  contains: String (optional — messages containing text)
  has: String (optional — "links" | "attachments" | "embeds")
Permission: ManageMessages
```

**Flow:**
1. Fetch last `amount * 2` messages (headroom for filtering)
2. Apply filters
3. Bulk delete (max 100, messages < 14 days old)
4. Reply with count deleted (ephemeral, auto-delete after 5s)

## Tempban Scheduler

**Location:** `packages/systems/src/moderation/scheduler.ts`

```typescript
// On bot startup (ready event):
// 1. Query all ModCase where action="tempban" AND active=true AND expiresAt <= now
// 2. Unban those users immediately
// 3. Set interval (every 60s) to check for newly expired tempbans

export async function checkExpiredTempbans(client: ExtendedClient): Promise<void> {
  const prisma = getPrisma();
  const expired = await prisma.modCase.findMany({
    where: {
      action: "tempban",
      active: true,
      expiresAt: { lte: new Date() },
    },
  });
  for (const modCase of expired) {
    try {
      const guild = await client.guilds.fetch(modCase.guildId);
      await guild.members.unban(modCase.targetId, "Tempban expired");
      await prisma.modCase.update({ where: { id: modCase.id }, data: { active: false } });
    } catch (error) {
      logger.error(`Failed to unban ${modCase.targetId}`, error instanceof Error ? error : new Error(String(error)));
    }
  }
}
```

## Integration with Existing Commands

The existing `/ban`, `/kick`, `/timeout` commands should be updated to:
1. Create `ModCase` entries
2. DM user before action (if enabled)
3. Log to mod log channel

## API Endpoints

```
GET    /api/guilds/:guildId/cases?userId=&action=&page=&limit=  → List cases
GET    /api/guilds/:guildId/cases/:caseId                        → Get single case
DELETE /api/guilds/:guildId/cases/:caseId                        → Delete case
PUT    /api/guilds/:guildId/cases/:caseId                        → Edit reason

GET    /api/guilds/:guildId/mod-settings                         → Get mod settings
PUT    /api/guilds/:guildId/mod-settings                         → Update mod settings
```

## Dashboard Page

**Route:** `/guild/:guildId/moderation`

**Sections:**
1. **Stats** — Total cases, recent actions (24h), most active moderators
2. **Cases table** — Filterable by user, moderator, action type, date range
3. **Settings** — DM on punishment toggle, mod log channel select

## System Package

**Location:** `packages/systems/src/moderation/`

```
moderation/
  types.ts        — ModCase, ModGuildSettings, ModAction type union
  constants.ts    — VALID_ACTIONS, DURATION_PRESETS, MAX_PURGE
  persistence.ts  — CRUD for cases and settings
  scheduler.ts    — Tempban expiration checker
  dm.ts           — DM notification helper (catch failures silently)
```
