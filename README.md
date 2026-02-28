<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=5865F2&height=200&section=header&text=FluxCore&fontSize=80&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=The%20All-in-One%20Discord%20Bot%20Framework&descAlignY=60&descAlign=50" width="100%"/>

<br/>

**A modular, production-ready Discord bot built for scale — featuring deep guild customization, persistent voice systems, rich moderation tools, and a complete economy engine.**

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-5865F2?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥18.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma%20ORM-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.prisma.io)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io)

</div>

---

## Table of Contents

- [Overview](#-overview)
- [Feature Modules](#-feature-modules)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Manual Setup](#-manual-setup)
- [Environment Variables](#-environment-variables)
- [Commands Reference](#-commands-reference)
- [Flagship: TempVoice System](#-flagship-tempvoice-system)
- [Roadmap](#-roadmap)
- [Admin Dashboard](#-admin-dashboard)
- [Contributing](#-contributing)
- [License](#-license)

---

## Overview

**FluxCore** is a fully self-hosted, all-in-one Discord bot designed with a focus on modularity, performance, and deep per-guild customization. Every feature is toggleable per server. Settings persist in a PostgreSQL database. The bot scales from a single server to thousands with minimal configuration changes.

The project is structured as a framework-first bot — shipping core infrastructure (command loading, event routing, permission auditing, cooldown management, and database persistence) alongside fully-featured modules that serve as both production-ready tools and implementation references.

> This is an active project. Features marked **Planned** are on the roadmap and will land in upcoming releases.

---

## Feature Modules

| Module | Status | Highlights |
|--------|--------|-----------|
| [Moderation](#moderation-system) | ✅ Active | Ban, kick, timeout, clear — with reason tracking |
| [Logging System](#logging-system) | 📋 Planned | Message edits/deletes, audit events, per-guild config |
| [Voice System](#-flagship-tempvoice-system) | ✅ Active | Full TempVoice — persistent settings, control panel, ownership transfer |
| [Utility](#utility-system) | ✅ Active | Reminders, embed builder, user/server info, avatar |
| [Economy](#economy-system) | 📋 Planned | Currency, shop, daily rewards, leaderboards |
| [Leveling](#leveling-system) | 📋 Planned | Text/voice XP, role rewards, rank cards |
| [Reaction Roles](#reaction-roles) | 📋 Planned | Button roles, dropdown roles, temp roles |
| [Ticket System](#ticket-system) | 📋 Planned | Panel creation, claim system, transcript export |
| [Welcome & Goodbye](#welcome--goodbye-system) | 📋 Planned | Custom embeds, DM welcome, captcha, auto-role |
| [Security & Anti-Abuse](#security--anti-abuse) | 📋 Planned | Anti-nuke, anti-raid, server snapshots |
| [Fun Module](#fun-module) | 📋 Planned | Mini-games, AI chat, memes, trivia |
| [Admin Dashboard](#-admin-dashboard) | 📋 Planned | Web UI — Django + DRF + Discord OAuth2 |

**Legend:** ✅ Implemented &nbsp;|&nbsp; 🚧 In Progress &nbsp;|&nbsp; 📋 Planned

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js ≥ 18 | Bot process host |
| **Language** | TypeScript 5 (strict) | Type-safe development |
| **Discord API** | discord.js v14 | Gateway, REST, interactions |
| **Database** | PostgreSQL 18 | Persistent guild & user data |
| **ORM** | Prisma 7 + `@prisma/adapter-pg` | Schema management, type-safe queries |
| **Testing** | Vitest + v8 coverage | Unit & integration tests |
| **Containerization** | Docker + Docker Compose | Dev & production deployment |
| **Package Manager** | pnpm 10 | Fast, disk-efficient installs |
| **Web Dashboard** *(planned)* | Django + DRF | REST API & admin panel |
| **Auth** *(planned)* | Discord OAuth2 | Guild-level dashboard access |

---

## Architecture

FluxCore is a **pnpm monorepo** powered by **Turborepo** for task orchestration and **Docker** for containerized development and production.

```
FluxCore/
├── apps/
│   ├── bot/                 # Discord bot application
│   │   └── src/
│   │       ├── client/      #   Extended Discord client
│   │       ├── commands/    #   Slash commands (per-module)
│   │       ├── events/      #   Gateway event handlers
│   │       └── scripts/     #   CLI scripts (command deploy)
│   └── dashboard/           # Web dashboard (Fastify + React)
│       └── src/
│           ├── server/      #   Fastify API server
│           └── client/      #   React SPA (Vite + TanStack Router)
│
├── packages/
│   ├── config/              # Shared environment configuration
│   ├── types/               # Shared TypeScript interfaces
│   ├── utils/               # Logger, embeds, permissions, time helpers
│   ├── database/            # Prisma schema, migrations, client
│   └── systems/             # Shared stateful systems (TempVoice, Actions, etc.)
│
├── docker/                  # Docker support (Caddyfile, backup script)
├── Dockerfile               # Multi-stage build (dev, test, production)
├── docker-compose.yml       # Development stack
├── docker-compose.prod.yml  # Production stack
└── turbo.json               # Turborepo task pipeline
```

### Design Principles

- **Monorepo architecture** — shared packages (`config`, `types`, `utils`, `database`, `systems`) are consumed by both `bot` and `dashboard`
- **Modular by default** — every feature lives in its own directory under `commands/` or `systems/`; adding a module never touches core files
- **Feature toggles per guild** — all major features support per-server enable/disable via database config
- **Infrastructure separation** — the `systems/` layer handles stateful logic; `commands/` only orchestrate
- **Single source of truth** — PostgreSQL is canonical; in-memory caches exist for performance but always sync back
- **Type safety end-to-end** — strict TypeScript throughout, including Prisma-generated types

---

## Quick Start

> Requires **Docker** and **Docker Compose**. No local Node.js or PostgreSQL installation needed.

### 1. Clone and configure

```bash
git clone https://github.com/Abdulkhalek-1/FluxCore.git
cd FluxCore
cp .env.example .env.dev
```

### 2. Fill in your credentials

Edit `.env.dev` with your Discord application credentials:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_dev_guild_id_here   # optional, speeds up command registration
DATABASE_URL=postgresql://fluxcore:fluxcore@postgres:5432/fluxcore
LOG_LEVEL=debug
```

> The `DATABASE_URL` above points to the Docker-managed PostgreSQL container. No changes needed if using Docker.

### 3. Start the development stack

```bash
# Start everything (bot + dashboard + PostgreSQL)
pnpm dev

# Or start only what you need
pnpm dev:bot         # bot + PostgreSQL
pnpm dev:dashboard   # dashboard + PostgreSQL
```

This spins up PostgreSQL, runs Prisma migrations automatically, and starts services with hot-reload via Turborepo. The dashboard is available at `http://localhost:5173` (Vite dev server) and `http://localhost:3000` (API).

### 4. Register slash commands

```bash
pnpm deploy:commands
```

> Set `GUILD_ID` in your env for instant per-guild registration during development. Leave it empty to deploy globally (takes up to 1 hour to propagate).

---

## Running in Production

### Prerequisites

- Docker and Docker Compose
- A `.env.prod` file (copy from `.env.example` and fill in production values)
- A strong `POSTGRES_PASSWORD`

### Start production services

```bash
# Start everything (bot + dashboard + Caddy + PostgreSQL + backup)
pnpm start

# Or start only what you need
pnpm start:bot         # bot + PostgreSQL
pnpm start:dashboard   # dashboard + Caddy + PostgreSQL
```

### Stop production services

```bash
pnpm stop:prod
```

### Production architecture

- **Bot** and **Dashboard** are built using `turbo prune --docker` for optimized, minimal images
- **Caddy** reverse proxy handles automatic TLS via `DASHBOARD_DOMAIN`
- **PostgreSQL** runs on an internal network, not exposed externally
- **Backup service** runs automated daily database backups with configurable retention
- Memory limits are enforced per service (bot: 512M, dashboard: 256M, postgres: 512M, caddy: 128M)

---

## Development Scripts

All scripts run inside Docker containers — no local Node.js required.

### Services

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start full dev stack (bot + dashboard + postgres) |
| `pnpm dev:bot` | Start bot + postgres only |
| `pnpm dev:dashboard` | Start dashboard + postgres only |
| `pnpm stop` | Stop all dev services |

### Build and Quality

| Script | Description |
|--------|-------------|
| `pnpm build` | Compile all packages via Turborepo |
| `pnpm typecheck` | Run TypeScript type checking across the monorepo |
| `pnpm clean` | Remove all `dist/` directories |

### Testing

| Script | Description |
|--------|-------------|
| `pnpm test` | Run all tests once |
| `pnpm test:watch` | Watch mode (bot tests) |
| `pnpm test:coverage` | Coverage report (bot tests) |

### Database

| Script | Description |
|--------|-------------|
| `pnpm db:migrate` | Create and apply new migrations (development) |
| `pnpm db:deploy` | Apply pending migrations (production) |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:studio` | Open Prisma Studio at `localhost:5555` |

### Discord

| Script | Description |
|--------|-------------|
| `pnpm deploy:commands` | Register slash commands with Discord API |

### Docker Profiles

The dev compose supports profiles to selectively start services:

| Profile | Services |
|---------|----------|
| `bot` | bot + postgres |
| `dashboard` | dashboard + postgres |
| `full` | bot + dashboard + postgres |
| `tools` | pgAdmin (database GUI at `localhost:5050`) |

Start pgAdmin alongside dev services:

```bash
docker compose --profile bot --profile tools up --build
```

---

## Environment Variables

### Shared (required by both bot and dashboard)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_TOKEN` | Yes | — | Bot token from Discord Developer Portal |
| `CLIENT_ID` | Yes | — | Application (client) ID |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, or `error` |

### Bot only

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GUILD_ID` | No | — | Dev guild for instant command registration |

### Cache Sync (bot-dashboard communication)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_SYNC_PORT` | No | `3001` | Port for the bot's internal cache sync server |
| `BOT_SYNC_SECRET` | If dashboard | — | Shared secret for sync authentication |
| `BOT_SYNC_URL` | If dashboard | `http://bot:3001` | URL the dashboard uses to reach the bot |

### Dashboard only

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DASHBOARD_PORT` | No | `3000` | Fastify server port |
| `DASHBOARD_CLIENT_SECRET` | If dashboard | — | Discord OAuth2 client secret |
| `DASHBOARD_CALLBACK_URL` | If dashboard | — | OAuth2 callback URL |
| `DASHBOARD_SESSION_SECRET` | If dashboard | — | Session encryption secret |

### Infrastructure (production only)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | Yes (prod) | — | PostgreSQL password |
| `DASHBOARD_DOMAIN` | No | `localhost` | Domain for Caddy reverse proxy (enables auto TLS) |
| `BACKUP_SCHEDULE` | No | `0 2 * * *` | Cron expression for database backups |
| `BACKUP_RETENTION_DAYS` | No | `7` | Days to retain backup files |

---

## Commands Reference

### General

| Command | Description |
|---------|-------------|
| `/ping` | Check bot latency and API response time |
| `/help` | Browse available commands by category |
| `/server-info` | Display server statistics and configuration |
| `/user-info [user]` | View a user's profile, roles, and join date |

### Moderation

| Command | Options | Description |
|---------|---------|-------------|
| `/ban <user>` | `reason`, `delete_days` (0–7) | Permanently ban a member |
| `/kick <user>` | `reason` | Remove a member from the server |
| `/timeout <user>` | `duration`, `reason` | Apply a Discord timeout |
| `/clear <amount>` | `1–100` | Bulk delete messages in a channel |

### Utility

| Command | Options | Description |
|---------|---------|-------------|
| `/avatar [user]` | `user` | Retrieve full-resolution avatar |
| `/remind <time> <message>` | — | Set a personal reminder |
| `/embed-builder` | — | Interactive custom embed creator |

### Voice

| Command | Description |
|---------|-------------|
| `/tempvoice setup` | Configure the TempVoice hub channel for this server |

---

## Flagship: TempVoice System

The TempVoice system is FluxCore's most advanced feature — a fully automated, user-controlled temporary voice channel system.

### How It Works

1. An admin designates a **hub voice channel** via `/tempvoice setup`
2. Any user who joins the hub instantly gets their **own private voice channel** created
3. A **control panel embed** is posted in the new channel with interactive buttons
4. The channel is **automatically deleted** when the last user leaves
5. User preferences are **persisted per guild** — next time they create a channel, their last settings are restored

### Control Panel

The control panel gives channel owners full control without needing any commands:

```
┌──────────────────────────────────────┐
│   🎙️  Your Channel                   │
│   Owner: @username                   │
│   Members: 1 / unlimited             │
├──────────────────────────────────────┤
│  [✏️ Rename]     [👥 Set Limit]      │
│  [🔒 Lock]       [👁️ Hide]           │
│  [💬 Text Chat]  [🚫 Kick User]      │
│  [🔨 Ban User]   [👻 Hide From]      │
│  [📩 Invite]     [🔄 Transfer]       │
│  [⚡ Claim]      [🗑️ Delete]         │
└──────────────────────────────────────┘
```

### Features

| Feature | Description |
|---------|-------------|
| **Auto-creation** | Channel is created the moment a user joins the hub |
| **Auto-cleanup** | Empty channels are deleted automatically |
| **Rename** | Modal input to set a custom channel name |
| **User limit** | Set max members (0 = unlimited) |
| **Lock / Unlock** | Prevent new users from joining |
| **Hide / Unhide** | Make the channel invisible in the sidebar |
| **Text chat** | Toggle the channel's text chat on/off |
| **Kick user** | Remove a member from your channel |
| **Ban user** | Prevent a specific user from rejoining |
| **Hide from user** | Hide the channel from specific users |
| **Invite** | Share a temporary invite link to your channel |
| **Transfer ownership** | Hand control to another member |
| **Claim** | Take ownership of an abandoned channel |
| **Settings persistence** | All settings saved to DB — restored on next session |

### Database Schema (TempVoice)

```sql
-- Per-guild configuration
TempVoiceGuildConfig {
  guildId       String   @id
  hubChannelId  String
  categoryId    String?
  nameTemplate  String   -- Supports {user} placeholder
  createdAt     DateTime
  updatedAt     DateTime
}

-- Per-user-per-guild saved settings
TempVoiceUserSettings {
  id              Int      @id @default(autoincrement())
  guildId         String
  userId          String
  channelName     String?
  userLimit       Int      @default(0)
  isLocked        Boolean  @default(false)
  isHidden        Boolean  @default(false)
  isTextClosed    Boolean  @default(false)
  bannedUserIds   String   -- JSON array
  hiddenFromUserIds String -- JSON array
  createdAt       DateTime
  updatedAt       DateTime
  @@unique([guildId, userId])
}
```

---

## Roadmap

### Moderation System

- [ ] Auto-mod engine: spam detection, caps filter, invite link blocking, banned words
- [ ] Warning system with database tracking and escalation tiers
- [ ] Softban (ban + immediate unban to clear messages)
- [ ] Anti-raid protection with join rate limiting
- [ ] Account age filtering on join
- [ ] Link whitelist
- [ ] Nickname moderation
- [ ] Full audit log viewer

### Logging System

- [ ] Message edit logging (before/after diff)
- [ ] Message delete logging (single and bulk)
- [ ] Role create/update/delete events
- [ ] Channel create/update/delete events
- [ ] Member role change events
- [ ] Voice join/leave/move tracking
- [ ] Emoji and sticker change events
- [ ] Per-guild log channel configuration
- [ ] Log export to JSON

### Voice System Extensions

- [ ] Voice XP tracking (activity-based)
- [ ] Private room permission templates
- [ ] Voice channel activity display

### Economy System

- [ ] Virtual currency with configurable name per guild
- [ ] Daily reward command with streak bonuses
- [ ] Work command with randomized payouts
- [ ] Item shop with per-guild inventory
- [ ] Role purchase via currency
- [ ] Leaderboards (richest users)
- [ ] Voice XP to currency conversion

### Leveling System

- [ ] Text XP with configurable cooldown
- [ ] Voice XP accumulation
- [ ] Role rewards at configurable level thresholds
- [ ] Rank card image generation
- [ ] XP decay for inactive members
- [ ] Per-guild XP multiplier config

### Reaction Roles

- [ ] Button-based role assignment
- [ ] Dropdown (select menu) role picker
- [ ] Temporary roles with expiration
- [ ] Auto-remove roles on member leave

### Ticket System

- [ ] Button-triggered ticket creation
- [ ] Auto category management
- [ ] Staff claim system
- [ ] Ticket transcript export (HTML/JSON)
- [ ] Close with summary embed

### Welcome & Goodbye System

- [ ] Fully customizable embed welcome messages
- [ ] DM welcome messages
- [ ] Optional captcha verification on join
- [ ] Auto role assignment on verified join
- [ ] Leave message logging

### Security & Anti-Abuse

- [ ] Anti-mass-mention detection
- [ ] Anti-ghost-ping detection
- [ ] Anti-nuke protection (rate limit sensitive admin actions)
- [ ] Role & channel backup system
- [ ] Server snapshot restore

### Fun Module

- [ ] Mini-games (trivia, word games)
- [ ] Meme generation command
- [ ] AI chat integration (rate-limited per guild)
- [ ] Random facts command

---

## Admin Dashboard

The FluxCore web dashboard provides a guild management interface accessible via Discord OAuth2.

### Stack

| Component | Technology |
|-----------|-----------|
| Backend API | Fastify 5 |
| Frontend | React 19 + TanStack Router + Zustand |
| Build | Vite + Tailwind CSS 4 |
| Authentication | Discord OAuth2 (per-guild access control) |
| Database | Shared PostgreSQL with the bot (via `@fluxcore/database`) |
| Cache Sync | Internal HTTP sync between bot and dashboard |

### Running the dashboard

The dashboard requires `DASHBOARD_CLIENT_SECRET`, `DASHBOARD_CALLBACK_URL`, and `DASHBOARD_SESSION_SECRET` to be set. It communicates with the bot via the cache sync server (`BOT_SYNC_URL`).

```bash
# Development (Vite dev server on :5173, API on :3000)
pnpm dev:dashboard

# Production (built and served by Fastify, Caddy handles TLS)
pnpm start:dashboard
```

---

## Contributing

Contributions are welcome. Here's how to get started:

### 1. Fork and branch

```bash
git clone https://github.com/Abdulkhalek-1/FluxCore.git
cd FluxCore
git checkout -b feat/your-feature-name
```

### 2. Start the dev environment

```bash
cp .env.example .env.dev
# Fill in your bot token and client ID
pnpm dev
```

### 3. Write your code

- Bot commands go in `apps/bot/src/commands/<module>/`
- Bot event handlers go in `apps/bot/src/events/`
- Shared systems go in `packages/systems/`
- Shared utilities go in `packages/utils/`
- Database schema and migrations go in `packages/database/prisma/`
- Dashboard server routes go in `apps/dashboard/src/server/`
- Dashboard UI components go in `apps/dashboard/src/client/`

### 4. Test your changes

```bash
pnpm test
pnpm test:coverage
```

### 5. Open a pull request

Describe what you've built, reference any related issues, and make sure tests pass.

### Code Standards

- TypeScript strict mode — no `any`, no unchecked types
- All commands must include `description`, `category`, and appropriate `defaultMemberPermissions`
- Errors must be handled — never let an unhandled rejection propagate
- New systems with database requirements must include a Prisma migration
- Keep command files thin — business logic belongs in `packages/systems/`

---

## License

Released under the [MIT License](LICENSE).

---

<div align="center">

Built with TypeScript, discord.js, and a relentless drive to make server management effortless.

**[Report a Bug](https://github.com/Abdulkhalek-1/FluxCore/issues/new?template=bug_report.md)** · **[Request a Feature](https://github.com/Abdulkhalek-1/FluxCore/issues/new?template=feature_request.md)** 
<!-- · **[Join the Support Server](https://discord.gg/your-invite)** -->

<img src="https://capsule-render.vercel.app/api?type=waving&color=5865F2&height=100&section=footer" width="100%"/>

</div>
