# Drop the Music Feature — Design

**Date:** 2026-07-25
**Branch:** `chore/drop-music-feature`
**Status:** Approved, ready for implementation planning

## Goal

Remove the Music module (Lavalink playback, guild music settings, album/track library,
dashboard music page) from FluxCore. The feature is being dropped "for now" — the intent is
retirement, not a temporary disable.

## Motivation

Music carries ongoing cost disproportionate to its use:

- A Lavalink container in all three compose files, including a `preview-lavalink` for the
  preview profile.
- `LAVALINK_PASSWORD` is a **required** environment variable that throws at import time in
  `packages/config/src/index.ts` for **both** the bot and the dashboard. Neither app boots
  without it, even though only the bot uses Lavalink.
- A pending YouTube OAuth refresh-token rotation, tracked as outstanding security debt.
- A `shoukaku` runtime dependency and ~50 source files across all six workspace packages.

## Decisions

Four decisions were settled before design, and they bound everything below.

### D1 — Delete code and infrastructure, keep the database

All music TypeScript, dashboard UI/API, Lavalink infrastructure, locale files, and docs are
deleted. The three Prisma models stay.

**Rationale:** removing `MusicGuildSettings`, `MusicLibraryAlbum`, and `MusicLibraryTrack`
from `schema.prisma` would force a destructive `DROP TABLE` migration and permanently
discard guild data. Worse, keeping the tables while removing the models is not viable —
Prisma compares `schema.prisma` against migration history, so every subsequent
`prisma migrate dev` would want to generate a drop migration. Leaving three unused models
in the schema costs nothing, preserves data, and produces zero drift.

Git history is the archive for the implementation itself.

### D2 — Leave stale permission grants in place

The `music` module and the `dj` preset role are removed from the permission catalog in
`packages/types/src/dashboard-permissions.ts`. Existing `DashboardRole.permissions` JSON
arrays that still contain `music.*` or `music.settings.view` are left untouched.

**Rationale:** once the module leaves the catalog those strings match nothing, so they are
inert. They self-clean the next time an admin saves the role, because the UI only offers
keys that exist in the catalog. A cleanup migration would be a one-way destructive data
edit requiring its own tests, for no functional gain.

### D3 — One branch, one PR, removed inside-out

Removal order: leaf feature code → cross-feature integration points → shared exports and
config → infrastructure → i18n → docs.

**Rationale:** a per-layer split (dashboard PR, then bot PR, then infra PR) does not work
here. `packages/systems` exports and `packages/config` fields are consumed by *both* apps,
so any layer-first split produces a PR that fails `pnpm typecheck` on its own and would
have to be merged in lockstep anyway. Correctness is therefore asserted at the branch tip,
not per-commit.

### D4 — Fix `deploy.ts` as part of this branch

`apps/bot/src/scripts/deploy.ts` resolves its command directory to `apps/bot/src/commands/`,
a directory that no longer exists — the bot was refactored to
`apps/bot/src/features/<module>/commands/` and `commandHandler.ts` was updated to match, but
the deploy script was not. `getFiles()` throws `ENOENT` and the script exits 1, so
`pnpm deploy:commands` is broken for **every** module, not just music.

**Rationale:** deleting `play.ts` and `queue.ts` stops the bot *handling* those commands, but
Discord keeps advertising registered slash commands until a successful full `PUT`. Without
this fix, members still see `/play` in the picker and get "application did not respond" —
the feature would not actually be gone. `deploy.ts` uses `rest.put`, which is a full
replace, so one successful run prunes the removed commands.

The fix mirrors the discovery loop already in `commandHandler.ts`: read `features/`, then
`getFiles()` on each `<feature>/commands/`, tolerating features without a commands
directory.

## Removal Inventory

### Deleted outright (71 files)

| Path | Count | Notes |
| --- | --- | --- |
| `apps/bot/src/features/music/` | 10 | Commands auto-deregister; `commandHandler.ts` globs `features/*/commands/` |
| `packages/systems/src/music/` | 4 | `config.ts`, `constants.ts`, `library.ts`, `types.ts` |
| `apps/dashboard/src/server/features/music/routes.ts` | 1 | |
| `apps/dashboard/src/client/features/music/` | 3 | `MusicLibraryManager`, `MusicSettingsForm`, `useMusic` |
| `apps/dashboard/src/client/routes/guild/$guildId/music.tsx` | 1 | |
| `apps/dashboard/tests/server/features/music/musicRateLimit.test.ts` | 1 | |
| `packages/systems/tests/integration/music-sync.test.ts` | 1 | |
| `packages/i18n/src/locales/*/music.json` | 48 | Every locale has one |
| `lavalink/application.yml` (and the directory) | 1 | |
| `docs/music-setup.md` | 1 | |

