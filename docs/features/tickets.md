# Ticket System

> **Phase:** 3 — Community Tools
> **Priority:** P1
> **Status:** Not Started
> **Depends on:** Nothing (but integrates with Logging for ticket events)

## Overview

Private support channel system. Users click a button on a panel to open a ticket — a private channel visible only to them and designated staff. Supports categories, forms (Discord modals), transcripts, claim system, and auto-close.

## Features

| Feature | Description |
|---------|-------------|
| Panel creation | Button-based ticket creation panels (dashboard-only configuration) |
| Ticket categories | Multiple categories (Support, Reports, Applications) |
| Custom forms | Discord modal popups with questions before ticket opens |
| Private channels | Each ticket = private channel for user + staff |
| Claim system | Staff can claim tickets (optional exclusive access) |
| Close with reason | Close ticket with recorded reason |
| Transcripts | HTML transcript saved to log channel |
| Auto-close | Close after configurable inactivity period |
| Ticket limit | Max open tickets per user |
| Add/remove users | Add members to an open ticket |
| Dashboard management | Configure panels, view tickets, browse transcripts |

## Database Schema

```prisma
model TicketPanel {
  id          Int      @id @default(autoincrement())
  guildId     String
  channelId   String   // Channel where panel message lives
  messageId   String?  // Populated after send
  name        String
  embed       String   @default("{}") // JSON embed config
  categories  String   @default("[]") // JSON array of TicketCategory
  createdBy   String
  createdAt   DateTime @default(now())

  @@index([guildId])
}

model Ticket {
  id            Int      @id @default(autoincrement())
  guildId       String
  channelId     String   @unique // The ticket channel
  userId        String   // Creator
  categoryName  String?
  panelId       Int?
  status        String   @default("open") // "open" | "claimed" | "closed"
  claimedBy     String?  // Staff who claimed
  closeReason   String?
  formResponses String   @default("{}") // JSON of form answers
  transcriptUrl String?  // URL/path to transcript
  createdAt     DateTime @default(now())
  closedAt      DateTime?

  @@index([guildId, userId])
  @@index([guildId, status])
  @@index([guildId, createdAt])
}

model TicketGuildSettings {
  guildId           String @id
  staffRoleIds      String @default("[]") // JSON array
  transcriptChannelId String?
  maxOpenPerUser    Int    @default(3)
  autoCloseHours    Int    @default(0) // 0 = disabled
  namingFormat      String @default("ticket-{number}") // {number}, {username}
  ticketCounter     Int    @default(0) // Auto-incrementing per guild
}
```

### TicketCategory (JSON in panel's `categories` field)

```typescript
interface TicketCategory {
  name: string;
  label: string;        // Button label
  emoji?: string;
  description?: string; // For select menu
  staffRoleIds?: string[]; // Category-specific staff (overrides default)
  formFields?: TicketFormField[]; // Modal questions
}

interface TicketFormField {
  label: string;       // Question text
  placeholder?: string;
  style: "short" | "paragraph";
  required: boolean;
  maxLength?: number;
}
```

## Interaction Flow

### 1. User clicks panel button

```
Panel Message (with buttons per category)
  ↓ Click "Support"
Modal popup (if category has form fields)
  ↓ Submit
Create private channel "ticket-0042"
  ↓
Send opening embed with user info + form responses
  ↓
Notify staff (ping staff role in ticket channel)
```

### 2. Staff claims ticket

```
Staff clicks "Claim" button in ticket
  ↓
Update ticket.claimedBy
  ↓
Optionally restrict channel to claiming staff only
```

### 3. Close ticket

```
Staff or user clicks "Close" button or uses /close
  ↓
Optional reason modal
  ↓
Generate transcript
  ↓
Send transcript to log channel
  ↓
Delete channel (or archive by restricting permissions)
```

## Bot Commands

> **Design principle:** Fast, in-context actions are slash commands. Configuration and setup (panel creation, category editing, form building) is dashboard-only — this conserves slash command slots and provides a better UX through the dashboard's visual panel builder.

### `/ticket close [reason]`

Must be used inside a ticket channel. Closes the ticket.

### `/ticket add <user>`

