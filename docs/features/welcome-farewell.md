# Welcome & Farewell Messages

> **Phase:** 2 — Community Engagement
> **Priority:** P0
> **Status:** Not Started
> **Depends on:** Logging System (member join/leave events share handler)

## Overview

Custom welcome messages when members join and farewell messages when they leave. Supports rich embeds, dynamic variables, DM welcome, and optional welcome images. Discord only has a basic Welcome Screen (channel recommendations) — no custom messages, images, or farewell support.

## Features

| Feature | Description |
|---------|-------------|
| Welcome message | Custom embed sent to a channel when a member joins |
| Farewell message | Custom embed sent when a member leaves/is kicked/banned |
| Welcome DM | Optional DM sent to new members with rules/info |
| Dynamic variables | `{user}`, `{user.tag}`, `{server}`, `{membercount}`, `{user.avatar}` |
| Embed customization | Title, description, color, thumbnail, image, footer, fields |
| Auto-role on join | Assign roles automatically to new members |
| Dashboard builder | Visual embed editor for welcome/farewell messages |

## Database Schema

```prisma
model WelcomeConfig {
  guildId           String  @id
  welcomeEnabled    Boolean @default(false)
  welcomeChannelId  String?
  welcomeMessage    String  @default("{}") // JSON embed config
  farewellEnabled   Boolean @default(false)
  farewellChannelId String?
  farewellMessage   String  @default("{}") // JSON embed config
  dmEnabled         Boolean @default(false)
  dmMessage         String  @default("{}") // JSON embed config
  autoRoleIds       String  @default("[]") // JSON array of role IDs
}
```

## Variable System

```typescript
const WELCOME_VARIABLES: Record<string, (member: GuildMember) => string> = {
  "{user}": (m) => `<@${m.id}>`,
  "{user.tag}": (m) => m.user.tag,
  "{user.name}": (m) => m.user.username,
  "{user.id}": (m) => m.id,
  "{user.avatar}": (m) => m.user.displayAvatarURL({ size: 256 }),
  "{server}": (m) => m.guild.name,
  "{server.id}": (m) => m.guild.id,
  "{membercount}": (m) => m.guild.memberCount.toLocaleString(),
  "{server.icon}": (m) => m.guild.iconURL({ size: 256 }) ?? "",
};
```

## Bot Events

### `guildMemberAdd.ts`

```typescript
const event: Event<"guildMemberAdd"> = {
  name: "guildMemberAdd",
  async execute(member: GuildMember) {
    const config = await getWelcomeConfig(member.guild.id);
    if (!config) return;

    // Auto-role
    if (config.autoRoleIds.length > 0 && !member.user.bot) {
      const roles = config.autoRoleIds.filter(id => member.guild.roles.cache.has(id));
      if (roles.length > 0) {
        await member.roles.add(roles, "Auto-role on join").catch(() => {});
      }
    }

    // Welcome message to channel
    if (config.welcomeEnabled && config.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(config.welcomeChannelId);
      if (channel?.isTextBased()) {
        const embed = buildWelcomeEmbed(config.welcomeMessage, member);
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // Welcome DM
    if (config.dmEnabled && !member.user.bot) {
      const embed = buildWelcomeEmbed(config.dmMessage, member);
      await member.send({ embeds: [embed] }).catch(() => {}); // Silently fail
    }
  },
};
```

### `guildMemberRemove.ts`

Shared with logging system — fires farewell message if enabled.

## Bot Commands

### `/welcome setup <channel>`

```
Permission: ManageGuild
```

Quick setup: enables welcome, sets channel, applies default template.

### `/welcome test`

Sends a test welcome message using current config with the command user as target.

### `/welcome disable`

Disables welcome messages.

## API Endpoints

```
GET  /api/guilds/:guildId/welcome        → Get full welcome config
PUT  /api/guilds/:guildId/welcome        → Update welcome config (all fields)
POST /api/guilds/:guildId/welcome/test   → Send test message to configured channel
```

## Dashboard Page

**Route:** `/guild/:guildId/welcome`

**Sections:**
1. **Welcome Message** — Enable toggle, channel select, embed builder (visual)
2. **Farewell Message** — Enable toggle, channel select, embed builder
3. **Welcome DM** — Enable toggle, embed builder
4. **Auto-Role** — Multi-select roles to assign on join
5. **Preview** — Live preview of the embed with variable substitution
6. **Test button** — Send test message

## System Package

**Location:** `packages/systems/src/welcome/`

```
welcome/
  types.ts        — WelcomeConfig, EmbedConfig interfaces
  constants.ts    — VARIABLES, DEFAULT_WELCOME_EMBED, DEFAULT_FAREWELL_EMBED
  config.ts       — Guild config CRUD with cache
  builder.ts      — buildWelcomeEmbed(config, member) → EmbedBuilder
```

## Implementation Notes

- **Embed config format:** Store as JSON with fields: `{ title?, description?, color?, thumbnail?, image?, footer?, fields?: [{name, value, inline}] }`
- **Variable replacement:** Apply variables to ALL text fields in the embed (title, description, footer, field values)
- **Auto-role:** Skip if bot role is below the target role in hierarchy
- **DM failures:** Never block or error if DM fails — many users have DMs disabled
- **Default template:** On first setup, populate with a sensible default: "Welcome to {server}, {user}! You are member #{membercount}."
