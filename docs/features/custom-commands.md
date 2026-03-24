# Custom Commands / Auto-Responder

> **Phase:** 4 — Automation & Protection
> **Priority:** P2
> **Status:** Not Started
> **Depends on:** Nothing (but extends the existing Actions system concept)

## Overview

User-created text commands and auto-responders. Builds on top of FluxCore's existing Actions system, but provides a simpler interface for common use cases: keyword triggers, text/embed responses, role actions, and cooldowns.

## Relationship to Actions System

The existing Actions system handles event-driven automation (19 event types, 10 action types). Custom Commands adds:
- **Prefix/slash trigger** — respond to `!command` or `/custom`
- **Keyword trigger** — auto-respond when message contains keyword
- **Simpler interface** — not every server admin needs the full workflow editor

Implementation option: Custom commands can be stored as a specialized `ActionRule` with `eventType: "customCommand"` or as a separate model. **Recommendation: separate model** for simpler queries and a cleaner UX.

## Database Schema

```prisma
model CustomCommand {
  id           Int      @id @default(autoincrement())
  guildId      String
  name         String   // Trigger name
  triggerType  String   // "command" | "keyword" | "startsWith" | "regex"
  response     String   @default("{}") // JSON: { type: "text"|"embed", content, embed }
  actions      String   @default("[]") // JSON: additional actions (addRole, removeRole, etc.)
  enabled      Boolean  @default(true)
  cooldown     Int      @default(0) // Seconds, 0 = none
  allowedRoles String   @default("[]") // JSON — empty = everyone
  allowedChannels String @default("[]") // JSON — empty = all
  deletesTrigger Boolean @default(false) // Delete the triggering message
  dmResponse   Boolean  @default(false) // Send response as DM
  createdBy    String
  createdAt    DateTime @default(now())

  @@unique([guildId, name])
  @@index([guildId, enabled])
  @@index([guildId, triggerType])
}
```

## Bot Events

### `messageCreate.ts` — Auto-responder

```typescript
// After XP handling:
if (message.author.bot) return;

const commands = await getCustomCommands(message.guild.id);
for (const cmd of commands) {
  if (!cmd.enabled) continue;
  if (!matchesTrigger(cmd, message.content)) continue;
  if (!isAllowed(cmd, message.member, message.channelId)) continue;
  if (isOnCooldown(`cc_${cmd.id}`, message.author.id)) continue;

  await executeCustomCommand(cmd, message);
  if (cmd.cooldown > 0) setCooldown(`cc_${cmd.id}`, message.author.id, cmd.cooldown);
  break; // Only first match
}
```

### Trigger Matching

```typescript
function matchesTrigger(cmd: CustomCommand, content: string): boolean {
  switch (cmd.triggerType) {
    case "command": return content.toLowerCase() === `!${cmd.name.toLowerCase()}`;
    case "keyword": return content.toLowerCase().includes(cmd.name.toLowerCase());
    case "startsWith": return content.toLowerCase().startsWith(cmd.name.toLowerCase());
    case "regex": {
      try { return new RegExp(cmd.name, "i").test(content); }
      catch { return false; }
    }
    default: return false;
  }
}
```

## Bot Commands

> **Dashboard-only management.** Custom command CRUD (create, edit, delete, list, toggle) is managed exclusively through the dashboard. No slash commands are registered for this feature.
>
> **Rationale:**
> - **Conserves slash command slots** — Discord limits applications to 100 global commands. Configuration/CRUD features that don't need fast in-chat access should not consume slots.
> - **Superior UX** — The dashboard visual builder provides a far better experience for creating complex responses (embeds, multi-action sequences, regex triggers, permission scoping) than a slash command modal ever could.
> - **Design principle** — Fast actions use slash commands; configuration and CRUD use the dashboard.
>
> The bot still **executes** custom commands at runtime (via `messageCreate`), but all management happens in the dashboard.

_No slash commands for this module._

## API Endpoints

```
GET    /api/guilds/:guildId/custom-commands?page=     → List
POST   /api/guilds/:guildId/custom-commands            → Create
PUT    /api/guilds/:guildId/custom-commands/:id        → Update
DELETE /api/guilds/:guildId/custom-commands/:id        → Delete
```

## Dashboard Page

**Route:** `/guild/:guildId/commands`

Sections: command list with triggers, response editor (text/embed), action builder, permissions config.

## System Package

**Location:** `packages/systems/src/customCommands/`

```
customCommands/
  types.ts        — CustomCommand, TriggerType, CommandResponse
  constants.ts    — MAX_COMMANDS_PER_GUILD (50), TRIGGER_TYPES
  persistence.ts  — CRUD with guild-level cache
  matcher.ts      — matchesTrigger(), isAllowed()
  executor.ts     — executeCustomCommand() — send response, run actions
```
