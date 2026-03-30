# FluxCore — Project Index

> Auto-generated on 2026-03-30. Comprehensive repository map for navigation and onboarding.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js >= 18 |
| Language | TypeScript 5 (strict) |
| Discord | discord.js v14 |
| Database | PostgreSQL 18 + Prisma 7 |
| Server | Fastify 5 |
| Frontend | React 19 + TanStack Router + TanStack Query |
| UI | Tailwind CSS 4 + Radix UI + shadcn/ui |
| Charts | Recharts 3 |
| Workflow | @xyflow/react 12 |
| Music | Shoukaku (Lavalink) |
| Testing | Vitest 4 + v8 coverage |
| Build | Turborepo 2.5 + pnpm 10.28 |
| Container | Docker + Docker Compose |
| Proxy | Caddy 2 (production) |

---

## Repository Structure

```
FluxCore/
├── apps/
│   ├── bot/                    # Discord bot application
│   └── dashboard/              # Admin web UI (Fastify API + React SPA)
├── packages/
│   ├── config/                 # Environment & configuration
│   ├── database/               # Prisma ORM + PostgreSQL
│   ├── systems/                # Shared stateful systems (16 modules)
│   ├── types/                  # Shared TypeScript interfaces
│   └── utils/                  # Logger, embeds, permissions, time
├── docs/                       # Feature specs & planning docs
│   └── features/               # Per-feature specification files (13)
├── docker/                     # Support scripts (Caddyfile, backup.sh)
├── docker-compose.yml          # Dev environment
├── docker-compose.prod.yml     # Production environment
├── docker-compose.test.yml     # Test environment (tmpfs postgres)
├── Dockerfile                  # Multi-stage (dev, test, prod-bot, prod-dashboard)
├── turbo.json                  # Turborepo task pipeline
├── design.md                   # "The Obsidian Engine" design system
└── CLAUDE.md                   # AI assistant context
```

---

## Apps

### Bot (`apps/bot/` — @fluxcore/bot)

**Entry:** `src/index.ts` → `src/client/ExtendedClient.ts`

#### Commands (40 across 10 modules)

| Module | Count | Commands |
|--------|-------|----------|
| **Admin** | 2 | `actions`, `lockdown` |
| **General** | 6 | `help`, `ping`, `rolepanel`, `server-info`, `user-info`, `welcome` |
| **Moderation** | 15 | `ban`, `case`, `cases`, `clear`, `clearwarnings`, `kick`, `lock`, `note`, `purge`, `softban`, `tempban`, `timeout`, `unlock`, `warn`, `warnings` |
| **Music** | 2 | `play`, `queue` |
| **Utility** | 3 | `avatar`, `embed-builder`, `remind` |
| **Voice** | 1 | `tempvoice` |
| **Tickets** | 5 | `add`, `claim`, `close`, `remove`, `transcript` |
| **Suggestions** | 2 | `suggest`, `suggestion` |
| **Giveaways** | 1 | `giveaway` |
| **Leveling** | 3 | `leaderboard`, `rank`, `xp` |

#### Events (22)

`channelCreate`, `channelDelete`, `channelUpdate`, `customCommandHandler`, `guildBanAdd`, `guildBanRemove`, `guildMemberAdd`, `guildMemberRemove`, `guildMemberUpdate`, `guildUpdate`, `interactionCreate`, `messageBulkDelete`, `messageCreate`, `messageDelete`, `messageReactionAdd`, `messageReactionRemove`, `messageUpdate`, `ready`, `roleCreate`, `roleDelete`, `roleUpdate`, `voiceStateUpdate`

#### Bot Systems

| System | Directory | Purpose |
|--------|-----------|---------|
| Actions | `systems/actions/` | Event bridge, executor, registry, sync |
| Giveaways | `systems/giveaways/` | Giveaway lifecycle management |
| Music | `systems/music/` | Lavalink integration, queue, panel, events, settings |
| TempVoice | `systems/tempVoice/` | Temporary voice channel lifecycle |
| Tickets | `systems/tickets/` | Ticket system management |

#### Handlers

| File | Purpose |
|------|---------|
| `handlers/commandHandler.ts` | Command loading & execution |
| `handlers/eventHandler.ts` | Event registration |

---

### Dashboard (`apps/dashboard/` — @fluxcore/dashboard)

**Server:** Fastify 5 API
**Client:** React 19 SPA (Vite 6, TanStack Router)

#### API Routes (19)

