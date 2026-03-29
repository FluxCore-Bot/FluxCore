# FluxCore — Project Index

> Auto-generated on 2026-03-29. Comprehensive repository map for navigation and onboarding.

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
│   ├── systems/                # Shared stateful systems
│   ├── types/                  # Shared TypeScript interfaces
│   └── utils/                  # Logger, embeds, permissions, time
├── docs/                       # Feature specs & planning docs
│   └── features/               # Per-feature specification files
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

#### Commands (26)

| Module | Commands |
|--------|----------|
| **General** (4) | `help`, `ping`, `server-info`, `user-info` |
| **Moderation** (14) | `ban`, `case`, `cases`, `clear`, `clearwarnings`, `kick`, `lock`, `note`, `purge`, `softban`, `tempban`, `timeout`, `unlock`, `warn` |
| **Utility** (3) | `avatar`, `embed-builder`, `remind` |
| **Music** (2) | `play`, `queue` |
| **Voice** (1) | `tempvoice` |
| **Admin** (1) | `actions` |

#### Events (18)

`channelCreate`, `channelDelete`, `channelUpdate`, `guildBanAdd`, `guildBanRemove`, `guildMemberAdd`, `guildMemberRemove`, `guildMemberUpdate`, `guildUpdate`, `interactionCreate`, `messageBulkDelete`, `messageDelete`, `messageUpdate`, `ready`, `roleCreate`, `roleDelete`, `roleUpdate`, `voiceStateUpdate`

#### Bot Systems

| System | Files | Purpose |
|--------|-------|---------|
| Music | `music/` (8 files) | Lavalink integration, queue, panel, events, settings |
| TempVoice | `tempVoice/` (2 files) | Temporary voice channel lifecycle |
| Actions | `actions/` (4 files) | Event bridge, executor, registry, sync |
| Reminders | `reminders.ts` | Scheduled reminder system |
| Permissions | `permissionAudit.ts` | Permission auditing |

#### Handlers

| File | Purpose |
|------|---------|
| `handlers/commandHandler.ts` | Command loading & execution |
| `handlers/eventHandler.ts` | Event registration |

---

### Dashboard (`apps/dashboard/` — @fluxcore/dashboard)

**Server:** Fastify 5 API
**Client:** React 19 SPA (Vite 6, TanStack Router)

#### API Routes (9)

| Route | Purpose |
|-------|---------|
| `auth.ts` | OAuth2 authentication |
| `actions.ts` | Action/automation CRUD |
| `discord.ts` | Discord API proxy |
| `guilds.ts` | Guild management |
| `logging.ts` | Logging configuration |
| `moderation.ts` | Moderation data |
| `music.ts` | Music settings |
| `tempvoice.ts` | TempVoice configuration |
| `warnings.ts` | Warning management |

#### Client Routes (11)

```
/ (root)
├── /                           → Landing page
└── /guild/$guildId
    ├── /overview               → Guild dashboard
    ├── /rules                  → Automation rules
    ├── /tempvoice              → TempVoice settings
    ├── /settings               → Guild settings
    ├── /logs                   → Event log browser
    ├── /music                  → Music settings & library
    ├── /warnings               → Warning management
    └── /moderation             → Moderation cases
```

#### Components (58)

| Category | Count | Key Components |
|----------|-------|----------------|
| **Layout** | 4 | `Sidebar`, `PageHeader`, `PageSkeleton`, `Icon` |
| **Feature** | 12 | `ActionFields`, `RuleForm`, `RuleList`, `EventLogBrowser`, `EventLogConfig`, `LogsTable`, `MusicSettingsForm`, `MusicLibraryManager`, `TempVoiceForm`, `SettingsForm`, `ConditionsEditor`, `VariableHelper` |
| **Landing** | 5 | `LandingPage`, `HeroSection`, `FeaturesSection`, `CTASection`, `Footer` |
| **Overview** | 3 | `ExecutionChart`, `EventDistributionChart`, `RecentActivityFeed` |
| **Workflow** | 6 | `WorkflowEditor`, `NodeDetailPanel`, `TriggerNode`, `ActionNode`, `AddActionNode`, `ConditionNode`, `DelayNode` |
| **UI (shadcn)** | 19 | `alert`, `badge`, `button`, `card`, `checkbox`, `collapsible`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `skeleton`, `slider`, `switch`, `table`, `tabs`, `textarea`, `tooltip`, `sonner` |
| **Misc** | 4 | `ConfirmDialog`, `EmptyState`, `GuildCard`, `StatsCard`, `RefreshDataWidget` |

#### Custom Hooks (18)

`useAnalytics`, `useAuth`, `useBotInfo`, `useChannels`, `useConstants`, `useGuilds`, `useLogging`, `useLogs`, `useModeration`, `useMobileSidebar`, `useMusic`, `usePreferences`, `useRoles`, `useRuleDraft`, `useRules`, `useSettings`, `useTempVoice`, `useWarnings`

