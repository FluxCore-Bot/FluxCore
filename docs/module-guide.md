# FluxCore — Module Guide

> A comprehensive deep-dive into every module, package, and system in the FluxCore monorepo.
> **Version:** 1.0.0 | **Last Updated:** 2026-07-08

---

## Table of Contents

1. [Project Architecture](#1-project-architecture)
2. [Infrastructure Packages](#2-infrastructure-packages)
   - [@fluxcore/config](#21-fluxcoreconfig)
   - [@fluxcore/types](#22-fluxcoretypes)
   - [@fluxcore/utils](#23-fluxcoreutils)
   - [@fluxcore/database](#24-fluxcoredatabase)
   - [@fluxcore/i18n](#25-fluxcorei18n)
3. [Systems Package](#3-systems-package)
   - [Actions / Automation](#31-actions--automation)
   - [Warnings & Escalation](#32-warnings--escalation)
   - [Moderation](#33-moderation)
   - [Logging](#34-logging)
   - [TempVoice](#35-tempvoice)
   - [Music](#36-music)
   - [Welcome & Farewell](#37-welcome--farewell)
   - [Role Panels](#38-role-panels)
   - [Leveling / XP](#39-leveling--xp)
   - [Tickets](#310-tickets)
   - [Suggestions](#311-suggestions)
   - [Starboard](#312-starboard)
   - [Giveaways](#313-giveaways)
   - [Anti-Raid](#314-anti-raid)
   - [Custom Commands](#315-custom-commands)
   - [Scheduled Messages](#316-scheduled-messages)
4. [Bot Application](#4-bot-application)
   - [Commands](#42-commands)
   - [Events](#43-events)
   - [Feature Systems](#44-feature-systems)
   - [Shared Infrastructure](#45-shared-infrastructure)
5. [Dashboard Application](#5-dashboard-application)
   - [Server API Routes](#52-server-api-routes)
   - [Client Pages](#53-client-pages)
   - [Auth & Security](#54-auth--security)
   - [Dashboard Permissions](#55-dashboard-permissions)
6. [Design System](#6-design-system)
7. [Infrastructure & Tooling](#7-infrastructure--tooling)

---

## 1. Project Architecture

FluxCore is a modular Discord bot framework with an integrated admin dashboard. It follows a monorepo structure managed by pnpm and Turborepo.

```
┌─────────────────────────────────────────────────────────────┐
│                       FluxCore                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌───────────────────────────┐   │
│  │   apps/bot          │    │   apps/dashboard          │   │
│  │   Discord Bot       │    │   Admin Dashboard         │   │
│  │   (discord.js v14)  │    │   (Fastify 5 + React 19)  │   │
│  │   Shoukaku (Lavalink)│   │   Vite 6, TanStack Router │   │
│  └────────┬────────────┘    └───────────┬───────────────┘   │
│           │                              │                    │
│           └──────────┬───────────────────┘                    │
│                      │                                        │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                    Shared Packages                       │   │
│  │                                                          │   │
│  │  @fluxcore/systems    → Business logic (16 modules)     │   │
│  │  @fluxcore/database   → Prisma ORM + PostgreSQL         │   │
│  │  @fluxcore/config     → Environment & configuration     │   │
│  │  @fluxcore/types      → Shared TypeScript interfaces    │   │
│  │  @fluxcore/utils      → Logger, embeds, permissions     │   │
│  │  @fluxcore/i18n       → Internationalization (50+ langs)│   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**

- **Single Source of Truth:** PostgreSQL is canonical; in-memory caches sync back via a cache invalidation pipeline.
- **Command vs Dashboard Split:** Slash commands are for fast in-context actions only. All configuration is dashboard-only to conserve Discord's 100 global command limit.
- **3+ Command Rule:** If a task needs more than 3 commands to complete, it belongs in the dashboard.
- **Feature Toggles:** All features are per-guild configurable via database models.
- **Docker-First:** All development runs inside Docker containers using `docker-compose`.

---

## 2. Infrastructure Packages

### 2.1 `@fluxcore/config`

**Location:** `packages/config/`

**Purpose:** Centralized environment variable loading and typed configuration access for the entire project.

**How it works:**

1. `loadConfig()` reads environment variables using `dotenv`
2. Resolves Docker secret files (`*_FILE` convention — if `FOO_FILE` is set, reads the file at that path for the value)
3. Validates required variables and returns a typed `Config` object
4. The singleton `config` object is exported for use across all packages

**Configuration categories:**

| Category | Variables | Example |
|----------|-----------|---------|
| Discord | `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` | Auth + deployment |
| Dashboard | `DASHBOARD_PORT`, `DASHBOARD_CLIENT_SECRET`, `DASHBOARD_SESSION_SECRET`, `DASHBOARD_CALLBACK_URL`, `DASHBOARD_PUBLIC_URL` | OAuth, sessions, CSRF |
| Bot Sync | `BOT_SYNC_PORT`, `BOT_SYNC_SECRET`, `BOT_SYNC_URL` | Dashboard→bot cache invalidation |
| Database | `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME` | PostgreSQL connection |
| Lavalink | `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD` | Music system |
| General | `LOG_LEVEL`, `NODE_ENV` | Runtime behavior |

**Key files:**
- `src/index.ts` — `loadConfig()`, `Config` interface, exported `config` singleton
- `src/secret-files.ts` — Docker secret file resolution (`readSecretFile()`)

---

### 2.2 `@fluxcore/types`

**Location:** `packages/types/`

**Purpose:** Shared TypeScript interfaces and type definitions consumed by bot, dashboard, and systems packages.

**Modules defined:**

| File | Contents |
|------|----------|
| `src/Command.ts` | Slash command type definition (`Command` interface with data, category, cooldown, execute) |
| `src/Event.ts` | Gateway event type definition (`Event` interface with name, once, execute) |
| `src/anti-raid.ts` | Anti-raid configuration types (join rate, account age, nuke thresholds) |
| `src/custom-commands.ts` | Custom command trigger types (command/keyword/startsWith/regex) and response types |
| `src/dashboard-permissions.ts` | Permission registry (49 permissions across 15 modules), `matchPermission()`, `expandWildcard()`, `ROLE_PRESETS` |
| `src/giveaways.ts` | Giveaway types (prize, winners, requirements) |
| `src/scheduled-messages.ts` | Scheduled message types + `CRON_PRESETS` |
| `src/suggestions.ts` | Suggestion types (status, votes) |
| `src/tickets.ts` | Ticket category, form field, panel types |

---

### 2.3 `@fluxcore/utils`

**Location:** `packages/utils/`

**Purpose:** Shared utility functions used across all packages.

**Modules:**

| File | Export | Purpose |
|------|--------|---------|
| `src/logger.ts` | `logger`, `redactSensitive` | Structured pino-based logger with automatic redaction of tokens/secrets |
| `src/embeds.ts` | `successEmbed`, `errorEmbed`, `infoEmbed`, `warnEmbed` | Discord.js embed builders with consistent styling (color, icon, footer) |
| `src/permissions.ts` | `checkPermissions()`, `checkBotPermissions()`, `isAboveTarget()` | Discord permission checks for command handlers |
| `src/time.ts` | `parseDuration()`, `formatDuration()` | Human-readable duration parsing ("7d", "2h30m") and formatting |
| `src/files.ts` | `getFiles()` | Recursive file discovery for dynamic command/event loading |

---

### 2.4 `@fluxcore/database`

**Location:** `packages/database/`

**Purpose:** Database layer — Prisma 7 ORM client generation, connection management, and the canonical schema for the entire project.

**Key files:**

- `prisma/schema.prisma` — The canonical database schema (30 models)
- `prisma/migrations/` — Migration history (11 applied migrations)
- `src/index.ts` — Public API exports
- `src/client.ts` — Prisma client singleton with connection lifecycle

**Connection flow:**
1. `connectDatabase()` builds the `DATABASE_URL` from config values
2. Creates a Prisma client instance with the PostgreSQL adapter
3. Tests the connection (throws if unreachable)
4. `getPrisma()` returns the singleton
5. `disconnectDatabase()` cleanly shuts down on app exit

**Data conventions:**
- `Int @id @default(autoincrement())` for all model IDs
- Discord IDs stored as `String` (snowflakes)
- JSON data stored as `String @default("[]")` or `String @default("{}")`
- Compound indexes: `@@index([guildId, ...])` on every guild-scoped model
- Compound uniques: `@@unique([guildId, name])` where applicable
- Timestamps: `createdAt @default(now())`, `updatedAt @updatedAt`

**Database models by domain** (see individual module sections for details):

| Domain | Models |
|--------|--------|
| TempVoice | `TempVoiceGuildConfig`, `TempVoiceUserSettings` |
| Automation | `ActionRule`, `ActionLog`, `ActionGuildSettings`, `ActionCacheInvalidation` |
| Reminders | `Reminder` |
| Auth | `DashboardSession` |
| Music | `MusicGuildSettings`, `MusicLibraryAlbum`, `MusicLibraryTrack` |
| Logging | `LogGuildConfig`, `LogEntry` |
| Warnings | `Warning`, `WarnPunishment`, `WarnGuildSettings` |
| Moderation | `ModCase`, `ModGuildSettings` |
| Welcome | `WelcomeConfig` |
| Role Panels | `RolePanel` |
| Leveling | `UserLevel`, `LevelReward`, `LevelGuildSettings` |
| Scheduled Messages | `ScheduledMessage` |
| Custom Commands | `CustomCommand` |
| Anti-Raid | `AntiRaidConfig`, `RaidEvent` |
| Tickets | `TicketPanel`, `Ticket`, `TicketGuildSettings` |
| Giveaways | `Giveaway`, `GiveawayCacheInvalidation` |
| Suggestions | `Suggestion`, `SuggestionGuildSettings` |
| Starboard | `StarboardEntry`, `StarboardGuildSettings` |
| Dashboard Permissions | `DashboardGuildSettings`, `DashboardRole`, `DashboardRoleAssignment`, `DashboardUserPermission`, `DashboardAuditLog` |

---

### 2.5 `@fluxcore/i18n`

**Location:** `packages/i18n/`

**Purpose:** Full internationalization for the dashboard (client + server) supporting 50+ languages including RTL (Arabic, Hebrew, Urdu, Persian).

**Architecture:**

```
packages/i18n/
  src/
    index.ts          → Re-exports types and language registry
    types.ts          → i18n type definitions
    languages.ts      → Supported languages list, RTL detection
    server.ts         → Server-side i18next init (FsBackend)
    client.ts         → Client-side react-i18next init (HttpBackend)
    locales/en/       → Translation files (common.json, errors.json)
    scripts/
      translate.ts    → Translation automation script
```

**Namespaces:**
- `common` — Navigation, buttons, shared UI text
- `errors` — All error messages

**Server usage:** `Accept-Language` header parsing → `getTranslation(lng)` → translated error responses
**Client usage:** `react-i18next` hooks → language switcher in nav → localStorage persistence

**Supported languages (initial):** 48 languages covering European, Asian, Middle Eastern, and African language families. RTL languages get automatic layout switching via Tailwind CSS logical properties.

---

## 3. Systems Package

**Package:** `@fluxcore/systems` | **Location:** `packages/systems/`

This is the core business logic layer — 16 modules of shared stateful logic consumed by both the bot and the dashboard. Each module follows a consistent structure:

```
{module}/
  types.ts        → TypeScript interfaces and enums
  constants.ts    → Default values, limits, configuration constants
  config.ts       → Guild-specific settings with in-memory cache
  persistence.ts  → Database CRUD operations
  cacheSync.ts    → Cache invalidation polling (for cachable modules)
```

---

### 3.1 Actions / Automation

**Status:** Done | **Spec:** `docs/features/actions.md`

A rule engine that triggers automated actions when events occur. This is the most architecturally complex module in the codebase.

**Core concept:** An Action Rule consists of:
- **Event** (what happens — 19 event types)
- **Conditions** (when to fire — optional filters)
- **Actions** (what to do — 10 action types)

**Event types:**
- `memberJoin`, `memberLeave`, `memberUpdate` (username/nickname/roles)
- `messageSent`, `messageEdited`, `messageDeleted`
- `channelCreated`, `channelDeleted`, `channelUpdated`
- `roleCreated`, `roleDeleted`, `roleUpdated`
- `voiceJoin`, `voiceLeave`, `voiceMove`, `voiceStream`
- `modWarn`, `modTimeout`, `modKick`, `modBan`

**Action types:**
- `sendMessage` — Post a message (text or embed) to a channel
- `addRole` / `removeRole` — Modify member roles
- `timeout` / `removeTimeout` — Manage timed-out state
- `kick` / `ban` — Punitive actions
- `warn` — Issue a warning (feeds into warning system)
- `log` — Write to log entries
- `webhook` — Send to external webhook

**Template engine:** Messages support dynamic variables: `{user.name}`, `{user.mention}`, `{server.name}`, `{membercount}`, `{action.reason}`, etc.

**Architecture:**
```
packages/systems/src/actions/
  types.ts             → ActionRule, ActionEvent, ActionCondition, ActionResult
  constants.ts         → Default limits (50 rules max per guild)
  config.ts            → ActionGuildSettings with cache (5s TTL)
  persistence.ts       → ActionRule CRUD, reorder, log queries
  cacheSync.ts         → Polls ActionCacheInvalidation, reloads rules
  templateEngine.ts    → `{variable}` substitution engine
```

**Cache sync flow:**
1. Dashboard writes to database → creates `ActionCacheInvalidation` record
2. Bot's sync server polls for invalidations (every 3 seconds)
3. Bot reloads caches → acknowledges invalidation

---

### 3.2 Warnings & Escalation

**Status:** Done | **Spec:** `docs/features/warn-system.md`

A progressive discipline system — warnings are tracked per-user, and configurable thresholds automatically escalate to timeouts, kicks, or bans.

**Database models:**
- `Warning` — guildId, userId, moderatorId, reason, createdAt
- `WarnPunishment` — guildId, threshold (number of warnings), action (timeout/kick/ban), duration
- `WarnGuildSettings` — guildId, dmOnWarn, reasonRequired, maxWarnings

**Escalation flow:**
1. Moderator issues `/warn` (or action rule triggers a warn action)
2. Warning stored in database
3. Bot checks the user's total active warnings against configured thresholds
4. If a threshold is met, the punishment action fires automatically
5. DM sent to user (if `dmOnWarn` enabled)

**Key constants:** `MAX_REASON_LENGTH = 1000`, `MAX_WARNINGS_PER_USER = 500`

---

### 3.3 Moderation

**Status:** Done | **Spec:** `docs/features/moderation.md`

Enhanced moderation commands with a unified case tracking system. Every punishment creates a `ModCase` entry for auditing.

**Database models:**
- `ModCase` — guildId, targetId, moderatorId, action, reason, duration, expiresAt, active
- `ModGuildSettings` — guildId, dmOnPunishment, modLogChannelId

**Commands that create ModCase entries:**
- `/ban`, `/kick`, `/timeout` — Extended with ModCase creation + DM
- `/tempban` — Temporary ban with automatic unban via scheduler
- `/softban` — Ban + immediate unban (clears messages)
- `/lock` / `/unlock` — Channel lockdown (deny `SendMessages`)
- `/case` / `/cases` — View individual case or all cases for a user
- `/note` — Create a case with action type "NOTE" (no actual punishment)
- `/purge` — Bulk delete with filters (by user, contains text, before message, after time)
- `/clear` / `delete` — Message deletion by count

**Scheduler:** The moderation module runs a 60-second interval that checks for expired tempbans and auto-unbans users.

---

### 3.4 Logging

**Status:** Done | **Spec:** `docs/features/logging.md`

Real-time event logging to configurable Discord channels. 7 categories with per-event toggles, ignored channels/roles, and a dashboard log viewer.

**Categories:**
- `message` — Deletes, edits, bulk deletes
- `member` — Joins, leaves, nickname/role updates
- `voice` — Join, leave, move, stream start/stop
- `channel` — Create, delete, update
- `role` — Create, delete, update
- `server` — Guild settings changes
- `moderation` — All punitative actions

**Database models:**
- `LogGuildConfig` — guildId, category, channelId, enabled, ignoredChannels, ignoredRoles, enabledEvents (all JSON)
- `LogEntry` — guildId, category, eventType, targetId, executorId, content (JSON blob), createdAt

**Key features:**
- Per-event toggles (you can log message deletes but not edits)
- Ignored channels/roles (staff channels don't get logged)
- Message content captures (edited before/after)
- Bulk delete exports (file attachment)
- 90-day retention with automatic cleanup
- Partials support (for uncached message events)

---

### 3.5 TempVoice

**Status:** Done | **Spec:** `docs/features/tempvoice.md`

Temporary voice channels — users join a hub channel and get a private channel created for them, which is automatically deleted when empty.

**Database models:**
- `TempVoiceGuildConfig` — guildId, hubChannelId, categoryId, nameFormat, userLimit, bitrate
- `TempVoiceUserSettings` — guildId, userId, channelId, name, limit, locked, hidden, bitrate, bannedUsers

**Flow:**
1. User joins the designated hub voice channel
2. Bot creates a new voice channel in the configured category
3. User is moved to the new channel
4. User can rename, limit, lock, hide via `/tempvoice` or buttons
5. When the channel is empty, it's automatically deleted

**User commands (via `/tempvoice`):**
- `name <text>` — Rename channel
- `limit <n>` — Set user limit
- `lock` / `unlock` — Toggle join permission
- `hide` / `reveal` — Toggle channel visibility
- `ban <user>` / `unban <user>` — Per-channel user bans
- `claim` — Transfer ownership (if owner left)

---

### 3.6 Music

**Status:** Done | **Spec:** `docs/features/music.md`

Music playback system using Lavalink (via Shoukaku). Supports guild-specific settings and a library system for organizing saved tracks.

**Database models:**
- `MusicGuildSettings` — guildId, mode (normal/dj-only), djRoleId, defaultVolume, twentyFourSeven (stay in VC when empty)
- `MusicLibraryAlbum` — guildId, name, coverUrl, createdBy
- `MusicLibraryTrack` — guildId, albumId, title, url, addedBy

**Bot integration:**
- `/play <query>` — Search and play from YouTube (via Lavalink)
- `/queue` — View current queue
- Buttons: skip, stop, pause/resume, loop, shuffle, volume
- Panel embed that auto-updates as tracks change

**Dj-only mode:** Only users with the DJ role can control playback.

**24/7 mode:** Bot stays in voice channel even when the queue is empty.

---

### 3.7 Welcome & Farewell

**Status:** Not Started | **Spec:** `docs/features/welcome-farewell.md`

Customizable welcome messages (channel + DM) and farewell messages when members join/leave.

**Database model:** `WelcomeConfig` — guildId, welcome/farewell toggles, channel IDs, message templates (JSON embeds), DM settings, auto-role IDs

**Features:**
- Rich embeds with variable substitution (`{user}`, `{server}`, `{membercount}`, `{joindate}`, etc.)
- Welcome message sent to a channel AND optionally as a DM
- Farewell message sent when member leaves
- Auto-role assignment (add roles on join)
- Visual embed builder in the dashboard with live preview

**Bot commands:** `/welcome test` — sends test welcome message using current config

---

### 3.8 Role Panels

**Status:** Not Started | **Spec:** `docs/features/reaction-roles.md`

Self-assignable roles via reactions, buttons, or dropdown menus on messages.

**Database model:** `RolePanel` — guildId, channelId, messageId, name, type (reaction/button/dropdown), mode (toggle/unique/verify), embed config, roles array, maxRoles, minRoles

**Modes:**
- `toggle` — Click to gain, click again to lose
- `unique` — Only one role from the panel at a time
- `verify` — One-time add (cannot remove)

**Constraints:**
- Max 25 roles per panel
- Bot must have role hierarchy position above assigned roles
- Panel creation/editing is entirely dashboard-based

**Bot interaction:** `/rolepanel send <name> [channel]` — sends a panel to a channel. Button clicks and dropdown selections handled via `interactionCreate` with prefix-based custom IDs (`rp_`, `rpd_`).

---

### 3.9 Leveling / XP

**Status:** Not Started | **Spec:** `docs/features/leveling.md`

Gamification system — members earn XP for messages and voice activity, gain levels, unlock role rewards.

**Database models:**
- `UserLevel` — guildId, userId, xp, level, messageCount, voiceMinutes, lastMessageXp
- `LevelReward` — guildId, level, roleId
- `LevelGuildSettings` — guildId, enabled, xpPerMessage, xpCooldown, voiceXpPerMinute, announcement config, exclusions, multipliers

**XP formula:** `5 * level² + 50 * level + 100` XP required per level

**XP sources:**
- **Message XP:** 15-25 XP per message (random range), 60-second cooldown per user. Configurable per-guild.
- **Voice XP:** 1-3 XP per minute in voice, only when not muted/deafened with ≥2 non-bot members.

**Bot commands:**
- `/rank [user]` — Show XP card (everyone)
- `/leaderboard [page]` — Guild leaderboard (everyone)
- `/xp set/add/remove <user> <amount>` — Manage XP (ManageGuild)

**Role rewards:** Checked on level-up AND when reward config changes (retroactive).

---

### 3.10 Tickets

**Status:** Not Started | **Spec:** `docs/features/tickets.md`

Private support channel system — users click a panel button to open a private ticket channel.

**Database models:**
- `TicketPanel` — guildId, channelId, messageId, name, embed config, categories (form fields), createdBy
- `Ticket` — guildId, channelId, userId, category, panelId, status (open/closed/claimed), claimedBy, form responses, transcript
- `TicketGuildSettings` — guildId, staff roles, transcript channel, maxOpenPerUser, autoCloseHours

**Flow:**
1. User clicks a panel button
2. If the panel has form fields, a Discord modal appears (max 5 fields)
3. Private channel created in configured category
4. Opening embed displays user info and category
5. Staff can claim, close, add/remove users
6. On close, HTML transcript generated and saved

**Bot commands:** `/ticket close`, `/ticket add <user>`, `/ticket remove <user>`, `/ticket claim`, `/ticket transcript`

**Auto-close:** Tickets auto-close after configurable hours of inactivity with a 1-hour warning.

---

### 3.11 Suggestions

**Status:** Not Started | **Spec:** `docs/features/suggestions.md`

Community suggestion submission system with voting and status management.

**Database models:**
- `Suggestion` — guildId, userId, content, status (pending/approved/denied/implemented), upvotes, downvotes
- `SuggestionGuildSettings` — guildId, channelId, reviewChannelId, dmOnStatusChange, autoThread, anonymousMode

**Flow:**
1. User submits `/suggest <text>`
2. Bot posts an embed in the suggestions channel with upvote/downvote reactions
3. Optional auto-created discussion thread
4. Moderator approves/denies/implement with reason
5. Embed updates with new status + DM sent to submitter

**Bot commands:** `/suggest <text>` (everyone), `/suggestion approve/deny/implement <id> [reason]` (ManageGuild)

---

### 3.12 Starboard

**Status:** Not Started | **Spec:** `docs/features/starboard.md`

Auto-reposts popular messages to a highlights channel when they reach a configurable star reaction threshold.

**Database models:**
- `StarboardEntry` — guildId, originalMessageId, originalChannelId, starboardMessageId, authorId, starCount
- `StarboardGuildSettings` — guildId, channelId, emoji, threshold, selfStar, ignoredChannels, nsfwHandling

**Flow:**
1. Users react to a message with the star emoji
2. Bot tracks reaction counts (via `messageReactionAdd` / `messageReactionRemove`)
3. When count reaches threshold, message is reposted to starboard channel
4. If count drops below threshold, message is removed from starboard
5. Self-starring optionally allowed

**Bot commands:** None — fully dashboard-configured. The starboard is entirely event-driven.

---

### 3.13 Giveaways

**Status:** Not Started | **Spec:** `docs/features/giveaways.md`

Timed giveaway system with reaction entry, role requirements, multiple winners, and reroll capability.

**Database model:** `Giveaway` — guildId, channelId, messageId, hostId, prize, winner count, endsAt, winnerIds, requiredRoleIds

**Flow:**
1. `/giveaway start <prize> <duration> [winners] [role]`
2. Bot posts an embed with the 🎉 reaction
3. Users react to enter
4. Scheduler checks every 30 seconds for expired giveaways
5. Winners selected randomly, embed updated, DMs sent
6. `/giveaway reroll` picks new winners if needed

---

### 3.14 Anti-Raid

**Status:** Not Started | **Spec:** `docs/features/anti-raid.md`

Protection against raids (mass joins), nuking (mass deletions/changes), and suspicious accounts.

**Database models:**
- `AntiRaidConfig` — guildId, join threshold/window/action, accountAgeMinDays/action, anti-nuke config, whitelisted roles, lockdown settings
- `RaidEvent` — guildId, eventType, details, timestamp

**Detection mechanisms:**
- **Join rate:** In-memory timestamp tracker per guild. If N joins in M seconds exceeded, configured action fires (kick/ban/lockdown).
- **Account age:** Check on join — if account is younger than threshold, action fires.
- **Anti-nuke:** In-memory tracker for mass channel/role deletions and bans. Tracks by executor, not per-guild.
- **Lockdown:** Temporarily prevents all joins (via channel permission changes).

**Bot commands:** `/lockdown`, `/lockdown lift` — only two slash commands for this entire module.

---

### 3.15 Custom Commands

**Status:** Not Started | **Spec:** `docs/features/custom-commands.md`

User-created text commands and auto-responders. Entirely managed via dashboard — no slash commands.

**Database model:** `CustomCommand` — guildId, name, triggerType, response (JSON), actions (JSON), cooldown, allowedRoles, allowedChannels, deletesTrigger, dmResponse

**Trigger types:**
- `command` — `!name` prefix-triggered
- `keyword` — Message contains the keyword
- `startsWith` — Message starts with the text
- `regex` — Regular expression match

**Response types:**
- Text message
- Rich embed (configured via dashboard builder)
- DM response
- Role actions (add/remove)

**Limit:** 50 custom commands per guild.

---

### 3.16 Scheduled Messages

**Status:** Not Started | **Spec:** `docs/features/scheduled-messages.md`

Recurring auto-posted messages on cron schedules. Dashboard-only management.

**Database model:** `ScheduledMessage` — guildId, channelId, name, message (JSON), cronExpr, timezone, enabled, lastRunAt, nextRunAt

**Cron presets:** Every hour, every 6 hours, daily at 9am/midnight, weekly (Monday 9am), monthly (1st at 9am)

**Scheduler:** Polls every 60 seconds for messages where `nextRunAt <= now AND enabled`, sends them, then computes the next run time.

**No slash commands** — all CRUD is dashboard-only.

---

## 4. Bot Application

**Package:** `@fluxcore/bot` | **Location:** `apps/bot/`

**Entry point:** `src/index.ts`

**Startup flow:**
1. Loads configuration (`@fluxcore/config`)
2. Connects database (`@fluxcore/database`)
3. Creates `ExtendedClient` (custom Discord.js Client)
4. Loads commands dynamically from per-module directories
5. Loads events dynamically from per-module feature directories
6. Initializes Shoukaku (Lavalink client for music)
7. Starts the sync HTTP server (for dashboard→bot cache invalidation)
8. Logs in to Discord
9. Registers graceful shutdown handlers

---

### 4.1 Command Architecture

Commands are organized by module in `src/commands/`:

```
commands/
  general/         → General purpose (8 commands)
  moderation/      → Punitive & case management (15 commands)
  utility/         → Misc utilities (3 commands)
  music/           → Music playback (2 commands)
  tempvoice/       → Temp voice management (1 command)
  tickets/         → Ticket management (5 commands)
  suggestions/     → Suggestion management (2 commands)
  giveaways/       → Giveaway management (1 command)
  leveling/        → XP/Rank/Leaderboard (3 commands)
```

**Each command exports:**
```typescript
export const command: Command = {
  data: SlashCommandBuilder,  // Discord slash command definition
  category: string,           // Module category
  cooldown: number,           // Cooldown in seconds
  execute: Function,          // Command handler
};
```

**Command guard flow:**
1. `interactionCreate` event fires
2. Command handler resolves the command file
3. `checkPermissions()` — user has required Discord permissions
4. `checkBotPermissions()` — bot has required Discord permissions
5. `isAboveTarget()` — moderator is above target in role hierarchy
6. Cooldown check (per-user, per-command)
7. Feature toggle check (is this feature enabled for this guild?)
8. Execute command → success embed or error embed

---

### 4.2 Events

Events are organized in `src/events/`:

```
events/
  ready.ts                → Bot startup complete
  interactionCreate.ts    → Slash commands, buttons, modals, selects
  messageCreate.ts        → Message XP, custom commands, swear filter
  messageDelete.ts        → Logging
  messageUpdate.ts        → Logging
  messageBulkDelete.ts    → Logging
  messageReactionAdd.ts   → Starboard, role panels
  messageReactionRemove.ts → Starboard, role panels
  guildMemberAdd.ts       → Welcome, anti-raid, auto-role
  guildMemberRemove.ts    → Farewell, logging
  guildMemberUpdate.ts    → Logging
  guildBanAdd.ts          → Logging, anti-nuke
  guildBanRemove.ts       → Logging
  voiceStateUpdate.ts     → TempVoice, music, voice XP, logging
  channelCreate.ts        → Logging, anti-nuke
  channelDelete.ts        → Logging, anti-nuke
  channelUpdate.ts        → Logging
  roleCreate.ts           → Logging, anti-nuke
  roleDelete.ts           → Logging, anti-nuke
  roleUpdate.ts           → Logging
  guildUpdate.ts          → Logging
```

---

### 4.3 Feature Systems (Bot-Side)

These are bot-specific implementations that consume the shared `@fluxcore/systems` package:

| System | Directory | Purpose |
|--------|-----------|---------|
| **Automation** | `features/automation/system/` | Event bridge — listens to all 19 event types, matches against action rules, executes matched actions. Includes sync server (HTTP endpoint for dashboard→bot cache invalidation). |
| **Music** | `features/music/system/` | Shoukaku node manager, queue controller, track event handlers, now-playing panel (auto-updating embed), settings reactor (applies config changes in real-time). |
| **TempVoice** | `features/tempvoice/system/` | Voice channel lifecycle manager — creates channels on join, deletes on empty, handles button interactions (rename, limit, lock, hide, claim, ban). |
| **Tickets** | `features/tickets/system/` | Panel button handlers, ticket modal forms, channel permission management, auto-close scheduler. |
| **Giveaways** | `features/giveaways/system/` | Reaction entry tracking, winner selection, embed updates. |

---

### 4.4 Shared Bot Infrastructure

| File | Purpose |
|------|---------|
| `shared/client/ExtendedClient.ts` | Custom `Client` subclass with database, Shoukaku, sync server references |
| `shared/handlers/commandHandler.ts` | Dynamic command loading from `commands/<module>/` directories |
| `shared/handlers/eventHandler.ts` | Dynamic event registration from `events/` and `features/*/events/` |
| `shared/systems/reminders.ts` | Polling-based reminder delivery system |
| `shared/systems/customCommandHandler.ts` | `messageCreate` listener for custom commands (trigger matching + execution) |
| `shared/systems/permissionAudit.ts` | Permission check logging for audit trail |

---

## 5. Dashboard Application

**Package:** `@fluxcore/dashboard` | **Location:** `apps/dashboard/`

**Stack:** Fastify 5 (API server) + React 19 SPA (client), Vite 6, TanStack Router, TanStack Query, Tailwind CSS 4, Radix UI, shadcn/ui, Recharts, @xyflow/react

**Entry point:** `src/server/index.ts`

**Startup flow:**
1. Loads configuration
2. Creates Fastify instance with cookie parser, helmet, rate limiter
3. Sets up CSRF double-submit pattern
4. Initializes server-side i18n
5. Registers 19+ API route files
6. In production, serves the built React SPA (from `dist/client/`)
7. Health check endpoint (`/api/health`)
8. Scheduled session cleanup (every hour)
9. Starts listening on configured port

---

### 5.1 Client-Server Split

```
apps/dashboard/src/
  server/          → Fastify API server (TypeScript)
    index.ts       → Server bootstrap
    features/      → Per-module route groups
    shared/        → Auth, crypto, middleware, Discord API wrappers
  client/          → React 19 SPA (TypeScript + TSX)
    main.tsx       → React entry point
    routes/        → TanStack Router route tree
    components/    → UI components (shadcn/ui, custom)
    features/      → Page-level components, landing page
    hooks/         → TanStack Query hooks
    lib/           → API client, i18n client, utils
    styles/        → Tailwind CSS entry
```

---

### 5.2 Server API Routes

| Route File | Endpoints | Purpose |
|------------|-----------|---------|
| `features/auth/routes.ts` | `GET /auth/login`, `/auth/callback`, `/auth/csrf`, `/auth/logout`, `/auth/me` | Discord OAuth2 login flow |
| `features/guilds/routes.ts` | `GET /api/guilds` | List user's guilds (where admin) |
| `features/discord/routes.ts` | `GET /api/guilds/:id/channels`, `/roles`, `/members` | Proxy to Discord API |
| `features/moderation/routes.ts` | CRUD `/api/guilds/:id/moderation/` | ModCases, mod settings |
| `features/moderation/warnings-routes.ts` | CRUD `/api/guilds/:id/warnings/` | Warnings, punishments, settings |
| `features/logging/routes.ts` | `GET /api/guilds/:id/logs` | Log browser, log config |
| `features/actions/routes.ts` | CRUD `/api/guilds/:id/actions/` | Action rules, reorder, analytics |
| `features/music/routes.ts` | CRUD `/api/guilds/:id/music/` | Music settings, library |
| `features/tempvoice/routes.ts` | CRUD `/api/guilds/:id/tempvoice/` | Temp voice config |
| `features/welcome/routes.ts` | `GET/PUT /api/guilds/:id/welcome` | Welcome/farewell config |
| `features/roles/routes.ts` | CRUD `/api/guilds/:id/role-panels/` | Role panels |
| `features/leveling/routes.ts` | CRUD `/api/guilds/:id/leveling/` | Levels, leaderboard, rewards, settings |
| `features/tickets/routes.ts` | CRUD `/api/guilds/:id/tickets/` | Tickets, panels, settings |
| `features/suggestions/routes.ts` | CRUD `/api/guilds/:id/suggestions/` | Suggestions, settings |
| `features/starboard/routes.ts` | `GET/PUT /api/guilds/:id/starboard/` | Starboard entries, settings |
| `features/giveaways/routes.ts` | CRUD `/api/guilds/:id/giveaways/` | Giveaways, end/reroll |
| `features/scheduled/routes.ts` | CRUD `/api/guilds/:id/scheduled/` | Scheduled messages |
| `features/commands/routes.ts` | CRUD `/api/guilds/:id/custom-commands/` | Custom commands |
| `features/security/routes.ts` | CRUD `/api/guilds/:id/antiraid/` | Anti-raid config, events |
| `features/permissions/routes.ts` | `GET /api/guilds/:id/my-permissions` | Permission resolution |
| `features/permissions/roles-routes.ts` | CRUD roles, assignments, presets | Dashboard role management |

**Route conventions:**
- `GET /api/guilds/:guildId/{module}` — List resources
- `POST /api/guilds/:guildId/{module}` — Create resource
- `GET /api/guilds/:guildId/{module}/:id` — Get single resource
- `PUT /api/guilds/:guildId/{module}/:id` — Update resource
- `DELETE /api/guilds/:guildId/{module}/:id` — Delete resource
- All guild routes protected by `requireAuth` + `requireGuildAdmin`
- Validation: helper function returns `string | null`, early return with `reply.code(400)`

---

### 5.3 Client Pages

The dashboard has 19 main pages under `/guild/$guildId/`:

| Route | Page | Features |
|-------|------|----------|
| `/` | Landing | Hero, features, CTA — public, no auth |
| `/overview` | Guild Dashboard | Charts (member growth, message activity), stats cards, recent cases, system health |
| `/moderation` | Moderation | Cases table (filterable, searchable), settings panel (DM toggle, mod log channel) |
| `/warnings` | Warnings | Stats bar, warning history table, escalation config (threshold → action), settings |
| `/logs` | Logs | Per-category config (channel, event toggles), log browser with filters, stats |
| `/music` | Music | Guild settings (mode, DJ role, volume, 24/7), library management (albums, tracks) |
| `/tempvoice` | TempVoice | Hub channel, category, name format, bitrate, user limit config |
| `/welcome` | Welcome | Welcome/farewell toggle + embed builder + auto-role, live preview, test button |
| `/roles` | Role Panels | Panel list, builder (name, type, mode, embed, role entries with emoji picker) |
| `/leveling` | Leveling | Leaderboard, settings (XP rate, cooldown, voice), rewards table, exclusions |
| `/tickets` | Tickets | Active tickets, panel builder (categories, form fields, embed), settings |
| `/suggestions` | Suggestions | List with filters, status management, settings |
| `/starboard` | Starboard | Settings (channel, threshold, emoji), starred messages gallery |
| `/giveaways` | Giveaways | Active/past giveaways, create form |
| `/rules` | Automation | Workflow editor (visual node-based), rule list, analytics |
| `/commands` | Custom Commands | Command list, response editor (text/embed), permissions config |
| `/scheduled` | Scheduled Messages | Message list, create/edit form (cron picker, embed builder), test send |
| `/security` | Anti-Raid | Join rate thresholds, account age filter, anti-nuke, lockdown toggle, raid timeline |
| `/permissions` | Permissions | Enable/disable toggle, role list + permission grid, user overrides, audit log |
| `/settings` | Guild Settings | General guild configuration |

---

### 5.4 Auth & Security

**Authentication flow:**
1. User clicks "Login with Discord" → redirected to `/auth/login`
2. Server generates a random `state` value, stores it as a signed `oauth_state` cookie (`SameSite=Lax`, 5-minute expiry), and redirects to Discord's OAuth authorization URL
3. Discord redirects to `/auth/callback?code=...&state=...`
4. Server validates the `state` parameter against the cookie, then burns the cookie (prevents replay)
5. Server exchanges the `code` for an access token via Discord's token endpoint
6. Server fetches user info and guild list via Discord API
7. Server creates a session in PostgreSQL (access token encrypted with AES-256-GCM)
8. Old sessions for the same user are deleted (session fixation protection)
9. Server sets a `session` cookie (`SameSite=Lax`, 24-hour TTL) and redirects to `/`

**Security measures:**
- **CSRF protection:** Double-submit cookie pattern — JS-readable `csrf_token` cookie must match `x-csrf-token` header on all mutating API requests
- **Rate limiting:** 10 requests/minute on auth endpoints
- **OAuth state busting:** Cookie is cleared immediately after validation, before the token exchange — prevents replay attacks even if the exchange fails
- **Encrypted tokens:** OAuth access tokens encrypted with AES-256-GCM before database storage
- **Session cleanup:** Expired sessions deleted every hour
- **CSP:** Content Security Policy via `@fastify/helmet`
- **Middleware stack:** `requireAuth` → `requireGuildAdmin` → (optional) `requirePermission` on all guild routes

---

### 5.5 Dashboard Permissions

**Status:** Not Started | **Spec:** `docs/features/dashboard-permissions.md`

Granular RBAC system for the dashboard. `MANAGE_GUILD` permission is the entry gate; this adds fine-grained control within that gate.

**Permission format:** `<module>.<resource>.<action>`
Example: `moderation.cases.view`, `music.settings.manage`

**49 permissions across 15 modules**, covering:
- View vs Manage access separation
- Module-level wildcards (`moderation.*`)
- Resource-level wildcards (`*.settings.manage`)
- Global wildcard (`*`)

**Built-in presets:**
- Full Admin — `*`
- Moderator — moderation, warnings, logs
- Content Manager — welcome, roles, suggestions, starboard
- Music DJ — music only
- Viewer (Read-Only) — all `.view` permissions

**Resolution order:**
1. Guild owner → `*` (full access)
2. If `requirePermissions` is off → full access (legacy mode)
3. Merge role permissions (from assigned `DashboardRole`)
4. Apply per-user overrides (`DashboardUserPermission`)
5. First wildcard match wins

---

## 6. Design System

**Name:** "The Obsidian Engine"
**File:** `design.md`

**Aesthetic:** Dark, technical, premium — like carved obsidian.

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0e0e10` | Absolute base |
| `primary` | `#a3a6ff` | Critical actions, brand moments |
| `primary-dim` | `#6063ee` | Gradient endpoints, secondary emphasis |
| `secondary` | `#ac8aff` | Technical accents, syntax highlighting |
| `on-primary` | `#0f00a4` | Text on primary surfaces |
| `surface-lowest` | `#000000` | Recessed areas, code blocks |
| `surface-low` | `#131315` | Main content areas |
| `surface-container` | `#19191c` | Container default |
| `surface-high` | `#1f1f22` | Elevated cards |
| `surface-hover` | `#262528` | Hover states, active tabs |
| `surface-bright` | `#2c2c2f` | Brightest surface |
| `danger` | `#ff6e84` | Errors, destructive actions |
| `success` | `#57f287` | Success states |
| `warning` | `#fee75c` | Warnings |
| `info` | `#60a5fa` | Informational |
| `text` | `#f9f5f8` | Primary text (never pure white) |
| `text-muted` | `#adaaad` | Secondary/muted text |
| `border` | `#1f1f22` | Default borders |
| `outline` | `#767577` | Visible outlines |
| `ring` | `#a3a6ff` | Focus rings |

### Typography

| Face | Usage |
|------|-------|
| **Inter** | Body — all UI controls, headers, descriptions |
| **Space Grotesk** | Labels — technical metadata, small tags |
| **JetBrains Mono** | Code — bot tokens, JSON, logs, metrics |

### Elevation (Surface Shift, No Shadows)

| Level | Token | Usage |
|-------|-------|-------|
| 0 | `background` | Base page |
| 1 | `surface-low` | Large content blocks |
| 2 | `surface-high` | Interactive cards |
| 3 | `surface-hover` | Tooltips, dropdowns, modals |

### Rules

1. **No-Line Rule:** No 1px borders for sectioning — use surface shifts
2. **No Pure White:** Use `#f9f5f8` for text
3. **Max 3 Depth Levels:** If you need a 4th, simplify the IA
4. **No Dividers in Lists:** Use spacing + hover backgrounds
5. **Technical Data in Mono:** Auto-switch inputs with technical content

---

## 7. Infrastructure & Tooling

### Docker Compose

Profiles for different development scenarios:

| Profile | Services | Usage |
|---------|----------|-------|
| `bot` | bot + postgres + lavalink | `pnpm dev:bot` |
| `dashboard` | dashboard + postgres | `pnpm dev:dashboard` |
| `full` | all services | `pnpm dev` |
| `preview` | prebuilt production images | `pnpm preview` |
| `tools` | pgAdmin | `pnpm dev --profile tools` |

### Key Ports

| Port | Service |
|------|---------|
| 3000 | Dashboard API (Fastify) |
| 5173 | Vite HMR (development) |
| 5432 | PostgreSQL |
| 2333 | Lavalink |
| 5050 | pgAdmin |

### Root Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `pnpm dev` | `docker compose --profile full up` | Full stack |
| `pnpm dev:bot` | `docker compose --profile bot up` | Bot only |
| `pnpm dev:dashboard` | `docker compose --profile dashboard up` | Dashboard only |
| `pnpm test` | `vitest run` | Unit tests |
| `pnpm test:integration` | Integration tests (real PG) | Cross-boundary tests |
| `pnpm db:migrate` | `prisma migrate dev` | Create/apply migrations |
| `pnpm db:generate` | `prisma generate` | Regenerate Prisma client |
| `pnpm db:studio` | `prisma studio` | Database GUI |
| `pnpm deploy:commands` | Register slash commands | Discord API |
| `pnpm typecheck` | TypeScript checks | All packages |

### Testing

**Categories:**

| Category | Location | Database | When to use |
|----------|----------|----------|-------------|
| Unit | `apps/*/tests/`, `packages/*/tests/` | Mocked | Logic in isolation |
| Integration | `packages/systems/tests/integration/` | Real PostgreSQL | Cross-boundary flows |
| E2E | `apps/dashboard/tests/e2e/` | Real PG + Discord mock | Full user flows |

**Test infrastructure:**
- Vitest for unit/integration tests
- Playwright for E2E tests
- Docker-based test PostgreSQL (tmpfs for speed)
- Shared factories at `packages/systems/tests/helpers/factories.ts`
- Discord.js object mocks (`createMockInteraction()`, `createMockMember()`)
- Silent logger mocking (`vi.mock("@fluxcore/utils")`)

---

## Module Dependency Map

```
                    ┌──────────────┐
                    │  Anti-Raid   │
                    └──────┬───────┘
                           │
┌──────────┐     ┌────────▼────────┐     ┌──────────────┐
│ Welcome  │     │    Logging      │     │    Tickets   │
│ Farewell │     │                 │     │              │
└────┬─────┘     └────▲───▲───▲───┘     └──────┬───────┘
     │                │   │   │                │
     │     ┌──────────┘   │   └──────────┐     │
     │     │     ┌────────┴────────┐     │     │
     │     │     │   Moderation    │     │     │
     │     │     │ (cases, tempban)│     │     │
     │     │     └────▲────────▲───┘     │     │
     │     │          │        │         │     │
     │     │     ┌────┴────────┴───┐     │     │
     │     │     │  Warn System    │     │     │
     │     │     │  + Escalation   │     │     │
     │     │     └────────▲───────┘     │     │
     │     │              │             │     │
     │     │     ┌────────┴────────┐    │     │
     │     │     │   Actions /     │    │     │
     │     │     │  Automation     │    │     │
     │     │     └─────────────────┘    │     │
     │     │                            │     │
     │  ┌──┴────────────────────────────┴──┐  │
     │  │         Role Panels              │  │
     │  └──────────────────────────────────┘  │
     │                                        │
┌────▼────────────────────────────────────────▼──┐
│                 Leveling / XP                    │
└───────────────────▲─────────────────────────────┘
                    │
          ┌─────────┴──────────┐
          │      Music         │
          └────────────────────┘
```

---

## Status Overview

| Module | Phase | Priority | Status |
|--------|-------|----------|--------|
| Actions / Automation | 1 | P0 | Done |
| Warnings & Escalation | 1 | P0 | Done |
| Moderation (Enhanced) | 1 | P0 | Done |
| Logging | 1 | P0 | Done |
| Music | 2 | P0 | Done |
| TempVoice | 2 | P0 | Done |
| Welcome & Farewell | 2 | P0 | Not Started |
| Role Panels | 2 | P0 | Not Started |
| Leveling / XP | 2 | P1 | Not Started |
| Tickets | 3 | P1 | Not Started |
| Anti-Raid | 4 | P1 | Not Started |
| Suggestions | 3 | P2 | Not Started |
| Starboard | 3 | P2 | Not Started |
| Giveaways | 3 | P2 | Not Started |
| Custom Commands | 4 | P2 | Not Started |
| Scheduled Messages | 4 | P2 | Not Started |
| Dashboard Permissions | Cross | — | Not Started |

---

*This document is auto-generated from the codebase and feature specs. Last updated: 2026-07-08.*