### Edited — application code

#### Bot

- `src/index.ts` — Shoukaku init before login, and the node-removal / queue-drain block in shutdown
- `src/events/ready.ts` — the music initialisation block (`loadMusicSettings`, `get247Guilds`, `createQueue`, `setupPlayerEvents`, `registerMusicSettingsReactor`, `waitForNode`)
- `src/events/interactionCreate.ts` — `handleMusicButton`, `handlePlayAutocomplete`, `MU_PREFIX`
- `src/features/automation/system/syncServer.ts` — the `reloadMusic` branch
- `src/scripts/deploy.ts` — the D4 fix
- `package.json` — the `shoukaku` dependency

#### Systems

- `src/index.ts` — the music export block (9 config/library symbols plus `MU_PREFIX`, `MusicButtonIds`)
- `package.json` — four subpath exports (`./music/types`, `./music/config`, `./music/library`, `./music/constants`)
- `src/actions/cacheSync.ts` — the import and the `reloadMusic` branch
- `src/actions/persistence.ts` — `"reloadMusic"` from the action union
- `tests/helpers/factories.ts` — `createMusicSettings`, `CreateMusicSettingsInput`, and `reloadMusic` from the union
- `tests/integration/cache-sync.test.ts` — the music imports and the three music test cases

#### Dashboard

- `src/server/index.ts` — `registerMusicRoutes`
- `src/server/shared/openapi.ts` — the `Music` tag
- `src/server/shared/i18n.ts` — the `music` namespace
- `src/client/main.tsx` — the lazy `MusicPage` and its route registration
- `src/client/shared/components/Sidebar.tsx` — the nav entry
- `src/client/shared/components/Icon.tsx` — the `library_music` mapping
- `src/client/shared/lib/schemas.ts` — six `Music*` zod schemas and their inferred types
- `src/client/features/landing/FeaturesSection.tsx` — the music feature card
- `tests/server/openapi.test.ts` — the import, the registration, and `"Music"` in the expected tag list
- `tests/server/shared/permissions.test.ts` — see "Permission test rewrite" below

#### Types

- `packages/types/src/dashboard-permissions.ts` — the `music` module (4 permissions) and the `dj` preset

#### Config

- `packages/config/src/index.ts` — `lavalinkHost`, `lavalinkPort`, `lavalinkPassword`, and `LAVALINK_PASSWORD` from the required-env list
- `packages/config/tests/index.test.ts` — the `lavalink password` describe block
- `packages/config/tests/bot-sync-secret.test.ts` — the `LAVALINK_PASSWORD` stub
- `apps/bot/tests/config/config.test.ts` — three `LAVALINK_PASSWORD` stubs
- `turbo.json` — `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`
- `.env.example` — the Lavalink section and the `secrets/lavalink_password` references

### Edited — infrastructure

- `docker-compose.yml` — the `lavalink` and `preview-lavalink` services, and both `depends_on` entries
- `docker-compose.override.yml` — `LAVALINK_PASSWORD` / `LAVALINK_SERVER_PASSWORD` for bot, dashboard, and the lavalink service block
- `docker-compose.prod.yml` — the `lavalink` service, the `lavalink_password` secret definition, the `LAVALINK_*_FILE` env on bot and dashboard, and the `depends_on`
- `.github/workflows/security.yml` — the "Block re-introduction of default lavalink password" step

### Edited — i18n (192 locale files)

- `packages/i18n/src/client.ts` — `music` from the namespace list
- 48 × `common.json` — `nav.music`
- 48 × `permissions.json` — the `music` module label
- 48 × `landing.json` — the music feature card entry

`packages/i18n/dist/` is gitignored build output; deleting the source files is sufficient
for the commit, but a rebuild is required before the change is visible at runtime, because
the app serves `dist/locales`.

### Edited — living docs

`CLAUDE.md`, `docs/module-guide.md`, `docs/PROJECT_INDEX.md`, `design.md`,
`docs/features/dashboard-permissions.md`, `docs/features/suggestions.md`,
`docs/ui-ux-agent-prompt.md`.

