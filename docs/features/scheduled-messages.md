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

> **Dashboard-only feature.** Scheduled message management (create, edit, delete, toggle, test) is handled entirely through the dashboard. No slash commands are provided for this module.
>
> **Rationale:** Cron configuration and message editing (text/embed) benefit significantly from a visual interface with cron presets, a rich message editor, and next-run previews. Additionally, this conserves slash command slots for fast, in-context actions that users need during active moderation or conversation.

The bot's role is limited to the **scheduler runtime** — polling for due messages and posting them to the configured channels. All CRUD and configuration is performed via the dashboard UI and API.

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

This is the **sole management interface** for scheduled messages. No slash commands exist for this feature.

Sections:

- **Message list** — shows all scheduled messages with name, channel, cron schedule, next-run time, and enabled/disabled status
- **Create/edit form** — name, target channel selector, cron picker (presets + custom expression), timezone selector
- **Message editor** — text or embed mode with live preview
- **Enable/disable toggle** — per-message, inline in the list
- **Test send button** — sends the message immediately without affecting the schedule

## Dependencies

Use a lightweight cron parser (e.g., `cron-parser` npm package) for `nextRunAt` calculation. Run inside Docker.