#### Client Lib

`schemas.ts` (Zod validation), `client.ts` (API client), `utils.ts`, `rule-icons.ts`, `workflow-validation.ts`

---

## Packages

### `packages/database/` (@fluxcore/database)

**Schema:** `prisma/schema.prisma`
**Migrations:** 9 applied

| Model | Domain |
|-------|--------|
| `TempVoiceGuildConfig`, `TempVoiceUserSettings` | TempVoice |
| `ActionRule`, `ActionLog`, `ActionGuildSettings`, `ActionCacheInvalidation` | Actions/Automation |
| `Reminder` | Reminders |
| `DashboardSession` | Auth |
| `MusicGuildSettings`, `MusicLibraryAlbum`, `MusicLibraryTrack` | Music |
| `LogGuildConfig`, `LogEntry` | Logging |
| `Warning`, `WarnPunishment`, `WarnGuildSettings` | Warnings |
| `ModCase`, `ModGuildSettings` | Moderation |

---

### `packages/systems/` (@fluxcore/systems)

Shared stateful logic consumed by both bot and dashboard.

| System | Files | Purpose |
|--------|-------|---------|
| **Actions** | `config`, `types`, `constants`, `persistence`, `cache`, `cacheSync`, `templateEngine` | Rule engine with cache sync |
| **Logging** | `types`, `constants`, `config`, `persistence`, `formatter`, `sender` | Event logging pipeline |
| **TempVoice** | `types`, `constants`, `config`, `persistence` | TempVoice configuration |
| **Music** | `types`, `constants`, `config`, `library` | Music settings & library |
| **Moderation** | `types`, `constants`, `persistence`, `scheduler`, `dm` | Case management, tempban scheduler |
| **Warnings** | `types`, `constants`, `config`, `persistence`, `escalation` | Warning system with auto-escalation |
| **Shared** | `cooldown.ts`, `reminders.ts` | Cooldown manager, reminder scheduling |

---

### `packages/types/` (@fluxcore/types)

| File | Purpose |
|------|---------|
| `Command.ts` | Slash command type definitions |
| `Event.ts` | Gateway event type definitions |

---

### `packages/utils/` (@fluxcore/utils)

| File | Purpose |
|------|---------|
| `logger.ts` | Structured logging |
| `embeds.ts` | Discord embed builders |
| `permissions.ts` | Permission checking utilities |
| `time.ts` | Duration parsing & formatting |
| `files.ts` | File handling utilities |

---

### `packages/config/` (@fluxcore/config)

Single `src/index.ts` — environment variable loading and validation.

---

## Tests

### Bot Tests (35 files)

| Category | Count | Location |
|----------|-------|----------|
| Command tests | 19 | `apps/bot/tests/commands/` |
| Event tests | 5 | `apps/bot/tests/events/` |
| System tests | 4 | `apps/bot/tests/systems/` |
| Utility tests | 5 | `apps/bot/tests/utils/` |
| Client tests | 1 | `apps/bot/tests/client/` |
| Config tests | 1 | `apps/bot/tests/config/` |

### Dashboard Tests (10 files)

| Category | Count | Location |
|----------|-------|----------|
| Server middleware/auth | 4 | `apps/dashboard/tests/server/` |
| Route tests | 6 | `apps/dashboard/tests/server/routes/` |

### Integration Tests (3 files)

| Test | Location |
|------|----------|
| Actions sync | `packages/systems/tests/integration/actions-sync.test.ts` |
| Cache sync | `packages/systems/tests/integration/cache-sync.test.ts` |
| Music sync | `packages/systems/tests/integration/music-sync.test.ts` |

**Total test files: 48**

---

## Documentation

| File | Purpose |
|------|---------|
| `design.md` | "The Obsidian Engine" design system tokens |
| `docs/implementation-plan.md` | Master 4-phase roadmap |
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
| `welcome-farewell.md` | 2 | Not Started |
| `reaction-roles.md` | 2 | Not Started |
| `leveling.md` | 2 | Not Started |
| `tickets.md` | 3 | Not Started |
| `suggestions.md` | 3 | Not Started |
| `starboard.md` | 3 | Not Started |
| `giveaways.md` | 3 | Not Started |
| `anti-raid.md` | 4 | Not Started |
| `custom-commands.md` | 4 | Not Started |
| `scheduled-messages.md` | 4 | Not Started |

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
| Bot commands | 26 |
| Bot events | 18 |
| Bot systems | 17 |
| Dashboard routes | 9 |
| Dashboard pages | 11 |
| Dashboard components | 58 |
| Dashboard hooks | 18 |
| Database models | 18 |
| Database migrations | 9 |
| System packages | 35 |
| Test files | 48 |
| Feature specs | 13 |
| **Total tracked source** | **~280** |
