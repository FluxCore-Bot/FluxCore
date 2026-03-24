# FluxCore — Claude Code Context

## Project Identity

FluxCore is a modular Discord bot framework with an integrated admin dashboard. It's a pnpm monorepo using TypeScript, Docker-first development, and PostgreSQL.

**Design System:** "The Obsidian Engine" — dark, technical, premium. See `/design.md` for full tokens.

## Architecture

```
apps/bot/          → Discord bot (discord.js v14, Shoukaku for music)
apps/dashboard/    → Admin UI (Fastify 5 API + React 19 SPA, Vite 6, TanStack Router)
packages/config/   → Environment & configuration
packages/types/    → Shared TypeScript interfaces
packages/utils/    → Logger, embeds, permissions, time helpers
packages/database/ → Prisma 7 ORM + PostgreSQL 18
packages/systems/  → Shared stateful systems (actions, music, tempVoice)
```

**Orchestration:** Turborepo 2.5 for task running and caching.

## Hard Constraints

- **All `pnpm add/install` commands MUST run inside Docker** — host node_modules are owned by root
- **Docker-first:** Use `pnpm dev`, `pnpm test`, etc. (these run via docker-compose)
- **Strict TypeScript** — no `any` unless absolutely unavoidable
- **Feature toggles** — all features are per-guild configurable via database
- **Single source of truth** — PostgreSQL is canonical; in-memory caches sync back
- **No .env access** — never read/write `.env` files; use `.env.example` for reference

## Development Commands

```bash
pnpm dev              # Full stack (bot + dashboard + postgres)
pnpm dev:bot          # Bot + postgres
pnpm dev:dashboard    # Dashboard + postgres
pnpm test             # Run tests (Vitest)
pnpm typecheck        # TypeScript checks
pnpm db:migrate       # Create/apply Prisma migrations
pnpm db:generate      # Regenerate Prisma client
pnpm deploy:commands  # Register Discord slash commands
```

## Key Patterns

- **Commands** live in `apps/bot/src/commands/<module>/` — one file per command
- **Events** live in `apps/bot/src/events/` — one file per gateway event
- **Dashboard routes** live in `apps/dashboard/src/server/routes/`
- **Dashboard pages** live in `apps/dashboard/src/client/pages/`
- **Systems** (tempVoice, music, actions) live in `packages/systems/src/`
- **Database schema** is at `packages/database/prisma/schema.prisma`

## Styling (Dashboard)

- Tailwind CSS 4 with custom tokens from the Obsidian Engine design system
- Radix UI for accessible primitives
- Lucide icons at 1.5px stroke
- Colors: background `#0e0e10`, primary `#a3a6ff`, surfaces are tonal shifts
- Typography: Inter (body), Space Grotesk (labels), JetBrains Mono (code)

## Active Modules

Moderation (basic), Utility, TempVoice, Music, Actions/Automation

## Implementation Plan

**Full plan:** `docs/implementation-plan.md` — master roadmap with phase ordering and dependencies.
**Feature specs:** `docs/features/*.md` — detailed specs per feature (DB schema, API, commands, dashboard).

**IMPORTANT: Always read the relevant feature spec before implementing a module.**

### Phase 1 — Moderation Foundation (current priority)

| Module | Spec | Status |
|--------|------|--------|
| Warn System + Escalation | `docs/features/warn-system.md` | Not Started |
| Enhanced Moderation | `docs/features/moderation.md` | Not Started |
| Logging System | `docs/features/logging.md` | Not Started |

### Phase 2 — Community Engagement

| Module | Spec | Status |
|--------|------|--------|
| Welcome & Farewell | `docs/features/welcome-farewell.md` | Not Started |
| Reaction/Button/Dropdown Roles | `docs/features/reaction-roles.md` | Not Started |
| Leveling / XP System | `docs/features/leveling.md` | Not Started |

### Phase 3 — Community Tools

| Module | Spec | Status |
|--------|------|--------|
| Ticket System | `docs/features/tickets.md` | Not Started |
| Suggestions | `docs/features/suggestions.md` | Not Started |
| Starboard | `docs/features/starboard.md` | Not Started |
| Giveaways | `docs/features/giveaways.md` | Not Started |

