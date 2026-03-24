# Logging System

> **Phase:** 1 — Moderation Foundation
> **Priority:** P0
> **Status:** Not Started
> **Depends on:** Nothing (but enhanced by Warn System + Moderation for mod action logging)

## Overview

Real-time event logging to designated Discord channels. Unlike Discord's built-in audit log (API-only, 45-day retention, no message content), FluxCore's logging system sends formatted embeds to configurable log channels with full message content including attachments.

## Log Event Categories

| Category | Events | Color |
|----------|--------|-------|
| **Message** | edit, delete, bulk delete, pin/unpin | `#60a5fa` (info blue) |
| **Member** | join, leave, ban, unban, kick, nickname change, role change | `#a3a6ff` (primary) |
| **Voice** | join, leave, switch, mute, deafen | `#ac8aff` (secondary) |
| **Channel** | create, delete, update | `#fee75c` (warning) |
| **Role** | create, delete, update, permission change | `#fee75c` (warning) |
| **Server** | settings change, emoji change | `#fee75c` (warning) |
| **Moderation** | warn, kick, ban, tempban, timeout, softban, note, purge | `#ff6e84` (danger) |

## Features

| Feature | Description |
|---------|-------------|
| Multiple log channels | Route different categories to different channels |
| Per-event toggles | Enable/disable individual event types |
| Ignore channels/roles | Exclude channels or roles from being logged |
| Message content logging | Full message content including edits (before/after) |
| Attachment logging | Log attachment URLs and image proxies |
| Bulk delete export | When messages are bulk-purged, log count + optionally paste content |
| Dashboard viewer | Browse logs with filters in the dashboard |
| Mod action logging | All moderation actions from FluxCore commands auto-logged |

## Database Schema

```prisma
model LogGuildConfig {
  id              Int      @id @default(autoincrement())
  guildId         String
  category        String   // "message" | "member" | "voice" | "channel" | "role" | "server" | "moderation"
  channelId       String   // Discord channel to send logs to
  enabled         Boolean  @default(true)
  ignoredChannels String   @default("[]") // JSON array of channel IDs
  ignoredRoles    String   @default("[]") // JSON array of role IDs
  enabledEvents   String   @default("[]") // JSON array of specific events (empty = all)

  @@unique([guildId, category])
  @@index([guildId])
}

model LogEntry {
  id          Int      @id @default(autoincrement())
  guildId     String
  category    String
  eventType   String   // e.g., "messageDelete", "memberJoin", "modWarn"
  targetId    String?  // User/channel/role ID affected
  executorId  String?  // Who did it (if known)
  content     String   @default("{}") // JSON — event-specific data
  createdAt   DateTime @default(now())

  @@index([guildId, category, createdAt])
  @@index([guildId, eventType])
  @@index([guildId, targetId])
  @@index([createdAt]) // For cleanup jobs
}
```

## Bot Events to Listen

### New Event Handlers Needed

```
apps/bot/src/events/
  messageDelete.ts
  messageUpdate.ts
  messageBulkDelete.ts
  guildMemberAdd.ts
  guildMemberRemove.ts
  guildMemberUpdate.ts   // nickname, role changes
  guildBanAdd.ts
  guildBanRemove.ts
  voiceStateUpdate.ts    // already exists — extend
  channelCreate.ts
  channelDelete.ts
  channelUpdate.ts
  roleCreate.ts
  roleDelete.ts
  roleUpdate.ts
  guildUpdate.ts
```

### Message Delete Example

```typescript
const event: Event<"messageDelete"> = {
  name: "messageDelete",
  async execute(message: Message | PartialMessage) {
    if (!message.guild || message.author?.bot) return;

    const config = await getLogConfig(message.guild.id, "message");
    if (!config?.enabled) return;
    if (isIgnored(config, message.channelId, message.member?.roles)) return;

    const embed = new EmbedBuilder()
      .setColor(LOG_COLORS.message)
      .setAuthor({ name: message.author?.tag ?? "Unknown", iconURL: message.author?.displayAvatarURL() })
      .setTitle("Message Deleted")
      .addFields(
        { name: "Channel", value: `<#${message.channelId}>`, inline: true },
        { name: "Author", value: `<@${message.author?.id}>`, inline: true },
      )
      .setTimestamp();

    if (message.content) {
      embed.setDescription(message.content.slice(0, 4096));
    }

    // Log attachments
    if (message.attachments.size > 0) {
      const attachmentList = message.attachments.map(a => `[${a.name}](${a.proxyURL})`).join("\n");
      embed.addFields({ name: "Attachments", value: attachmentList.slice(0, 1024) });
    }

    // Send to log channel
    await sendLogEmbed(message.guild, config.channelId, embed);

    // Persist to database
    await createLogEntry({
      guildId: message.guild.id,
      category: "message",
      eventType: "messageDelete",
      targetId: message.author?.id,
      content: JSON.stringify({
        channelId: message.channelId,
        messageContent: message.content?.slice(0, 2000),
        attachments: message.attachments.map(a => ({ name: a.name, url: a.proxyURL })),
      }),
    });
  },
};
```

## Log Embed Format Examples

### Message Delete
```
🗑️ Message Deleted
Channel: #general
Author: @user
───────────────
[message content]
Attachments: image.png
```

### Member Join
```
📥 Member Joined
User: @user (user#0001)
Account Created: 2024-01-15 (2 years ago)
Member Count: 1,234
```

### Mod Action (from FluxCore commands)
```
⚠️ Member Warned
Target: @user
Moderator: @mod
Reason: Spamming in #general
Active Warnings: 3/7
```

## API Endpoints

```
GET    /api/guilds/:guildId/logs?category=&eventType=&targetId=&page=&limit=  → Browse logs
GET    /api/guilds/:guildId/log-config                     → Get all category configs
PUT    /api/guilds/:guildId/log-config/:category            → Update category config
DELETE /api/guilds/:guildId/logs                             → Purge old logs (admin)
```

## Dashboard Page

**Route:** `/guild/:guildId/logs` (extend existing page)

**Sections:**
1. **Log Configuration** — Per-category: enable/disable, set channel, ignored channels/roles, event toggles
2. **Log Browser** — Real-time-ish log viewer with filters: category, event type, user, date range
3. **Stats** — Events per category (24h), most active log types

## System Package

**Location:** `packages/systems/src/logging/`

```
logging/
  types.ts        — LogCategory, LogEventType, LogGuildConfig, LogEntry interfaces
  constants.ts    — LOG_COLORS, LOG_CATEGORIES, EVENT_TYPES_BY_CATEGORY
  config.ts       — Guild log config CRUD with in-memory cache
  persistence.ts  — LogEntry CRUD, query with filters, cleanup
  sender.ts       — sendLogEmbed() helper (handles channel not found, permissions)
  formatter.ts    — Embed builders for each event type
```

## Implementation Notes

- **Message content caching:** Discord's `messageDelete` event may not include content for uncached messages. Use `message.partial` check and attempt `message.fetch()`. If fetch fails, log "Content unavailable (uncached)."
- **Rate limiting:** Log sends should be batched — if 50 messages are bulk deleted, don't send 50 embeds. Send 1 summary embed + optionally a text file.
- **Partials:** Enable `Partials.Message`, `Partials.Channel`, `Partials.GuildMember` in client intents.
- **Log retention:** `LogEntry` rows older than 90 days should be cleaned up via scheduled job.
- **Intents needed:** `GuildMessages`, `MessageContent` (privileged), `GuildMembers` (privileged) — already enabled.
- **Attachments:** Discord proxy URLs expire. Store them but note they may become unavailable over time.
