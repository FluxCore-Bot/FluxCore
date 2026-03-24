# Leveling / XP System

> **Phase:** 2 — Community Engagement
> **Priority:** P1
> **Status:** Not Started
> **Depends on:** Nothing (but integrates with Logging for XP events)

## Overview

Gamification system where members earn XP for chatting and voice activity, level up, receive role rewards, and compete on leaderboards. Discord has no native XP/leveling system — this is entirely bot territory and a massive engagement driver.

## Features

| Feature | Description |
|---------|-------------|
| Message XP | Earn XP per message with cooldown (anti-spam) |
| Voice XP | Earn XP for time in voice channels |
| Level-up announcements | Configurable notification in channel or DM |
| Role rewards | Auto-assign roles at level milestones |
| Leaderboard | Server-wide ranking by XP |
| `/rank` command | Visual rank card showing level, XP, progress |
| XP rate control | Multiplier per channel or role |
| No-XP channels/roles | Exclude channels/roles from earning |
| XP management | Admin add/remove/set XP |
| Dashboard | Leaderboard view, reward config, settings |

## Database Schema

```prisma
model UserLevel {
  id        Int      @id @default(autoincrement())
  guildId   String
  userId    String
  xp        Int      @default(0)
  level     Int      @default(0)
  messageCount Int   @default(0)
  voiceMinutes Int   @default(0)
  lastMessageXp DateTime? // Cooldown tracking
  updatedAt DateTime @updatedAt

  @@unique([guildId, userId])
  @@index([guildId, xp]) // For leaderboard queries
  @@index([guildId, level])
}

model LevelReward {
  id      Int    @id @default(autoincrement())
  guildId String
  level   Int
  roleId  String

  @@unique([guildId, level, roleId])
  @@index([guildId])
}

model LevelGuildSettings {
  guildId             String  @id
  enabled             Boolean @default(true)
  xpPerMessage        Int     @default(15) // Base XP per message
  xpCooldownSeconds   Int     @default(60) // Cooldown between XP grants
  voiceXpPerMinute    Int     @default(5)  // XP per minute in voice
  voiceXpEnabled      Boolean @default(true)
  announceChannel     String? // null = same channel, "dm" = DM, channel ID = specific
  announceMessage     String  @default("{user} just reached **Level {level}**! 🎉")
  announceEnabled     Boolean @default(true)
  noXpChannels        String  @default("[]") // JSON array of channel IDs
  noXpRoles           String  @default("[]") // JSON array of role IDs
  xpMultipliers       String  @default("{}") // JSON: { channels: {id: multiplier}, roles: {id: multiplier} }
}
```

## XP Formula

```typescript
// XP required to reach a given level (exponential curve)
function xpForLevel(level: number): number {
  return Math.floor(5 * Math.pow(level, 2) + 50 * level + 100);
}

// Total XP required from level 0 to target level
function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

// Calculate level from total XP
function levelFromXp(totalXp: number): number {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return level;
}
```

**Progression examples:**
- Level 1: 155 XP
- Level 5: 725 XP
- Level 10: 2,750 XP
- Level 20: 12,000 XP
- Level 50: 75,250 XP
- Level 100: 302,500 XP

## Bot Events

### Message XP (in `messageCreate.ts`)

```typescript
const event: Event<"messageCreate"> = {
  name: "messageCreate",
  async execute(message: Message) {
    if (!message.guild || message.author.bot) return;

    const settings = await getLevelSettings(message.guild.id);
    if (!settings?.enabled) return;

    // Check exclusions
    if (isExcluded(settings, message.channelId, message.member)) return;

    // Cooldown check
    const userLevel = await getUserLevel(message.guild.id, message.author.id);
    if (userLevel?.lastMessageXp) {
      const elapsed = Date.now() - userLevel.lastMessageXp.getTime();
      if (elapsed < settings.xpCooldownSeconds * 1000) return;
    }

    // Calculate XP with multipliers
    let xpGain = settings.xpPerMessage + Math.floor(Math.random() * 10); // 15-24 base
    xpGain = applyMultipliers(xpGain, settings, message.channelId, message.member);

    // Grant XP
    const result = await addXp(message.guild.id, message.author.id, xpGain);

    // Level up?
    if (result.leveledUp) {
      await handleLevelUp(message, settings, result.newLevel);
    }
  },
};
```

