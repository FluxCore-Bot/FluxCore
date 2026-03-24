# Anti-Raid

> **Phase:** 4 — Automation & Protection
> **Priority:** P1
> **Status:** Not Started
> **Depends on:** Logging System (for audit trail), Moderation (for ban/kick actions)

## Overview

Protection against coordinated raids (mass joins), nuking (mass deletions by compromised admins), and suspicious account detection. Discord's native tools (Pause Invites, verification levels) are basic — FluxCore adds configurable thresholds, auto-ban, lockdown mode, and account age filtering.

## Features

| Feature | Description |
|---------|-------------|
| Join rate detection | Detect X joins in Y seconds |
| Account age filter | Auto-kick accounts younger than threshold |
| Auto-ban on raid | Auto-ban detected raid accounts |
| Lockdown mode | Lock all channels preventing @everyone from sending |
| Anti-nuke | Detect mass channel/role deletion and quarantine |
| Action on trigger | Configurable: kick, ban, timeout, lockdown |
| Whitelist | Exempt roles from raid detection |

## Database Schema

```prisma
model AntiRaidConfig {
  guildId             String  @id
  enabled             Boolean @default(false)
  joinThreshold       Int     @default(10) // X joins...
  joinWindow          Int     @default(10) // ...in Y seconds
  joinAction          String  @default("kick") // "kick" | "ban" | "timeout"
  accountAgeMinDays   Int     @default(0) // 0 = disabled
  accountAgeAction    String  @default("kick")
  antiNukeEnabled     Boolean @default(false)
  antiNukeThreshold   Int     @default(3) // X deletions in 10s
  lockdownOnRaid      Boolean @default(false)
  whitelistedRoleIds  String  @default("[]")
  logChannelId        String?
}

model RaidEvent {
  id         Int      @id @default(autoincrement())
  guildId    String
  eventType  String   // "join_spike" | "account_age" | "nuke_attempt" | "lockdown"
  details    String   @default("{}") // JSON: affected user IDs, action taken
  triggeredAt DateTime @default(now())

  @@index([guildId, triggeredAt])
}
```

## In-Memory Tracking

```typescript
// Track recent joins per guild (in-memory, no DB needed for real-time detection)
const joinTracker = new Map<string, { timestamps: number[] }>();

function recordJoin(guildId: string): boolean {
  const now = Date.now();
  const entry = joinTracker.get(guildId) ?? { timestamps: [] };

  // Clean old entries outside window
  const config = getAntiRaidConfig(guildId); // cached
  const windowMs = (config?.joinWindow ?? 10) * 1000;
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
  entry.timestamps.push(now);

  joinTracker.set(guildId, entry);

  return entry.timestamps.length >= (config?.joinThreshold ?? 10);
}
```

## Bot Events

### `guildMemberAdd.ts` (extend)

```typescript
// After welcome message handling:
const config = await getAntiRaidConfig(member.guild.id);
if (!config?.enabled) return;

// Account age check
if (config.accountAgeMinDays > 0) {
  const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 86400000;
  if (accountAgeDays < config.accountAgeMinDays) {
    await executeRaidAction(member, config.accountAgeAction, "Account too new");
    await logRaidEvent(member.guild.id, "account_age", { userId: member.id, ageDays: accountAgeDays });
    return;
  }
}

// Join rate check
const isRaid = recordJoin(member.guild.id);
if (isRaid) {
  await handleRaidDetected(member.guild, config);
}
```

### Anti-Nuke (audit log monitoring)

Listen to `channelDelete`, `roleDelete`, `guildBanAdd` events. Track rate per executor.

```typescript
const nukeTracker = new Map<string, Map<string, number[]>>(); // guildId → executorId → timestamps

// If executor deletes >= threshold channels/roles in 10 seconds:
// 1. Remove all roles from executor
// 2. Log event
// 3. Alert mod log
// 4. Optionally lockdown
```

## Bot Commands

> **Design principle:** Anti-raid *configuration* (enable/disable, thresholds, account age, anti-nuke settings) is **dashboard-only** to conserve slash command slots. Only emergency lockdown commands are exposed as slash commands for instant access from Discord.

| Command | Description | Permission |
|---------|-------------|------------|
| `/lockdown` | Activate server lockdown (locks all channels for @everyone) | ManageGuild |
| `/lockdown lift` | Lift an active server lockdown | ManageGuild |

### Lockdown Implementation

```typescript
async function lockdownGuild(guild: Guild, reason: string): Promise<void> {
  const channels = guild.channels.cache.filter(c => c.isTextBased());
  for (const [, channel] of channels) {
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: false,
    }, { reason: `Lockdown: ${reason}` }).catch(() => {});
  }
}

async function liftLockdown(guild: Guild): Promise<void> {
  const channels = guild.channels.cache.filter(c => c.isTextBased());
  for (const [, channel] of channels) {
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: null, // Reset to default
    }, { reason: "Lockdown lifted" }).catch(() => {});
  }
}
```

## API Endpoints

```
GET  /api/guilds/:guildId/antiraid-config         → Get config
PUT  /api/guilds/:guildId/antiraid-config         → Update config
GET  /api/guilds/:guildId/raid-events?page=       → Raid event history
POST /api/guilds/:guildId/lockdown                → Toggle lockdown
```

## Dashboard Page

**Route:** `/guild/:guildId/security`

> The dashboard is the **sole configuration interface** for anti-raid settings. All threshold tuning, enable/disable toggles, account age filters, anti-nuke settings, and whitelisted roles are managed here.

Sections: enable/disable toggle, join rate thresholds, account age filter, anti-nuke config, whitelisted roles, lockdown toggle, recent raid events timeline.

## System Package

**Location:** `packages/systems/src/antiraid/`

```
antiraid/
  types.ts        — AntiRaidConfig, RaidEvent, RaidAction
  constants.ts    — DEFAULT_THRESHOLDS, VALID_ACTIONS
  config.ts       — Config CRUD with cache
  tracker.ts      — In-memory join rate + nuke tracking
  actions.ts      — executeRaidAction(), lockdownGuild(), liftLockdown()
  persistence.ts  — RaidEvent logging
```