### Phase 4 — Automation & Protection

| Module | Spec | Status |
|--------|------|--------|
| Anti-Raid | `docs/features/anti-raid.md` | Not Started |
| Custom Commands | `docs/features/custom-commands.md` | Not Started |
| Scheduled Messages | `docs/features/scheduled-messages.md` | Not Started |

### Scheduled (Later)

- Economy System — high complexity, build after core features stabilize

### Skipped (Discord Native Handles These)

Polls, AutoMod keyword/spam, Timeout, Onboarding, Server Guide, Welcome Screen, Verification Levels, Forum Channels, Threads, Slowmode, Server Insights, Permissions, Pause Invites, Invite Tracking

---

## Agent Workflow

### Memory System

Persistent memory lives at: `~/.claude/projects/-home-abdulkhalek-Projects-FluxCore/memory/`

**ALWAYS save to memory when:**
- An architectural decision is made (e.g. "chose Zustand over Redux because...")
- A new constraint is discovered (e.g. "Lavalink requires Java 17+")
- User corrects your approach or confirms a non-obvious choice
- Project phase or priorities change
- You learn about external references (Linear boards, Figma links, etc.)

**Memory types:** `user`, `feedback`, `project`, `reference` — use the right type.

### Before Starting Work

1. The `SessionStart` hook auto-loads: branch, uncommitted files, recent commits, project phase, open TODOs
2. Read relevant memories if the task touches areas with known constraints
3. For large changes, propose a plan before coding

### While Working

- The `UserPromptSubmit` hook adds current branch + dirty file count to every prompt
- The `PreToolUse` hooks will auto-block unsafe operations (pnpm outside docker, .env access)
- The `PostToolUse` hook will remind you about migrations if you touch schema.prisma
- When editing dashboard UI, the style guard reminds you of design system tokens

### After Completing Work

- The `Stop` hook checks if your conversation involved significant decisions — if so, it reminds you to save to memory
- Always verify your changes: `pnpm typecheck` for type safety, `pnpm test` if tests exist for changed code
- If you modified the database schema: `pnpm db:generate` then `pnpm db:migrate`

### Adding New Modules

When implementing a new module from the planned list:

1. **Bot command:** Create `apps/bot/src/commands/<module>/` directory
2. **Database:** Add models to `packages/database/prisma/schema.prisma`
3. **System logic:** Add to `packages/systems/src/<module>/` if shared between bot and dashboard
4. **Dashboard API:** Add routes in `apps/dashboard/src/server/routes/<module>.ts`
5. **Dashboard UI:** Add page in `apps/dashboard/src/client/pages/<Module>/`
6. **Guild config:** Add feature toggle to guild settings schema
7. **Types:** Export shared interfaces from `packages/types/`

### Git Workflow

- Work on feature branches: `feat/<module>-<feature>`, `fix/<description>`
- Commit messages: `feat(module): description` or `fix(module): description`
- One logical change per commit

## Hooks Reference

Active hooks (configured in `.claude/settings.json`):

| Hook | Event | What it does |
|------|-------|-------------|
| `session-context.sh` | SessionStart | Loads git state, TODOs, project phase into context |
| `prompt-context.sh` | UserPromptSubmit | Injects branch + dirty file count per prompt |
| `guard-pnpm.sh` | PreToolUse (Bash) | Blocks pnpm add/install outside Docker |
| `dashboard-style-guard.sh` | PreToolUse (Edit/Write) | Reminds about design tokens for dashboard files |
| `env-guard.sh` | PreToolUse (Read/Edit/Write) | Blocks access to .env files |
| `schema-change-detector.sh` | PostToolUse (Edit/Write) | Reminds about migrations after schema changes |
| `memory-reminder.sh` | Stop | Prompts to save significant learnings to memory |

## Documentation

- `/design.md` — Full design system specification
- `/docs/ui-ux-agent-prompt.md` — UI/UX design brief
- `/docs/automation-improvement-workflow.md` — Automation workflow docs
- `/docs/music-setup.md` — Music system setup guide