Add a user to the current ticket channel.

### `/ticket remove <user>`

Remove a user from the ticket channel.

### `/ticket claim`

Staff claims the ticket.

### `/ticket transcript`

Generate and post transcript link.

### Panel Creation & Management (Dashboard Only)

Ticket panels are created, configured, and sent entirely through the dashboard's visual panel builder. This includes:

- Creating and naming panels
- Choosing the target channel
- Adding/editing categories with button labels, emojis, and descriptions
- Building custom form fields (Discord modal questions)
- Configuring the panel embed appearance
- Sending (or re-sending) panel messages to channels

See the **Dashboard Page** section below for details.

## Transcript Generation

```typescript
async function generateTranscript(ticket: Ticket, channel: TextChannel): Promise<string> {
  const messages = await channel.messages.fetch({ limit: 100 });
  // Fetch more if needed (paginate)

  // Build simple HTML transcript
  const html = buildTranscriptHtml(ticket, messages.reverse());

  // Save as file and send to transcript channel
  const attachment = new AttachmentBuilder(Buffer.from(html), {
    name: `transcript-${ticket.id}.html`,
  });

  const transcriptChannel = channel.guild.channels.cache.get(settings.transcriptChannelId);
  if (transcriptChannel?.isTextBased()) {
    const msg = await transcriptChannel.send({
      embeds: [infoEmbed("Ticket Transcript", `Ticket #${ticket.id} by <@${ticket.userId}>`)],
      files: [attachment],
    });
    return msg.url;
  }
  return "";
}
```

## API Endpoints

```
GET    /api/guilds/:guildId/tickets?status=&userId=&page=&limit=  → List tickets
GET    /api/guilds/:guildId/tickets/:ticketId                      → Get ticket details
DELETE /api/guilds/:guildId/tickets/:ticketId                      → Force close

GET    /api/guilds/:guildId/ticket-panels                          → List panels
POST   /api/guilds/:guildId/ticket-panels                          → Create panel
PUT    /api/guilds/:guildId/ticket-panels/:panelId                 → Update panel
DELETE /api/guilds/:guildId/ticket-panels/:panelId                 → Delete panel
POST   /api/guilds/:guildId/ticket-panels/:panelId/send            → Send panel message

GET    /api/guilds/:guildId/ticket-settings                        → Get settings
PUT    /api/guilds/:guildId/ticket-settings                        → Update settings
```

## Dashboard Page

**Route:** `/guild/:guildId/tickets`

**Sections:**
1. **Stats** — Open tickets, avg response time, total closed
2. **Active tickets** — Table with status, user, category, created, claimed by
3. **Panel builder** — Create/edit/send panels with visual category editor, form builder, embed customizer (this is the only way to manage panels — no bot commands)
4. **Settings** — Staff roles, transcript channel, max per user, auto-close, naming format
5. **Transcript browser** — Search and view past ticket transcripts

## System Package

**Location:** `packages/systems/src/tickets/`

```
tickets/
  types.ts         — Ticket, TicketPanel, TicketCategory, TicketFormField, TicketGuildSettings
  constants.ts     — MAX_FORM_FIELDS (5), MAX_CATEGORIES (10), NAMING_VARIABLES
  persistence.ts   — CRUD for tickets, panels, settings
  channel.ts       — createTicketChannel(), closeTicketChannel(), addUser(), removeUser()
  transcript.ts    — generateTranscript(), buildTranscriptHtml()
  autoclose.ts     — Scheduled job checking inactive tickets
  config.ts        — Guild settings CRUD with cache
```

## Implementation Notes

- **Max 5 form fields:** Discord modal limit is 5 text inputs
- **Max 25 buttons per panel:** Discord component limit (5 rows × 5)
- **Auto-close:** Run scheduled check every 5 minutes. Warn 1 hour before closing.
- **Channel naming:** Use `{number}` (zero-padded) and `{username}`. E.g., `ticket-0042` or `support-john`.
- **Channel cleanup:** Tickets older than 7 days after close should have channels deleted (if archived instead of deleted).
- **Permissions:** Ticket channel permissions: deny @everyone View, allow creator + staff roles View + Send.