### Deliberately untouched

- `packages/database/prisma/schema.prisma` — the three music models (D1)
- `packages/database/prisma/migrations/20260322000000_add_music_system/` (D1)
- `packages/systems/tests/helpers/db.ts` — the three music table names in the truncation
  list stay. The tables still exist, so truncating them remains valid; removing the lines
  would be churn with no benefit.
- Stale `music.*` grants on `DashboardRole` rows (D2)
- Historical point-in-time records: `docs/design-audit/**`, `claudedocs/**`,
  `docs/superpowers/plans/**`

## Permission test rewrite

`apps/dashboard/tests/server/shared/permissions.test.ts` uses `music.*` as its worked
example throughout — roughly 25 assertions covering exact matches, module wildcards,
`expandWildcard`, and `resolveEffectivePermissions`.

Most of these are **not** music tests; they are permission-matcher tests that happen to use
music as their fixture. Deleting them would silently reduce matcher coverage.

Approach: re-point them at a surviving module with the same shape. Use `moderation`, mapping
`music.settings.*` → `moderation.cases.*` and `music.library.*` → `moderation.warnings.*`.
Both target resources have genuine `view` and `manage` keys, so the substitution is
structurally identical.

One trap: do **not** substitute `moderation.settings.*`. Unlike the others it has only a
`manage` key and no `view`, so any test asserting on `moderation.settings.view` would be
asserting against a key that does not exist and would pass for the wrong reason. It remains
valid for the `*.settings.manage` segment-wildcard test, which is the only place it should
appear.

Expansion counts change and the assertions must follow: `music.*` expanded to 4 permissions,
`moderation.*` expands to 6.

Two tests are genuinely music-specific and are deleted outright: the `moduleKeys` assertion
containing `"music"`, and `"dj preset only has music permissions"`.

Note that `expandWildcard` and `resolveEffectivePermissions` read from the live catalog, so
these tests fail with empty results rather than a type error once the module is removed —
they must be rewritten, not merely allowed to pass.

## Verification

Because of D3, the gate runs at the branch tip.

```bash
pnpm typecheck && pnpm test && pnpm test:integration
docker compose config                       # and the override + prod files
pnpm build && pnpm deploy:commands          # count > 0, music absent
```

Additional manual checks:

1. **Boot with `LAVALINK_PASSWORD` entirely absent from the environment.** Both bot and
   dashboard must start. This is the highest-risk edit in the change, because the variable
   currently throws at module import time for both apps.
2. **`docker compose config` on all three compose files** — confirms no dangling
   `depends_on: lavalink` and no reference to a `lavalink_password` secret that no longer
   exists.
3. **`pnpm deploy:commands` logs a non-zero command count** and no music commands. A zero
   count means the D4 fix is wrong; ENOENT means it was not applied.
4. **Clear `apps/bot/dist/`** before building. The stale pre-refactor `dist/commands/` tree
   still contains a `music/` folder and is actively misleading when debugging deployment.

## Risks

| Risk | Severity | Handling |
| --- | --- | --- |
| Removing `LAVALINK_PASSWORD` breaks config import for both apps | High | Verify with a real boot — see below. Do **not** rely on `packages/config/tests/index.test.ts`: the package declares no `test` script and has no vitest config, so those tests never execute. Typecheck is the only static signal for surviving `config.lavalink*` readers. |
| Permission matcher coverage silently drops | Medium | Rewrite against `moderation` rather than delete — see above |
| Leftover `reloadMusic` rows in `ActionCacheInvalidation` | Low | With the branch removed they fall through to the generic `guildsToReload` path — a harmless action-rule reload, not a crash. Rows are purged after one hour. No migration needed. |
| Locale deletions appear not to work | Low | `dist/locales` is what is served and is gitignored; rebuild required |
| `library_music` icon removal breaks a call site | Low | Three call sites, all themselves being deleted. Grep to confirm no stragglers. |
| D4 fix changes deployed commands for other modules | Medium | Intended — it repairs deployment repo-wide. Expect the first successful run to register commands that were previously undeployable. Review the logged count before accepting. |

## Out of scope

- Dropping the music tables (explicitly rejected in D1)
- Cleaning `music.*` from stored role permissions (explicitly rejected in D2)
- Rewriting historical audit reports
- Any broader refactor of the command-loading system beyond making `deploy.ts` agree with
  `commandHandler.ts`
