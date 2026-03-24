# Suggestions

> **Phase:** 3 — Community Tools
> **Priority:** P2
> **Status:** Not Started
> **Depends on:** Nothing

## Overview

Structured system for community members to submit suggestions, vote, and track status. Posted as embeds with upvote/downvote reactions. Mods can approve/deny with reasons.

## Database Schema

```prisma
model Suggestion {
  id          Int      @id @default(autoincrement())
  guildId     String
  userId      String
  messageId   String?  // Discord message ID in suggestions channel
  content     String   // Suggestion text (max 2000)
  status      String   @default("pending") // "pending" | "approved" | "denied" | "implemented"
  statusReason String?
  statusBy    String?  // Mod who changed status
  upvotes     Int      @default(0) // Cached count
  downvotes   Int      @default(0) // Cached count
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([guildId, status])
  @@index([guildId, createdAt])
}

model SuggestionGuildSettings {
  guildId          String  @id
  enabled          Boolean @default(true)
  channelId        String? // Suggestions channel
  reviewChannelId  String? // Optional: mod review channel
  dmOnStatusChange Boolean @default(true)
  autoThread       Boolean @default(false) // Create discussion thread
  anonymousMode    Boolean @default(false)
}
```

## Bot Commands

Fast in-context actions only. All configuration is managed through the dashboard.

| Command | Description | Permission |
|---------|-------------|------------|
| `/suggest <text>` | Submit a suggestion | Everyone |
| `/suggestion approve <id> [reason]` | Approve | ManageGuild |
| `/suggestion deny <id> [reason]` | Deny | ManageGuild |
| `/suggestion implement <id>` | Mark implemented | ManageGuild |

## Flow

1. User runs `/suggest "Add a music channel"`
2. Bot posts embed to suggestions channel: `Suggestion #42 by @user — "Add a music channel"`
3. Bot adds 👍 and 👎 reactions
4. Optionally creates discussion thread
5. Mod runs `/suggestion approve 42 "Great idea, adding next week"`
6. Embed updates with status + reason. DM sent to author.

## API Endpoints

```
GET    /api/guilds/:guildId/suggestions?status=&page=  → List
POST   /api/guilds/:guildId/suggestions                → Create
PUT    /api/guilds/:guildId/suggestions/:id/status      → Change status
GET    /api/guilds/:guildId/suggestion-settings          → Settings
PUT    /api/guilds/:guildId/suggestion-settings          → Update
```

## Dashboard Page

**Route:** `/guild/:guildId/suggestions`

Sections: suggestion list with filters, status management, and full configuration panel (channel selection, review channel, DM notifications, auto-thread, anonymous mode). All suggestion settings are configured exclusively through the dashboard.