| Route | Purpose |
|-------|---------|
| `auth.ts` | OAuth2 authentication |
| `actions.ts` | Action/automation CRUD |
| `anti-raid.ts` | Anti-raid configuration |
| `customCommands.ts` | Custom command management |
| `discord.ts` | Discord API proxy |
| `giveaways.ts` | Giveaway management |
| `guilds.ts` | Guild management |
| `leveling.ts` | Leveling/XP configuration |
| `logging.ts` | Logging configuration |
| `moderation.ts` | Moderation data |
| `music.ts` | Music settings |
| `rolePanel.ts` | Role panel management |
| `scheduled-messages.ts` | Scheduled message CRUD |
| `starboard.ts` | Starboard configuration |
| `suggestions.ts` | Suggestion system |
| `tempvoice.ts` | TempVoice configuration |
| `tickets.ts` | Ticket system settings |
| `warnings.ts` | Warning management |
| `welcome.ts` | Welcome/farewell settings |

#### Client Routes (21)

```
/ (root)
├── /                           → Landing page
└── /guild/$guildId
    ├── /overview               → Guild dashboard
    ├── /commands               → Custom commands
    ├── /giveaways              → Giveaway management
    ├── /leveling               → Leveling/XP settings
    ├── /logs                   → Event log browser
    ├── /moderation             → Moderation cases
    ├── /music                  → Music settings & library
    ├── /roles                  → Role panel management
    ├── /rules                  → Automation rules
    ├── /scheduled              → Scheduled messages
    ├── /security               → Anti-raid settings
    ├── /settings               → Guild settings
    ├── /starboard              → Starboard settings
    ├── /suggestions            → Suggestion system
    ├── /tempvoice              → TempVoice settings
    ├── /tickets                → Ticket system
    ├── /warnings               → Warning management
    └── /welcome                → Welcome/farewell system
```

#### Components

| Category | Count | Key Components |
|----------|-------|----------------|
| **UI (shadcn)** | 23 | `alert`, `badge`, `button`, `card`, `checkbox`, `collapsible`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `tooltip` |
| **Workflow** | 10 | `WorkflowEditor`, `NodeDetailPanel`, node components, workflow hooks |
| **Landing** | 5 | `LandingPage`, `HeroSection`, `FeaturesSection`, `CTASection`, `Footer` |
| **Overview** | 3 | `ExecutionChart`, `EventDistributionChart`, `RecentActivityFeed` |

---

## Packages

### `packages/database/` (@fluxcore/database)

**Schema:** `prisma/schema.prisma` (15 KB)
**Migrations:** 11 applied

| Domain | Models |
|--------|--------|
| TempVoice | `TempVoiceGuildConfig`, `TempVoiceUserSettings` |
| Actions/Automation | `ActionRule`, `ActionLog`, `ActionGuildSettings`, `ActionCacheInvalidation` |
| Reminders | `Reminder` |
| Auth | `DashboardSession` |
| Music | `MusicGuildSettings`, `MusicLibraryAlbum`, `MusicLibraryTrack` |
| Logging | `LogGuildConfig`, `LogEntry` |
| Warnings | `Warning`, `WarnPunishment`, `WarnGuildSettings` |
| Moderation | `ModCase`, `ModGuildSettings` |
| Welcome/Farewell | Welcome-related models |
| Leveling | Level/XP-related models |
| Role Panels | Role panel models |
| Tickets | Ticket system models |
| Suggestions | Suggestion models |
| Starboard | Starboard models |
| Giveaways | Giveaway models |
| Anti-Raid | Anti-raid configuration models |
| Custom Commands | Custom command models |
| Scheduled Messages | Scheduled message models |

---

### `packages/systems/` (@fluxcore/systems) — 16 modules, 87 files

Shared stateful logic consumed by both bot and dashboard.

| System | Files | Purpose |
|--------|-------|---------|
| **Actions** | 7 | Rule engine with cache sync, template engine |
| **Anti-Raid** | 6 | Raid detection, tracker, auto-actions |
| **Custom Commands** | 6 | Command executor, matcher, variables |
| **Giveaways** | 6 | Embed builder, scheduler, winner selection |
| **Leveling** | 6 | XP calculation, config, rewards |
| **Logging** | 6 | Event logging pipeline, formatter, sender |
| **Moderation** | 5 | Case management, tempban scheduler, DM notifications |
| **Music** | 4 | Settings, library management |
| **Role Panel** | 5 | Panel builder, handler, persistence |
| **Scheduled Messages** | 5 | Cron scheduler, persistence |
| **Starboard** | 5 | Star handler, config, persistence |
| **Suggestions** | 4 | Config, persistence |
| **TempVoice** | 4 | Configuration, persistence |
| **Tickets** | 6 | Panel builder, transcript, config |
| **Warnings** | 5 | Auto-escalation, config, persistence |
| **Welcome** | 4 | Message builder, config |
| **Shared** | 2 | `cooldown.ts`, `reminders.ts` |

---

### `packages/types/` (@fluxcore/types) — 9 files