### Voice XP (extend `voiceStateUpdate.ts`)

Track voice join/leave times. On leave, calculate minutes and grant XP.

```typescript
// In-memory tracking (voice sessions don't need DB until they end)
const voiceSessions = new Map<string, { guildId: string; joinedAt: number }>();

// On voice join: voiceSessions.set(`${guildId}:${userId}`, { guildId, joinedAt: Date.now() })
// On voice leave: calculate minutes, grant XP, delete from map
// On bot restart: sessions are lost (acceptable — voice XP is incremental)
```

## Bot Commands

### `/rank [user]`

```
Options:
  user: User (optional, defaults to self)
```

**Response:** Embed with level, XP, progress bar, server rank position.

```
📊 Rank — @user
Level: 12
XP: 2,340 / 2,750
Progress: [████████░░] 85%
Rank: #7 of 1,234
Messages: 3,456
Voice: 12h 34m
```

### `/leaderboard [page]`

```
Options:
  page: Integer (optional, default 1)
```

**Response:** Top 10 per page with level, XP, rank.

### `/xp set <user> <amount>` / `/xp add <user> <amount>` / `/xp remove <user> <amount>`

```
Permission: ManageGuild
```

Admin XP management.

### `/levelconfig rewards add <level> <role>`

```
Permission: ManageGuild
```

### `/levelconfig rewards remove <level>`

### `/levelconfig rewards list`

## API Endpoints

```
GET    /api/guilds/:guildId/leaderboard?page=&limit=      → Leaderboard
GET    /api/guilds/:guildId/levels/:userId                  → User level info
PUT    /api/guilds/:guildId/levels/:userId                  → Admin set XP

GET    /api/guilds/:guildId/level-settings                  → Settings
PUT    /api/guilds/:guildId/level-settings                  → Update settings

GET    /api/guilds/:guildId/level-rewards                   → List rewards
POST   /api/guilds/:guildId/level-rewards                   → Add reward
DELETE /api/guilds/:guildId/level-rewards/:id               → Remove reward
```

## Dashboard Page

**Route:** `/guild/:guildId/leveling`

**Sections:**
1. **Leaderboard** — Top members with rank, level, XP
2. **Settings** — XP rate, cooldown, voice XP toggle, announcement config
3. **Role rewards** — Level → role mapping table
4. **Exclusions** — No-XP channels and roles multi-select
5. **Multipliers** — Per-channel and per-role XP multiplier config

## System Package

**Location:** `packages/systems/src/leveling/`

```
leveling/
  types.ts        — UserLevel, LevelReward, LevelGuildSettings
  constants.ts    — DEFAULT_XP, MAX_LEVEL, XP_FORMULA constants
  config.ts       — Guild settings + reward CRUD with cache
  persistence.ts  — User XP CRUD, leaderboard queries
  xp.ts           — xpForLevel(), levelFromXp(), addXp(), applyMultipliers()
  rewards.ts      — checkAndGrantRewards(guildId, userId, newLevel)
```

## Implementation Notes

- **XP randomization:** Add `Math.floor(Math.random() * 10)` to base XP to prevent gaming
- **Cooldown:** 60s default prevents XP farming by spamming short messages
- **Voice XP:** Only grant if user is not muted/deafened and channel has ≥2 non-bot members
- **Role rewards:** Check on level up AND on reward config change (retroactive)
- **Leaderboard performance:** Index on `(guildId, xp DESC)` for fast ordering. Use `ROW_NUMBER()` for rank.
- **Rank command:** Calculate rank with `SELECT COUNT(*) FROM UserLevel WHERE guildId = ? AND xp > ?`
