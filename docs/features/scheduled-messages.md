# Scheduled Messages

> **Phase:** 4 — Automation & Protection
> **Priority:** P2
> **Status:** Not Started
> **Depends on:** Nothing

## Overview

Recurring auto-posted messages on configurable schedules. Useful for daily announcements, weekly reminders, rotating information posts.

## Database Schema

```prisma
model ScheduledMessage {
  id          Int      @id @default(autoincrement())
  guildId     String
  channelId   String
  name        String
  message     String   @default("{}") // JSON: { type: "text"|"embed", content, embed }
  cronExpr    String   // Cron expression: "0 9 * * *" (daily at 9am)
  timezone    String   @default("UTC")
  enabled     Boolean  @default(true)
  lastRunAt   DateTime?
  nextRunAt   DateTime?
  createdBy   String
  createdAt   DateTime @default(now())

  @@unique([guildId, name])
  @@index([guildId])
  @@index([nextRunAt, enabled]) // For scheduler
}
```

## Scheduler

```typescript
// Check every 60 seconds for messages where nextRunAt <= now AND enabled
async function processScheduledMessages(client: ExtendedClient): Promise<void> {
  const prisma = getPrisma();
  const due = await prisma.scheduledMessage.findMany({
    where: { enabled: true, nextRunAt: { lte: new Date() } },
  });

  for (const msg of due) {
    try {
      const guild = await client.guilds.fetch(msg.guildId);
      const channel = guild.channels.cache.get(msg.channelId);
      if (!channel?.isTextBased()) continue;

      const response = JSON.parse(msg.message);
      if (response.type === "embed") {
        await channel.send({ embeds: [buildEmbed(response.embed)] });
      } else {
        await channel.send(response.content);
      }

      // Calculate next run
      const nextRun = getNextCronRun(msg.cronExpr, msg.timezone);
      await prisma.scheduledMessage.update({
        where: { id: msg.id },
        data: { lastRunAt: new Date(), nextRunAt: nextRun },
      });
    } catch (error) {
      logger.error(`Scheduled message ${msg.id} failed`, error instanceof Error ? error : new Error(String(error)));
    }
  }
}
```

## Cron Presets

```typescript
const CRON_PRESETS = {
  "Every hour": "0 * * * *",
  "Every 6 hours": "0 */6 * * *",
  "Daily at 9am": "0 9 * * *",
  "Daily at midnight": "0 0 * * *",
  "Weekly (Monday 9am)": "0 9 * * 1",
  "Monthly (1st at 9am)": "0 9 1 * *",
} as const;
```

## Bot Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/schedule create <name> <channel> <cron> <message>` | Create | ManageGuild |
| `/schedule delete <name>` | Delete | ManageGuild |
| `/schedule list` | List all | ManageGuild |
| `/schedule toggle <name>` | Enable/disable | ManageGuild |
| `/schedule test <name>` | Send now (doesn't affect schedule) | ManageGuild |

## API Endpoints

```
GET    /api/guilds/:guildId/scheduled-messages?page=  → List
POST   /api/guilds/:guildId/scheduled-messages         → Create
PUT    /api/guilds/:guildId/scheduled-messages/:id    → Update
DELETE /api/guilds/:guildId/scheduled-messages/:id    → Delete
POST   /api/guilds/:guildId/scheduled-messages/:id/test → Test send
```

## Dashboard Page

**Route:** `/guild/:guildId/scheduled`

Sections: message list with next-run times, create/edit form with cron picker (presets + custom), message editor (text/embed).

## Dependencies

Use a lightweight cron parser (e.g., `cron-parser` npm package) for `nextRunAt` calculation. Run inside Docker.
