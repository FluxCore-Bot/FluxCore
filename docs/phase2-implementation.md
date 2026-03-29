# Phase 2 — Community Engagement: Implementation Documentation

> **Phase:** 2 of 5
> **Modules:** Welcome & Farewell, Reaction Roles, Leveling System
> **PRs:** #24, #25, #26
> **Date:** 2026-03-29

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Module 1: Welcome & Farewell](#module-1-welcome--farewell)
3. [Module 2: Reaction / Button / Dropdown Roles](#module-2-reaction--button--dropdown-roles)
4. [Module 3: Leveling / XP System](#module-3-leveling--xp-system)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Testing](#testing)
8. [Merge & Deployment](#merge--deployment)

---

## Architecture Overview

All three modules follow FluxCore's standard architecture pattern:

```
┌──────────────────────────────────────────────────────────────┐
│                      Discord Client                          │
│  Events (guildMemberAdd, messageCreate, interactionCreate)   │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────┐         ┌──────────────────────────┐
│   Bot Commands       │         │   Bot Event Handlers     │
│   /welcome test      │         │   guildMemberAdd.ts      │
│   /rolepanel send    │         │   guildMemberRemove.ts   │
│   /rank, /leaderboard│         │   messageCreate.ts       │
│   /xp set|add|remove │         │   voiceStateUpdate.ts    │
└──────────┬───────────┘         │   interactionCreate.ts   │
           │                     │   messageReactionAdd.ts  │
           │                     │   messageReactionRemove  │
           │                     └────────────┬─────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                  System Packages (shared)                     │
│  packages/systems/src/welcome/                               │
│  packages/systems/src/rolePanel/                             │
│  packages/systems/src/leveling/                              │
│                                                              │
│  Each contains: types, constants, config, persistence,       │
│  and domain-specific logic (builder, handler, xp, rewards)   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    Prisma ORM / PostgreSQL                    │
│  WelcomeConfig, RolePanel, UserLevel, LevelReward,           │
│  LevelGuildSettings                                          │
└──────────────────────────────────────────────────────────────┘
                           ▲
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                    Dashboard (Fastify + React)                │
│                                                              │
│  Server: routes/welcome.ts, routes/rolePanel.ts,             │
│          routes/leveling.ts                                   │
│                                                              │
│  Client: pages/welcome.tsx, pages/roles.tsx,                 │
│          pages/leveling.tsx                                   │
│          hooks/useWelcome.ts, hooks/useRolePanels.ts,        │
│          hooks/useLeveling.ts                                │
└──────────────────────────────────────────────────────────────┘
```

### File Layout Per Module

Each module follows the same directory structure:

| Layer | Location | Purpose |
|-------|----------|---------|
| **System Package** | `packages/systems/src/<module>/` | Shared business logic, types, DB access |
| **Bot Commands** | `apps/bot/src/commands/<category>/` | Discord slash commands |
| **Bot Events** | `apps/bot/src/events/` | Discord gateway event handlers |
| **Dashboard API** | `apps/dashboard/src/server/routes/` | Fastify REST endpoints |
| **Dashboard UI** | `apps/dashboard/src/client/routes/guild/$guildId/` | React pages |
| **Dashboard Hooks** | `apps/dashboard/src/client/lib/hooks/` | React Query data fetching |
| **Tests** | `apps/bot/tests/`, `apps/dashboard/tests/`, `packages/systems/tests/` | Vitest unit tests |

---

## Module 1: Welcome & Farewell

**Branch:** `feat/welcome-farewell`
**PR:** #24
**Files:** 19 changed (11 new, 7 modified, 1 config)

### Overview

Custom welcome messages when members join and farewell messages when they leave. Supports rich embeds, dynamic variables, DM welcome messages, and auto-role assignment on join. All configuration is done through the dashboard — the only slash command is `/welcome test` for previewing.

### How It Works

#### Flow: Member Joins

```
Discord fires guildMemberAdd
        │
        ▼
guildMemberAdd.ts event handler
        │
        ├─► 1. Existing logging logic runs (unchanged)
        │
        ├─► 2. Load WelcomeConfig from DB via getWelcomeConfig(guildId)
        │       └─► Returns null if not configured → exit
        │
        ├─► 3. Auto-Role Assignment
        │       ├─► Skip if member is a bot
        │       ├─► Filter autoRoleIds to only roles that exist in the guild
        │       └─► member.roles.add(roles, "Auto-role on join")
        │           └─► Silently catches errors (role hierarchy issues)
        │
        ├─► 4. Welcome Channel Message
        │       ├─► Check welcomeEnabled && welcomeChannelId exists
        │       ├─► Get channel from guild cache
        │       ├─► buildWelcomeEmbed(config.welcomeMessage, member)
        │       │       ├─► Parse JSON embed config
        │       │       ├─► Replace all variables in text fields
        │       │       └─► Return EmbedBuilder
        │       └─► channel.send({ embeds: [embed] })
        │
        └─► 5. Welcome DM
                ├─► Check dmEnabled && member is not a bot
                ├─► buildWelcomeEmbed(config.dmMessage, member)
                └─► member.send({ embeds: [embed] }).catch(() => {})
                    └─► Silently fails if DMs are disabled
```

#### Flow: Member Leaves

```
Discord fires guildMemberRemove
        │
        ▼
guildMemberRemove.ts event handler
        │
        ├─► 1. Existing logging logic runs (unchanged)
        │
        ├─► 2. Load WelcomeConfig
        │
        └─► 3. Farewell Message
                ├─► Check farewellEnabled && farewellChannelId exists
                ├─► buildWelcomeEmbed(config.farewellMessage, member)
                └─► channel.send({ embeds: [embed] })
```

### Variable System

The variable engine replaces placeholders in **all text fields** of an embed (title, description, footer text, field names, field values):

| Variable | Output | Example |
|----------|--------|---------|
| `{user}` | User mention | `<@123456789>` |
| `{user.tag}` | Username#discriminator | `JohnDoe#1234` |
| `{user.name}` | Username | `JohnDoe` |
| `{user.id}` | User snowflake ID | `123456789` |
| `{user.avatar}` | Avatar URL (256px) | `https://cdn.discordapp.com/...` |
| `{server}` | Server name | `My Community` |
| `{server.id}` | Server snowflake ID | `987654321` |
| `{membercount}` | Current member count | `1,234` |
| `{server.icon}` | Server icon URL (256px) | `https://cdn.discordapp.com/...` |

**Implementation** (`packages/systems/src/welcome/constants.ts`):

```typescript
export const WELCOME_VARIABLES: Record<string, (member: GuildMember) => string> = {
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

**Variable replacement** (`packages/systems/src/welcome/builder.ts`):

The `buildWelcomeEmbed()` function parses the JSON embed config, iterates over every text field, and applies all variable replacements. It then constructs a Discord.js `EmbedBuilder` with a timestamp.

### Embed Config Format

Embeds are stored as JSON strings in the database:

```typescript
interface EmbedConfig {
  title?: string;
  description?: string;
  color?: number;          // Hex color as integer (e.g., 0xa3a6ff)
  thumbnail?: string;      // URL
  image?: string;          // URL
  footer?: string;         // Footer text
  fields?: EmbedField[];   // Array of { name, value, inline? }
}
```

### System Package Structure

```
packages/systems/src/welcome/
├── types.ts        → WelcomeConfig, EmbedConfig, EmbedField interfaces
├── constants.ts    → WELCOME_VARIABLES map, DEFAULT_WELCOME_EMBED, DEFAULT_FAREWELL_EMBED
├── config.ts       → getWelcomeConfig(guildId), upsertWelcomeConfig(guildId, data)
└── builder.ts      → buildWelcomeEmbed(embedConfig, member) → EmbedBuilder
```

- **config.ts** uses Prisma's `findUnique`/`upsert` pattern. JSON fields (`welcomeMessage`, `farewellMessage`, `dmMessage`, `autoRoleIds`) are parsed from strings to typed objects on read and serialized on write.
- **builder.ts** is a pure function that takes an embed config and a guild member, applies variable replacement, and returns a Discord.js `EmbedBuilder`.

### Bot Command: `/welcome test`

**File:** `apps/bot/src/commands/general/welcome.ts`
**Permission:** `ManageGuild`

Sends a preview of the configured welcome message to the configured welcome channel, using the command invoker as the "joining member." This lets admins preview their welcome configuration without having to leave and rejoin the server.

**Flow:**
1. Check `ManageGuild` permission
2. Load `WelcomeConfig` from database
3. Verify welcome is enabled and channel is configured
4. Build embed with the command user as the member
5. Send to the configured welcome channel
6. Reply with success confirmation

### Dashboard Page

**Route:** `/guild/:guildId/welcome`
**File:** `apps/dashboard/src/client/routes/guild/$guildId/welcome.tsx`

The page uses a tabbed interface with four sections:

| Tab | Controls |
|-----|----------|
| **Welcome** | Enable toggle, channel ID input, embed editor (title, description, color, thumbnail URL, image URL, footer) |
| **Farewell** | Enable toggle, channel ID input, embed editor |
| **DM** | Enable toggle, embed editor |
| **Auto-Role** | Comma-separated role ID input |

Each tab has a **Save** button that calls `PUT /api/guilds/:guildId/welcome`. The welcome tab also has a **Test** button that calls `POST /api/guilds/:guildId/welcome/test`.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/guilds/:guildId/welcome` | Get full welcome config (returns defaults if none exists) |
| `PUT` | `/api/guilds/:guildId/welcome` | Update welcome config (upsert — creates if missing) |
| `POST` | `/api/guilds/:guildId/welcome/test` | Send test message to configured welcome channel |

All routes require `requireAuth` + `requireGuildAdmin` middleware.

---

## Module 2: Reaction / Button / Dropdown Roles

**Branch:** `feat/reaction-roles`
**PR:** #25
**Files:** 21 changed (14 new, 7 modified)

### Overview

Self-assignable roles via reactions, buttons, or dropdown menus attached to messages. Admins create "role panels" through the dashboard, configure the roles and appearance, then deploy them to channels with `/rolepanel send`. Members interact with the panels to assign/remove roles from themselves.

### Core Concepts

#### Panel Types

| Type | How Members Interact | Discord Component |
|------|---------------------|------------------|
| **Button** | Click a button to toggle a role | `ButtonBuilder` in `ActionRow` (max 5 per row, max 5 rows = 25 buttons) |
| **Dropdown** | Select roles from a dropdown menu | `StringSelectMenuBuilder` with min/max values |
| **Reaction** | React to an emoji on the message | Emoji reactions on the panel message |

#### Panel Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Toggle** (default) | Click to add, click again to remove | Color roles, notification roles |
| **Unique** | Adding one role removes all others in this panel | Pronoun roles, region roles |
| **Verify** | Click to add, cannot remove | Verification/agreement flows |

### How It Works

#### Flow: Panel Creation & Deployment

```
Dashboard: Admin creates a panel
        │
        ▼
POST /api/guilds/:guildId/role-panels
        │
        ├─► Validate: name, type, channelId, roles array (≤25 entries)
        ├─► Each role entry: { roleId, label, emoji?, description?, style? }
        ├─► Store in RolePanel table (messageId = null, draft state)
        └─► Return created panel

        ... Admin runs /rolepanel send <panel_name> ...

Bot: /rolepanel send command
        │
        ├─► Look up panel by name + guildId
        ├─► Verify panel has roles configured
        ├─► Get target channel (from panel config or channel override)
        │
        ├─► Build Discord components based on panel type:
        │   ├─► Button: buildButtonComponents(panel)
        │   │       └─► Creates ActionRows with buttons
        │   │           customId format: "rp_{panelId}_{roleId}"
        │   │
        │   ├─► Dropdown: buildDropdownComponent(panel)
        │   │       └─► Creates StringSelectMenu
        │   │           customId format: "rpd_{panelId}"
        │   │
        │   └─► Reaction: (no components, uses emoji reactions)
        │
        ├─► Build embed from panel.embed config
        │
        ├─► Send message to channel
        │
        ├─► For reaction type: add emoji reactions to the message
        │
        ├─► Store messageId in database (panel is now "deployed")
        │
        └─► Reply with success
```

#### Flow: Member Clicks a Button

```
Discord fires interactionCreate (Button)
        │
        ▼
interactionCreate.ts
        │
        ├─► Check customId starts with "rp_"
        ├─► Parse: rp_{panelId}_{roleId}
        └─► handleRolePanelButton(interaction, panelId, roleId)
                │
                ├─► Load panel from DB
                ├─► Check if member already has the role
                │
                ├─► Mode: TOGGLE
                │   ├─► Has role → remove it → reply "Removed @Role"
                │   └─► No role → add it → reply "Added @Role"
                │
                ├─► Mode: UNIQUE
                │   ├─► Has role → remove it → reply "Removed @Role"
                │   └─► No role → remove ALL other panel roles first
                │       → add this role → reply "Added @Role"
                │
                └─► Mode: VERIFY
                    ├─► Has role → reply "You already have this role"
                    └─► No role → add it → reply "Added @Role"
```

#### Flow: Member Uses Dropdown

```
Discord fires interactionCreate (StringSelectMenu)
        │
        ▼
interactionCreate.ts
        │
        ├─► Check customId starts with "rpd_"
        ├─► Parse panelId
        └─► handleRolePanelDropdown(interaction, panelId, selectedValues)
                │
                ├─► Load panel from DB
                ├─► Get all panel role IDs
                ├─► Compare selected vs. current member roles
                │
                ├─► Mode: TOGGLE
                │   ├─► Add selected roles member doesn't have
                │   └─► Remove unselected roles member does have
                │
                ├─► Mode: UNIQUE
                │   └─► Set member roles to exactly the selected values
                │       (remove all other panel roles)
                │
                └─► Mode: VERIFY
                    └─► Only add selected roles, never remove
```

#### Flow: Member Reacts to Emoji

```
Discord fires messageReactionAdd / messageReactionRemove
        │
        ▼
messageReactionAdd.ts / messageReactionRemove.ts
        │
        ├─► Fetch partial reaction data if needed
        ├─► Look up panel by messageId
        ├─► Find matching role by emoji
        └─► handleRolePanelReaction(reaction, user, added)
                │
                ├─► If added=true: add role (respect mode)
                │   └─► Unique mode: remove other reactions first
                └─► If added=false: remove role (skip in verify mode)
```

### System Package Structure

```
packages/systems/src/rolePanel/
├── types.ts        → PanelType, PanelMode, RolePanelEntry, RolePanel, CRUD input types
├── constants.ts    → MAX_ROLES_PER_PANEL (25), VALID_PANEL_TYPES, VALID_PANEL_MODES
├── persistence.ts  → CRUD: getRolePanels, getRolePanel, getRolePanelByName,
│                     getRolePanelByMessageId, createRolePanel, updateRolePanel,
│                     deleteRolePanel, updatePanelMessageId
├── builder.ts      → buildButtonComponents, buildDropdownComponent, buildPanelEmbed
└── handler.ts      → handleRolePanelButton, handleRolePanelDropdown, handleRolePanelReaction
```

**persistence.ts** handles JSON serialization of the `roles` field. On read, it parses the JSON string into a `RolePanelEntry[]` array. On write, it serializes the array back to a JSON string.

**builder.ts** constructs Discord.js component builders:
- Buttons use `customId` format `rp_{panelId}_{roleId}` for routing
- Dropdowns use `customId` format `rpd_{panelId}`
- Button styles map: 1=Primary (blue), 2=Secondary (gray), 3=Success (green), 4=Danger (red)

**handler.ts** contains the core role assignment logic with mode-specific behavior. All interactions reply ephemerally (only visible to the clicking user).

### Component ID Routing

The `interactionCreate.ts` event handler routes interactions based on `customId` prefixes:

```typescript
// Button click
if (interaction.isButton() && interaction.customId.startsWith("rp_")) {
  const [_, panelId, roleId] = interaction.customId.split("_");
  await handleRolePanelButton(interaction, parseInt(panelId), roleId);
}

// Dropdown select
if (interaction.isStringSelectMenu() && interaction.customId.startsWith("rpd_")) {
  const panelId = parseInt(interaction.customId.split("_")[1]);
  await handleRolePanelDropdown(interaction, panelId, interaction.values);
}
```

### Dashboard Page

**Route:** `/guild/:guildId/roles`
**File:** `apps/dashboard/src/client/routes/guild/$guildId/roles.tsx`

| Section | Description |
|---------|-------------|
| **Panel List** | Cards/table showing all panels with name, type, mode, role count, deployed status, delete button |
| **Create/Edit Dialog** | Modal form with: name, type selector, mode selector, channel ID, embed editor |
| **Role Entry Editor** | Add roles with: role ID, label, emoji, description (dropdown only), button style |
| **Live Preview** | Shows how the panel will render in Discord |
| **Statistics** | Total panels, deployed count, total roles configured |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/guilds/:guildId/role-panels` | List all panels for a guild |
| `POST` | `/api/guilds/:guildId/role-panels` | Create a new panel (validated: name, type, channelId, roles ≤ 25) |
| `PUT` | `/api/guilds/:guildId/role-panels/:panelId` | Update an existing panel |
| `DELETE` | `/api/guilds/:guildId/role-panels/:panelId` | Delete a panel |
| `POST` | `/api/guilds/:guildId/role-panels/:panelId/send` | Send/resend panel to its channel |

### Constraints

- **25 role limit per panel** — Discord allows max 5 rows x 5 buttons = 25 buttons, or 25 dropdown options
- **Role hierarchy** — Bot can only assign roles below its own highest role
- **Reaction persistence** — Uses raw event handlers (not collectors) so reaction roles survive bot restarts. On startup, all panels with `type="reaction"` have their listeners re-established
- **Partial fetching** — Reaction events may arrive as partials; handlers call `reaction.fetch()` and `user.fetch()` before processing

---

## Module 3: Leveling / XP System

**Branch:** `feat/leveling-system`
**PR:** #26
**Files:** 27 changed (20 new, 7 modified)

### Overview

Gamification system where members earn XP for chatting and spending time in voice channels, level up, receive role rewards at milestones, and compete on server-wide leaderboards. Fully configurable through the dashboard with XP rates, cooldowns, multipliers, exclusions, and announcement settings.

### How It Works

#### Flow: Message XP

```
Discord fires messageCreate
        │
        ▼
messageCreate.ts event handler
        │
        ├─► 1. Guard checks
        │   ├─► Skip if not in a guild
        │   ├─► Skip if author is a bot
        │   └─► Skip if member is null
        │
        ├─► 2. Load settings
        │   └─► getLevelSettings(guildId)
        │       └─► Returns defaults if no config exists (enabled: true)
        │
        ├─► 3. Check exclusions
        │   ├─► Is channel in noXpChannels? → skip
        │   └─► Does member have any noXpRoles? → skip
        │
        ├─► 4. Cooldown check
        │   ├─► getUserLevel(guildId, userId)
        │   ├─► Check lastMessageXp timestamp
        │   └─► If elapsed < xpCooldownSeconds (default 60s) → skip
        │
        ├─► 5. Calculate XP
        │   ├─► Base: xpPerMessage (default 15)
        │   ├─► + Random: Math.floor(Math.random() * 10)  → range: 15-24
        │   └─► × Multipliers: applyMultipliers(xp, settings, channelId, member)
        │       ├─► Check channel multiplier (e.g., #general = 2x)
        │       └─► Check role multiplier (highest matching, e.g., Booster = 1.5x)
        │
        ├─► 6. Grant XP
        │   └─► addXp(guildId, userId, xpGain) → AddXpResult
        │       ├─► Upsert UserLevel record
        │       ├─► Increment xp, messageCount, set lastMessageXp
        │       ├─► Recalculate level from new total XP
        │       └─► Return { leveledUp, newLevel, oldLevel, totalXp }
        │
        ├─► 7. Level Up? (if result.leveledUp)
        │   ├─► handleLevelUp(message, settings, newLevel)
        │   │   ├─► Replace {user}, {level}, {username} in announceMessage
        │   │   ├─► Send to:
        │   │   │   ├─► announceChannel === "dm" → DM the user
        │   │   │   ├─► announceChannel === channelId → that specific channel
        │   │   │   └─► announceChannel === null → same channel as message
        │   │   └─► Silently catches send failures
        │   │
        │   └─► checkAndGrantRewards(guild, userId, newLevel)
        │       ├─► Get all LevelRewards for this guild
        │       ├─► Filter to rewards at or below newLevel
        │       ├─► For each: if member doesn't have the role → add it
        │       └─► Log failures but don't block
        │
        └─► Done (no reply to the message)
```

#### Flow: Voice XP

```
Discord fires voiceStateUpdate
        │
        ▼
voiceStateUpdate.ts event handler
        │
        ├─► In-memory session tracking:
        │   voiceSessions = Map<"guildId:userId", { guildId, joinedAt }>
        │
        ├─► Member JOINS voice channel
        │   ├─► Check shouldGrantVoiceXp(state):
        │   │   ├─► Not self-deafened or server-deafened
        │   │   ├─► Not self-muted or server-muted
        │   │   └─► Channel has ≥ 2 non-bot members
        │   └─► Store session: { guildId, joinedAt: Date.now() }
        │
        ├─► Member LEAVES voice channel
        │   ├─► Look up session from map
        │   ├─► Calculate minutes: floor((now - joinedAt) / 60000)
        │   ├─► Delete session from map
        │   └─► If minutes > 0:
        │       └─► grantVoiceXp(state, minutes)
        │           ├─► Load settings, check enabled + voiceXpEnabled
        │           ├─► xpAmount = minutes × voiceXpPerMinute (default 5)
        │           ├─► addVoiceXp(guildId, userId, xpAmount, minutes)
        │           │   └─► Upsert UserLevel, increment voiceMinutes
        │           └─► If leveledUp → checkAndGrantRewards
        │
        └─► Member MUTES/DEAFENS (same channel, state change)
            ├─► If now eligible → start tracking (add to map)
            └─► If now ineligible → stop tracking, grant accumulated XP
```

**Important:** Voice sessions are stored in-memory only. If the bot restarts, active voice sessions are lost. This is acceptable because voice XP is incremental and the lost amount is typically small.

### XP Formula

The leveling curve is exponential — each level requires progressively more XP:

```typescript
// XP needed to go from level N to level N+1
function xpForLevel(level: number): number {
  return Math.floor(5 * level² + 50 * level + 100);
}
```

| Level | XP to Next Level | Cumulative XP |
|-------|-----------------|---------------|
| 0 → 1 | 100 | 100 |
| 1 → 2 | 155 | 255 |
| 5 → 6 | 475 | 1,975 |
| 10 → 11 | 1,100 | 6,500 |
| 20 → 21 | 3,100 | 30,500 |
| 50 → 51 | 15,100 | 183,250 |
| 100 → ∞ | — | 547,500 |

**Level calculation from XP** (`levelFromXp`): Iterates through levels, subtracting each level's XP requirement until the remaining XP is insufficient. This is O(level) but since MAX_LEVEL is 100, it's effectively constant.

### Multiplier System

XP multipliers can be configured per-channel and per-role:

```typescript
// Stored as JSON in LevelGuildSettings.xpMultipliers
interface XpMultipliers {
  channels?: Record<string, number>;  // channelId → multiplier
  roles?: Record<string, number>;     // roleId → multiplier
}

// Example: { channels: { "123": 2.0 }, roles: { "456": 1.5 } }
```

**Application logic:**
1. Start with base multiplier = 1.0
2. If the message channel has a multiplier → multiply
3. If the member has roles with multipliers → use the **highest** matching role multiplier
4. Final XP = floor(baseXP × channelMultiplier × roleMultiplier)

### System Package Structure

```
packages/systems/src/leveling/
├── types.ts        → UserLevel, LevelReward, LevelGuildSettings, XpMultipliers, AddXpResult
├── constants.ts    → DEFAULT_XP_PER_MESSAGE (15), XP_RANDOMNESS (10), DEFAULT_COOLDOWN (60),
│                     MAX_LEVEL (100), LEADERBOARD_PAGE_SIZE (10), DEFAULT_SETTINGS
├── xp.ts           → xpForLevel(), totalXpForLevel(), levelFromXp(), applyMultipliers()
├── config.ts       → getLevelSettings(), upsertLevelSettings(), getLevelRewards(),
│                     addLevelReward(), removeLevelReward()
├── persistence.ts  → getUserLevel(), addXp(), addVoiceXp(), setXp(),
│                     getLeaderboard(), getUserRank()
└── rewards.ts      → checkAndGrantRewards(guild, userId, newLevel)
```

- **xp.ts** contains pure functions for the leveling math — no side effects, fully testable
- **persistence.ts** handles all DB operations using Prisma upsert patterns
- **rewards.ts** fetches all rewards at or below the user's level and assigns missing roles

### Bot Commands

#### `/rank [user]`

**File:** `apps/bot/src/commands/leveling/rank.ts`
**Permission:** Everyone
**Cooldown:** 5 seconds

Displays a rank card embed with:
- Level and XP progress within the current level
- Visual progress bar: `[████████░░] 85%`
- Server rank position (#N of total)
- Message count and voice time
- User's avatar as thumbnail

```
📊 Rank — @user
Level: 12
XP: 2,340 / 2,750
Progress: [████████░░] 85%
Rank: #7 of 1,234
Messages: 3,456
Voice: 12h 34m
```

#### `/leaderboard [page]`

**File:** `apps/bot/src/commands/leveling/leaderboard.ts`
**Permission:** Everyone
**Cooldown:** 5 seconds

Paginated top-10 display with medals for top 3:
- Page 1 shows ranks #1-10, page 2 shows #11-20, etc.
- Footer shows current page, total pages, and total ranked members

#### `/xp set|add|remove <user> <amount>`

**File:** `apps/bot/src/commands/leveling/xp.ts`
**Permission:** `ManageGuild`
**Cooldown:** 3 seconds

Admin commands for XP management:
- **set** — Sets exact XP amount, recalculates level
- **add** — Adds XP to current total
- **remove** — Subtracts XP (minimum 0), recalculates level

All subcommands trigger `checkAndGrantRewards` after the XP change to handle retroactive reward assignment.

### Dashboard Page

**Route:** `/guild/:guildId/leveling`
**File:** `apps/dashboard/src/client/routes/guild/$guildId/leveling.tsx`

Five-tab interface:

| Tab | Controls |
|-----|----------|
| **Leaderboard** | Paginated table with rank, user ID, level, XP, messages, voice time |
| **Settings** | Enable/disable, XP per message, cooldown seconds, voice XP toggle, voice XP per minute, announcement channel, announcement message template, announcement enabled |
| **Role Rewards** | Table with level → role ID mapping, add/remove buttons |
| **Exclusions** | No-XP channel IDs (comma-separated), No-XP role IDs (comma-separated) |
| **Multipliers** | Per-channel multipliers (channel ID + multiplier value), per-role multipliers (role ID + multiplier value) |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/guilds/:guildId/leaderboard?page=&limit=` | Paginated leaderboard (max 50 per page) |
| `GET` | `/api/guilds/:guildId/levels/:userId` | User level info + rank |
| `PUT` | `/api/guilds/:guildId/levels/:userId` | Admin set XP (body: `{ xp: number }`) |
| `GET` | `/api/guilds/:guildId/level-settings` | Get guild leveling settings |
| `PUT` | `/api/guilds/:guildId/level-settings` | Update settings (partial update) |
| `GET` | `/api/guilds/:guildId/level-rewards` | List all role rewards |
| `POST` | `/api/guilds/:guildId/level-rewards` | Add reward (body: `{ level, roleId }`) |
| `DELETE` | `/api/guilds/:guildId/level-rewards/:id` | Remove a reward |

---

## Database Schema

All three modules add models to `packages/database/prisma/schema.prisma`:

### WelcomeConfig

```prisma
model WelcomeConfig {
  guildId           String  @id
  welcomeEnabled    Boolean @default(false)
  welcomeChannelId  String?
  welcomeMessage    String  @default("{}")   // JSON: EmbedConfig
  farewellEnabled   Boolean @default(false)
  farewellChannelId String?
  farewellMessage   String  @default("{}")   // JSON: EmbedConfig
  dmEnabled         Boolean @default(false)
  dmMessage         String  @default("{}")   // JSON: EmbedConfig
  autoRoleIds       String  @default("[]")   // JSON: string[]
}
```

One record per guild. All embed configurations and role ID lists are stored as JSON strings for flexibility.

### RolePanel

```prisma
model RolePanel {
  id          Int      @id @default(autoincrement())
  guildId     String
  channelId   String
  messageId   String?                        // Set after panel is sent to Discord
  name        String
  type        String                         // "reaction" | "button" | "dropdown"
  mode        String   @default("toggle")    // "toggle" | "unique" | "verify"
  embed       String   @default("{}")        // JSON: EmbedConfig
  roles       String   @default("[]")        // JSON: RolePanelEntry[]
  maxRoles    Int?                           // For dropdown max selections
  minRoles    Int?                           // For dropdown min selections
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([guildId, messageId])
  @@index([guildId])
}
```

Multiple panels per guild. The `messageId` is `null` until the panel is deployed via `/rolepanel send`.

### UserLevel

```prisma
model UserLevel {
  id            Int       @id @default(autoincrement())
  guildId       String
  userId        String
  xp            Int       @default(0)
  level         Int       @default(0)
  messageCount  Int       @default(0)
  voiceMinutes  Int       @default(0)
  lastMessageXp DateTime?                    // Cooldown tracking
  updatedAt     DateTime  @updatedAt

  @@unique([guildId, userId])
  @@index([guildId, xp])                     // Leaderboard queries (ORDER BY xp DESC)
  @@index([guildId, level])
}
```

### LevelReward

```prisma
model LevelReward {
  id      Int    @id @default(autoincrement())
  guildId String
  level   Int
  roleId  String

  @@unique([guildId, level, roleId])         // Prevent duplicate rewards
  @@index([guildId])
}
```

### LevelGuildSettings

```prisma
model LevelGuildSettings {
  guildId             String  @id
  enabled             Boolean @default(true)
  xpPerMessage        Int     @default(15)
  xpCooldownSeconds   Int     @default(60)
  voiceXpPerMinute    Int     @default(5)
  voiceXpEnabled      Boolean @default(true)
  announceChannel     String?                // null=same channel, "dm"=DM, channelId=specific
  announceMessage     String  @default("{user} just reached **Level {level}**!")
  announceEnabled     Boolean @default(true)
  noXpChannels        String  @default("[]") // JSON: string[]
  noXpRoles           String  @default("[]") // JSON: string[]
  xpMultipliers       String  @default("{}") // JSON: XpMultipliers
}
```

---

## API Reference

### Authentication

All dashboard API routes use two middleware layers:

1. **`requireAuth`** — Validates session cookie, returns 401 if unauthenticated
2. **`requireGuildAdmin`** — Checks the user has admin permissions in the target guild, returns 403 if unauthorized

### Welcome & Farewell API

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/api/guilds/:guildId/welcome` | GET | — | `WelcomeConfig` (defaults if none exists) |
| `/api/guilds/:guildId/welcome` | PUT | Partial `WelcomeConfig` fields | Updated `WelcomeConfig` |
| `/api/guilds/:guildId/welcome/test` | POST | — | `{ success: true }` or error |

### Role Panels API

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/api/guilds/:guildId/role-panels` | GET | — | `RolePanel[]` |
| `/api/guilds/:guildId/role-panels` | POST | `{ name, type, channelId, mode?, roles?, embed?, maxRoles?, minRoles? }` | Created `RolePanel` (201) |
| `/api/guilds/:guildId/role-panels/:panelId` | PUT | Partial panel fields | Updated `RolePanel` |
| `/api/guilds/:guildId/role-panels/:panelId` | DELETE | — | `{ success: true }` |
| `/api/guilds/:guildId/role-panels/:panelId/send` | POST | — | `{ success: true, messageId }` |

### Leveling API

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/api/guilds/:guildId/leaderboard` | GET | Query: `page`, `limit` | `{ entries: UserLevel[], total: number }` |
| `/api/guilds/:guildId/levels/:userId` | GET | — | `UserLevel` with rank |
| `/api/guilds/:guildId/levels/:userId` | PUT | `{ xp: number }` | `AddXpResult` |
| `/api/guilds/:guildId/level-settings` | GET | — | `LevelGuildSettings` |
| `/api/guilds/:guildId/level-settings` | PUT | Partial settings | Updated `LevelGuildSettings` |
| `/api/guilds/:guildId/level-rewards` | GET | — | `LevelReward[]` |
| `/api/guilds/:guildId/level-rewards` | POST | `{ level: number, roleId: string }` | Created `LevelReward` (201) |
| `/api/guilds/:guildId/level-rewards/:id` | DELETE | — | `{ success: true }` |

---

## Testing

### Test Coverage Summary

| Module | Test File | Test Count | Coverage |
|--------|-----------|------------|----------|
| **Welcome** | `packages/systems/tests/unit/welcome.test.ts` | 17 | Variable replacement, embed building, defaults |
| **Welcome** | `apps/bot/tests/commands/general/welcome.test.ts` | 7 | Command permissions, error states, success |
| **Welcome** | `apps/dashboard/tests/server/routes/welcome.test.ts` | 10 | Auth, CRUD, test endpoint |
| **Role Panels** | `packages/systems/tests/unit/rolePanel.test.ts` | 16 | Builder, handler modes, persistence |
| **Role Panels** | `apps/bot/tests/commands/general/rolepanel.test.ts` | 8 | Permissions, send, type variants |
| **Role Panels** | `apps/dashboard/tests/server/routes/rolePanel.test.ts` | 14 | Auth, CRUD, validation |
| **Leveling** | `packages/systems/tests/unit/leveling.test.ts` | ~15 | XP formula, level calc, multipliers |
| **Leveling** | `apps/bot/tests/commands/leveling/rank.test.ts` | ~8 | Rank card, progress bar |
| **Leveling** | `apps/bot/tests/commands/leveling/leaderboard.test.ts` | ~7 | Pagination, empty state |
| **Leveling** | `apps/bot/tests/commands/leveling/xp.test.ts` | ~10 | Set/add/remove, permissions |
| **Leveling** | `apps/dashboard/tests/server/routes/leveling.test.ts` | ~15 | All 8 endpoints |
| | | **~110+ total** | |

### Testing Patterns Used

**Bot commands** — Mock Discord.js interaction object, verify `reply`/`editReply` was called with correct embeds:
```typescript
vi.mock("@fluxcore/systems/welcome/config");
const interaction = createMockInteraction({ guildId: "123" });
await command.execute(interaction);
expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [...] }));
```

**Dashboard routes** — Build Fastify app with mocked auth, test request/response:
```typescript
const app = buildApp();
const response = await app.inject({
  method: "GET",
  url: "/api/guilds/123/welcome",
  headers: { cookie: "session=valid" },
});
expect(response.statusCode).toBe(200);
```

**System functions** — Pure unit tests with mocked Prisma:
```typescript
vi.mock("@fluxcore/database");
const result = xpForLevel(10);
expect(result).toBe(1100);
```

---

## Merge & Deployment

### Merge Order

All three PRs branch from `main` independently. They modify some shared files additively:

| Shared File | Welcome Changes | Roles Changes | Leveling Changes |
|-------------|----------------|---------------|-----------------|
| `schema.prisma` | +WelcomeConfig | +RolePanel | +UserLevel, +LevelReward, +LevelGuildSettings |
| `Sidebar.tsx` | +Welcome nav item | +Role Panels nav item | +Leveling nav item |
| `main.tsx` | +welcome route | +roles route | +leveling route |
| `index.ts` (server) | +registerWelcomeRoutes | +registerRolePanelRoutes | +registerLevelingRoutes |
| `index.ts` (systems) | — | +rolePanel exports | +leveling exports |
| `schemas.ts` | — | +RolePanel schemas | +Leveling schemas |

**Recommended merge order:** Welcome (#24) → Roles (#25) → Leveling (#26)

Each subsequent merge will have minor conflicts in the shared files above — all are purely additive (adding imports and route registrations), so resolution is straightforward: keep both additions.

### Post-Merge Steps

```bash
# After all three PRs are merged into main:
git checkout main
git pull

# Generate Prisma client with new models
pnpm db:generate

# Create and apply database migration
pnpm db:migrate

# Verify everything compiles
pnpm typecheck

# Run all tests
pnpm test

# Register new slash commands with Discord
pnpm deploy:commands
```
