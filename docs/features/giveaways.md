# Giveaways

> **Phase:** 3 — Community Tools
> **Priority:** P2
> **Status:** Not Started
> **Depends on:** Nothing

## Overview

Timed giveaway system with automated winner selection, role requirements, multiple winners, and reroll capability.

## Database Schema

```prisma
model Giveaway {
  id          Int      @id @default(autoincrement())
  guildId     String
  channelId   String
  messageId   String?  // Giveaway message
  hostId      String   // Who created it
  prize       String   // Prize description
  winners     Int      @default(1) // Number of winners
  endsAt      DateTime
  ended       Boolean  @default(false)
  winnerIds   String   @default("[]") // JSON array of winner user IDs
  requiredRoleIds String @default("[]") // JSON array — must have one of these roles
  createdAt   DateTime @default(now())

  @@index([guildId])
  @@index([endsAt, ended]) // For scheduler
}
```

## Flow

1. `/giveaway start <prize> <duration> [winners] [required_role]`
2. Bot posts embed with 🎉 reaction button
3. Users click to enter (checked against role requirements)
4. When timer expires, bot selects random winners from valid entries
5. Edit embed to announce winners, DM winners

## Bot Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/giveaway start <prize> <duration> [winners] [role]` | Create giveaway | ManageGuild |
| `/giveaway end <id>` | End early | ManageGuild |
| `/giveaway reroll <id>` | Re-select winners | ManageGuild |
| `/giveaway list` | List active giveaways | ManageGuild |

## Scheduler

Check every 30 seconds for giveaways where `endsAt <= now() AND ended = false`. Process winner selection.

## Giveaway Embed

```
🎉 GIVEAWAY 🎉
Prize: Nitro Classic (1 Month)
Winners: 2
Hosted by: @user
Required Role: @Members
Ends: <t:1711234567:R>

React with 🎉 to enter!
Entries: 47
```

After ending:
```
🎉 GIVEAWAY ENDED 🎉
Prize: Nitro Classic (1 Month)
Winners: @winner1, @winner2
Entries: 47
```

## API Endpoints

```
GET    /api/guilds/:guildId/giveaways?active=&page=  → List
POST   /api/guilds/:guildId/giveaways                → Create
PUT    /api/guilds/:guildId/giveaways/:id/end         → End early
POST   /api/guilds/:guildId/giveaways/:id/reroll      → Reroll
```

## Dashboard Page

**Route:** `/guild/:guildId/giveaways`

Sections: active giveaways, past giveaways, create giveaway form.
