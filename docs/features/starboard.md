# Starboard

> **Phase:** 3 — Community Tools
> **Priority:** P2
> **Status:** Not Started
> **Depends on:** Nothing

## Overview

Automatically repost popular messages to a highlights channel when they receive enough star reactions. Community-driven content curation.

## Database Schema

```prisma
model StarboardEntry {
  id              Int      @id @default(autoincrement())
  guildId         String
  originalMessageId String
  originalChannelId String
  starboardMessageId String? // Message ID in starboard channel
  authorId        String
  starCount       Int      @default(0)
  createdAt       DateTime @default(now())

  @@unique([guildId, originalMessageId])
  @@index([guildId, starCount])
}

model StarboardGuildSettings {
  guildId         String  @id
  enabled         Boolean @default(true)
  channelId       String? // Starboard channel
  emoji           String  @default("⭐")
  threshold       Int     @default(3) // Stars needed to qualify
  selfStar        Boolean @default(false) // Allow starring own messages
  ignoredChannels String  @default("[]") // JSON array
  nsfwHandling    String  @default("ignore") // "ignore" | "separate" (separate NSFW starboard)
}
```

## Bot Events

Listen to `messageReactionAdd` and `messageReactionRemove`:

1. Check if reaction emoji matches config
2. If self-star disabled, ignore if reactor == author
3. Count reactions (excluding bots, optionally excluding author)
4. If count >= threshold and no starboard entry: create entry, post to starboard
5. If count >= threshold and entry exists: update star count on starboard message
6. If count < threshold and entry exists: optionally remove from starboard

## Starboard Embed Format

```
⭐ 7 | #general

[Original message content]
[Attachment/image if present]

Author: @user
Jump to message: [link]
```

## Bot Commands

None — starboard is fully configured via the dashboard.

> **Design rationale:** Starboard has no "fast actions" that benefit from slash commands. All operations (channel selection, threshold, emoji, self-star toggle, ignored channels, NSFW handling) are configuration, which is managed exclusively through the dashboard to conserve Discord slash command slots.

## API Endpoints

```
GET  /api/guilds/:guildId/starboard?page=        → List starred messages
GET  /api/guilds/:guildId/starboard-settings      → Settings
PUT  /api/guilds/:guildId/starboard-settings      → Update
```

## Dashboard Page

**Route:** `/guild/:guildId/starboard`

Sections:

- **Settings panel** — channel selection, threshold, emoji, self-star toggle, ignored channels, NSFW handling (this is the sole configuration surface for starboard)
- **Starred messages gallery** — browse and manage starred messages