| File | Purpose |
|------|---------|
| `Command.ts` | Slash command type definitions |
| `Event.ts` | Gateway event type definitions |
| `anti-raid.ts` | Anti-raid system types |
| `custom-commands.ts` | Custom command types |
| `giveaways.ts` | Giveaway types |
| `scheduled-messages.ts` | Scheduled message types |
| `suggestions.ts` | Suggestion types |
| `tickets.ts` | Ticket system types |

---

### `packages/utils/` (@fluxcore/utils) — 6 files

| File | Purpose |
|------|---------|
| `logger.ts` | Structured logging |
| `embeds.ts` | Discord embed builders |
| `permissions.ts` | Permission checking utilities |
| `time.ts` | Duration parsing & formatting |
| `files.ts` | File handling utilities |

---

### `packages/config/` (@fluxcore/config)

Single `src/index.ts` — environment variable loading for Discord, dashboard, Lavalink, and bot sync configuration.

---

## Tests (90 files)

### Bot Tests (52 files)

| Category | Count | Location |
|----------|-------|----------|
| Command tests | 32 | `apps/bot/tests/commands/{moderation,general,utility,leveling,voice,admin,giveaways,suggestions,tickets}/` |
| Event tests | 8 | `apps/bot/tests/events/` |
| System tests | 4 | `apps/bot/tests/systems/` |
| Utility tests | 5 | `apps/bot/tests/utils/` |
| Client tests | 1 | `apps/bot/tests/client/` |
| Config tests | 1 | `apps/bot/tests/config/` |

### Dashboard Tests (20 files)

| Category | Count | Location |
|----------|-------|----------|
| Server middleware/auth | 3 | `apps/dashboard/tests/server/` |
| API tests | 1 | `apps/dashboard/tests/server/discordApi.test.ts` |
| Route tests | 17 | `apps/dashboard/tests/server/routes/` |

### System Tests (18 files)

| Category | Count | Location |
|----------|-------|----------|
| Integration tests | 6 | `packages/systems/tests/integration/` (actions, cache, music, scheduled-messages, starboard, tickets sync) |
| Unit tests | 8 | `packages/systems/tests/unit/` (welcome, leveling, rolePanel, antiraid, customCommands, giveaways, starboard, suggestions) |
| Test helpers | 4 | `packages/systems/tests/helpers/` (setup, db, factories, cron) |

---

## Documentation

| File | Purpose |
|------|---------|
| `design.md` | "The Obsidian Engine" design system tokens |
| `docs/implementation-plan.md` | Master 5-phase roadmap with decision log |
| `docs/phase2-implementation.md` | Phase 2 detailed planning |
| `docs/automation-improvement-workflow.md` | Automation workflow specs |
| `docs/music-setup.md` | Lavalink/music setup guide |
| `docs/ui-ux-agent-prompt.md` | UI/UX design brief |
| `docs/discord-bots-features-by-category.md` | Feature category analysis |
| `docs/discord-management-bots-feature-analysis.md` | Competitive analysis |

### Feature Specs (`docs/features/`)

| Spec | Phase | Status |
|------|-------|--------|
| `warn-system.md` | 1 | Done |
| `moderation.md` | 1 | Done |
| `logging.md` | 1 | Done |
| `welcome-farewell.md` | 2 | Done |
| `reaction-roles.md` | 2 | Done |
| `leveling.md` | 2 | Done |
| `tickets.md` | 3 | Done |
| `suggestions.md` | 3 | Done |
| `starboard.md` | 3 | Done |
| `giveaways.md` | 3 | Done |
| `anti-raid.md` | 4 | Done |
| `custom-commands.md` | 4 | Done |
| `scheduled-messages.md` | 4 | Done |

---

## Infrastructure

### Docker Profiles

| Profile | Services |
|---------|----------|
| `bot` | bot + postgres + lavalink |
| `dashboard` | dashboard + postgres |
| `full` | bot + dashboard + postgres + lavalink |
| `preview` | preview-bot + preview-dashboard + postgres + lavalink |
| `tools` | pgadmin |

### Production Stack

bot, dashboard, postgres, lavalink, caddy (reverse proxy), backup (cron)
Resource limits: bot 512M, dashboard 256M, postgres 512M, caddy 128M, backup 256M

### Key Ports

| Port | Service |
|------|---------|
| 3000 | Dashboard API |
| 5173 | Vite HMR |
| 5432 | PostgreSQL |
| 2333 | Lavalink |
| 5050 | pgAdmin |

---

## File Counts

| Area | Files |
|------|-------|
| Bot commands | 40 |
| Bot events | 22 |
| Bot systems | 5 dirs |
| Dashboard API routes | 19 |
| Dashboard pages | 21 |
| Dashboard UI components | 23 (shadcn) |
| System packages | 87 |
| Database migrations | 11 |
| Test files | 90 |
| Feature specs | 13 |
| **Total tracked source** | **~382** |
