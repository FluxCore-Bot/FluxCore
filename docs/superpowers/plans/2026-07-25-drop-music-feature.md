# Drop Music Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Music module (Lavalink playback, guild music settings, album/track library, dashboard music page) from FluxCore, keeping the three Prisma models so no guild data is destroyed.

**Architecture:** Pure removal, executed consumer-before-provider so each package stops importing music before the music code itself disappears. One branch, one PR; correctness is asserted at the branch tip because `packages/systems` and `packages/config` are consumed by both apps and cannot be split into independently-green PRs. One additive change rides along: `apps/bot/src/scripts/deploy.ts` is repaired so the deleted slash commands can actually be retired from Discord.

**Tech Stack:** pnpm monorepo, Turborepo, TypeScript (strict), Vitest, Fastify 5, React 19, Prisma 7, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-07-25-drop-music-feature-design.md` — read it before starting. Decisions D1–D4 are binding.

## Global Constraints

- **All `pnpm add/install` commands MUST run inside Docker.** Host `node_modules` are root-owned. A `PreToolUse` hook blocks host-side pnpm.
- **Never read or write `.env` files.** A hook blocks it. `.env.example` is the reference and is editable.
- **Do NOT touch `packages/database/prisma/schema.prisma`.** The three music models stay (D1). Do not generate a migration.
- **Do NOT modify `packages/systems/tests/helpers/db.ts`.** Its music table names stay valid because the tables still exist.
- **Strict TypeScript** — no `any`.
- Branch is `chore/drop-music-feature`, already created, spec already committed.
- Commit messages: `feat(module): …` / `fix(module): …` / `chore(module): …`, one logical change per commit.
- Intermediate tasks are **not** expected to typecheck cleanly. Only Task 11 asserts a green tree. Do not "fix" a dangling music import in a package whose removal task has not run yet.

---

### Task 1: Extract shared command discovery and repair `deploy.ts`

Repairs the broken deploy script (D4). Runs first because it is independent of music and is the only task with a genuine red-green test cycle.

`deploy.ts` resolves its command directory to `apps/bot/src/commands/`, which stopped existing when the bot moved to `src/features/<module>/commands/`. `readdir` throws `ENOENT` and the script exits 1, so no module's slash commands have been deployable since that refactor. Rather than duplicate the discovery loop, extract it so the loader and the deployer can never disagree again.

**Files:**

- Create: `apps/bot/src/shared/handlers/commandDiscovery.ts`
- Test: `apps/bot/tests/shared/commandDiscovery.test.ts`
- Modify: `apps/bot/src/shared/handlers/commandHandler.ts:10-25`
- Modify: `apps/bot/src/scripts/deploy.ts:9-23`

**Interfaces:**

- Consumes: `getFiles(dir: string): Promise<string[]>` from `@fluxcore/utils` — recursive, returns only `.ts`/`.js` files, throws if `dir` does not exist.
- Produces: `collectCommandFiles(featuresDir: string): Promise<string[]>` — absolute paths to every command file under `<featuresDir>/*/commands/`. Used by Task 11's verification.

- [ ] **Step 1: Write the failing test**

Create `apps/bot/tests/shared/commandDiscovery.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectCommandFiles } from "../../src/shared/handlers/commandDiscovery.js";

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "fluxcore-cmd-"));

  // A feature with a flat commands/ directory
  await mkdir(join(root, "moderation", "commands"), { recursive: true });
  await writeFile(join(root, "moderation", "commands", "ban.ts"), "export default {};");

  // A feature whose commands/ has a nested subdirectory
  await mkdir(join(root, "general", "commands", "nested"), { recursive: true });
  await writeFile(join(root, "general", "commands", "nested", "deep.ts"), "export default {};");

  // A feature with NO commands/ directory — must not throw
  await mkdir(join(root, "logging", "system"), { recursive: true });
  await writeFile(join(root, "logging", "system", "sender.ts"), "export default {};");

  // A stray file at the features root — must be ignored
  await writeFile(join(root, "README.md"), "not a feature");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("collectCommandFiles", () => {
  it("finds command files across every feature, including nested ones", async () => {
    const files = await collectCommandFiles(root);
    const relative = files.map((f) => f.slice(root.length));

    expect(relative).toHaveLength(2);
    expect(relative).toEqual(
      expect.arrayContaining([
        "/moderation/commands/ban.ts",
        "/general/commands/nested/deep.ts",
      ]),
    );
  });

  it("skips features that have no commands directory", async () => {
    const files = await collectCommandFiles(root);
    expect(files.some((f) => f.includes("logging"))).toBe(false);
  });

  it("ignores non-directory entries at the features root", async () => {
    const files = await collectCommandFiles(root);
    expect(files.some((f) => f.endsWith("README.md"))).toBe(false);
  });

  it("returns an empty array for a features directory with no features", async () => {
    const empty = await mkdtemp(join(tmpdir(), "fluxcore-empty-"));
    try {
      expect(await collectCommandFiles(empty)).toEqual([]);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

`pnpm test` runs `turbo run test` across the whole monorepo, so it cannot take a file filter — `pnpm test -- foo` would hand `foo` to turbo as a second task name. Filter at the package level instead:

```bash
docker compose --profile bot run --rm bot pnpm --filter @fluxcore/bot test -- commandDiscovery
```

Expected: FAIL — cannot resolve `../../src/shared/handlers/commandDiscovery.js`.

- [ ] **Step 3: Write the implementation**

Create `apps/bot/src/shared/handlers/commandDiscovery.ts`:

```typescript
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { getFiles } from "@fluxcore/utils";

/**
 * Collect every command file across `features/<feature>/commands/`.
 *
 * Shared by the runtime command loader and the slash-command deploy script so
 * the two can never disagree about which commands exist — they did for a while,
 * and it silently broke deployment for every module.
 */
export async function collectCommandFiles(featuresDir: string): Promise<string[]> {
  const featureEntries = await readdir(featuresDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of featureEntries) {
    if (!entry.isDirectory()) continue;
    try {
      files.push(...(await getFiles(join(featuresDir, entry.name, "commands"))));
    } catch {
      // Feature has no commands/ directory — skip
    }
  }

  return files;
}
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
docker compose --profile bot run --rm bot pnpm --filter @fluxcore/bot test -- commandDiscovery
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Point `commandHandler.ts` at the shared helper**

In `apps/bot/src/shared/handlers/commandHandler.ts`, replace the inline discovery loop. The imports become:

```typescript
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExtendedClient } from "../client/ExtendedClient.js";
import type { Command } from "@fluxcore/types";
import { logger } from "@fluxcore/utils";
import { collectCommandFiles } from "./commandDiscovery.js";
```

Note `readdir` and `getFiles` are no longer imported here. The top of `loadCommands` becomes:

```typescript
export async function loadCommands(client: ExtendedClient): Promise<void> {
  const dirname = fileURLToPath(new URL(".", import.meta.url));
  const featuresDir = join(dirname, "..", "..", "features");

  const allFiles = await collectCommandFiles(featuresDir);
```

Everything from `const modules = await Promise.all(` onward is unchanged.

- [ ] **Step 6: Repair `deploy.ts`**

In `apps/bot/src/scripts/deploy.ts`, replace the `getFiles` import with the shared helper and point it at `features`. The head of `deploy()` becomes:

```typescript
import { REST, Routes } from "discord.js";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { config } from "@fluxcore/config";
import type { Command } from "@fluxcore/types";
import { logger } from "@fluxcore/utils";
import { collectCommandFiles } from "../shared/handlers/commandDiscovery.js";

async function deploy(): Promise<void> {
  const dirname = fileURLToPath(new URL(".", import.meta.url));
  const featuresDir = join(dirname, "..", "features");

  const files = await collectCommandFiles(featuresDir);
  const commands: ReturnType<Command["data"]["toJSON"]>[] = [];
```

The `for (const file of files)` loop and everything after it is unchanged, **except** insert this guard immediately after the loop and before `const rest = new REST()`:

```typescript
  // rest.put is a full replace — deploying an empty array would silently
  // deregister every command. Fail loudly instead.
  if (commands.length === 0) {
    throw new Error(
      `No commands discovered under ${featuresDir} — refusing to deploy an empty command set.`,
    );
  }
```

- [ ] **Step 7: Verify the bot package still typechecks and tests pass**

```bash
docker compose --profile bot run --rm --no-deps bot pnpm turbo run typecheck --filter=@fluxcore/bot
docker compose --profile bot run --rm bot pnpm --filter @fluxcore/bot test -- commandDiscovery
```

Expected: both clean. `loadCommands` behaviour is unchanged; only its source of file paths moved.

- [ ] **Step 8: Commit**

```bash
git add apps/bot/src/shared/handlers/commandDiscovery.ts \
        apps/bot/tests/shared/commandDiscovery.test.ts \
        apps/bot/src/shared/handlers/commandHandler.ts \
        apps/bot/src/scripts/deploy.ts
git commit -m "fix(bot): repair slash-command deployment after features refactor

deploy.ts still resolved commands from src/commands/, which stopped existing
when the bot moved to src/features/<module>/commands/. It threw ENOENT and
exited 1, so no module's commands have been deployable since.

Extract the discovery loop into commandDiscovery.ts so the runtime loader and
the deploy script share one implementation, and refuse to PUT an empty command
set — rest.put is a full replace and would deregister everything."
```

---

### Task 2: Remove music from the bot

Removes the bot-side music feature and the `shoukaku` dependency. The lockfile is regenerated here because `docker-compose.yml`'s dashboard service runs `pnpm install --frozen-lockfile` and would fail against a stale lockfile from this point onward.

**Files:**

- Delete: `apps/bot/src/features/music/` (all 10 files)
- Modify: `apps/bot/src/index.ts`
- Modify: `apps/bot/src/events/ready.ts`
- Modify: `apps/bot/src/events/interactionCreate.ts`
- Modify: `apps/bot/src/features/automation/system/syncServer.ts:7,57-58`
- Modify: `apps/bot/package.json:25`
- Modify: `pnpm-lock.yaml` (regenerated, not hand-edited)

**Interfaces:**

- Consumes: `collectCommandFiles` from Task 1 — deleting `features/music/commands/` is sufficient to deregister `/play` and `/queue`; no registry edit is needed.
- Produces: nothing. After this task the bot no longer imports from `@fluxcore/systems/music/*`, which is what unblocks Task 5.

- [ ] **Step 1: Delete the music feature directory**

```bash
git rm -r apps/bot/src/features/music
```

- [ ] **Step 2: Strip music from `apps/bot/src/index.ts`**

Delete these three imports (lines 8-10):

```typescript
import { initShoukaku, getShoukaku } from "./features/music/system/shoukaku.js";
import { getAllQueues } from "./features/music/system/queue.js";
import { stopAllProgressRefresh } from "./features/music/system/panel.js";
```

Delete the init call and its comment (lines 21-22):

```typescript
  // Init Shoukaku before login so the connector can listen for the ready event
  initShoukaku(client);
```

Delete the cleanup block from `shutdown` (lines 41-52), so `shutdown` reads:

```typescript
  const shutdown = async () => {
    logger.info("Shutting down...");
    stopReminderPolling();
    stopCacheSyncPolling();
    stopSyncServer();

    client.destroy();
    await disconnectDatabase();
    process.exit(0);
  };
```

`shutdown` no longer awaits anything, but leave it `async` — it is passed to `void shutdown()` handlers and the signature is irrelevant to callers.

- [ ] **Step 3: Strip music from `apps/bot/src/events/ready.ts`**

Delete these five imports (lines 16, 18-21):

```typescript
import { loadMusicSettings, get247Guilds } from "@fluxcore/systems/music/config";
import { createQueue } from "../features/music/system/queue.js";
import { setupPlayerEvents } from "../features/music/system/events.js";
import { registerMusicSettingsReactor } from "../features/music/system/settingsReactor.js";
import { waitForNode } from "../features/music/system/shoukaku.js";
```

Keep the `cleanOldLogEntries` import on line 17 — it sits in the middle of that run and is unrelated.

Delete the entire `// Music system initialization` block, lines 63-103 inclusive — from the comment down to and including the closing brace of its `catch`. `startReminderPolling(client);` on line 61 is followed directly by the `// Logging system` comment.

- [ ] **Step 4: Strip music from `apps/bot/src/events/interactionCreate.ts`**

Delete these three imports (lines 11, 13, 15):

```typescript
import { handleMusicButton } from "../features/music/system/interactions.js";
import { handlePlayAutocomplete } from "../features/music/commands/play.js";
import { MU_PREFIX } from "@fluxcore/systems/music/constants";
```

In the autocomplete branch, delete the `play` case so it reads:

```typescript
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === "actions") {
        await handleActionsAutocomplete(interaction);
      } else if (interaction.commandName === "rolepanel") {
        await handleRolePanelAutocomplete(interaction);
      }
      return;
    }
```

In the button branch, collapse the music/tempvoice if-else (lines 57-61) to the tempvoice call alone:

```typescript
      await handleTempVoiceButton(interaction);
      return;
```

- [ ] **Step 5: Strip music from `syncServer.ts`**

In `apps/bot/src/features/automation/system/syncServer.ts`, delete the import on line 7:

```typescript
import { loadMusicSettingsForGuild } from "@fluxcore/systems/music/config";
```

Delete the `reloadMusic` branch (lines 57-58):

```typescript
        } else if (action === "reloadMusic") {
          await loadMusicSettingsForGuild(guildId);
```

Read the surrounding if-chain before editing and make sure the remaining branches still form a valid chain — do not leave a dangling `else if` or an orphaned `else`.

- [ ] **Step 6: Remove the `shoukaku` dependency**

In `apps/bot/package.json`, delete the `"shoukaku": "^4.3.0"` entry from `dependencies` (line 25). Remember to fix the trailing comma on the preceding line if `shoukaku` was last.

- [ ] **Step 7: Regenerate the lockfile inside Docker**

The `bot` compose service does not mount the root `pnpm-lock.yaml` or `package.json`, so a naive `docker compose run bot pnpm install` writes to the image's baked-in copy and leaves the host file untouched. Seed them via temp paths and stream the result back out:

```bash
PGADMIN_PASSWORD=ci-dummy docker compose --profile bot run --rm --no-deps -T \
  -v "$(pwd)/pnpm-lock.yaml:/tmp/lock:ro" \
  -v "$(pwd)/package.json:/tmp/pkg:ro" \
  -v "$(pwd)/apps/bot/package.json:/tmp/botpkg:ro" \
  bot sh -c "cp /tmp/lock pnpm-lock.yaml && cp /tmp/pkg package.json && \
             cp /tmp/botpkg apps/bot/package.json && \
             pnpm install --lockfile-only >/dev/null 2>&1 && cat pnpm-lock.yaml" \
  > /tmp/newlock.yaml
```

`PGADMIN_PASSWORD` is required because Compose interpolates every service at parse time even under `--profile bot`. A single-file bind mount of `pnpm-lock.yaml` directly triggers `EBUSY` on pnpm's atomic rename, which is why this copies through `/tmp`.

- [ ] **Step 8: Validate and install the new lockfile**

```bash
head -1 /tmp/newlock.yaml            # must read: lockfileVersion: '9.0'
grep -c shoukaku /tmp/newlock.yaml   # must print 0
```

Only if both hold:

```bash
cp /tmp/newlock.yaml pnpm-lock.yaml
```

If `head -1` shows anything else the container failed and streamed an error into the file — do not copy it.

- [ ] **Step 9: Verify the lockfile is honoured**

```bash
PGADMIN_PASSWORD=ci-dummy docker compose --profile bot run --rm --no-deps -T \
  -v "$(pwd)/pnpm-lock.yaml:/tmp/lock:ro" \
  -v "$(pwd)/package.json:/tmp/pkg:ro" \
  -v "$(pwd)/apps/bot/package.json:/tmp/botpkg:ro" \
  bot sh -c "cp /tmp/lock pnpm-lock.yaml && cp /tmp/pkg package.json && \
             cp /tmp/botpkg apps/bot/package.json && \
             pnpm install --frozen-lockfile >/dev/null 2>&1 && echo LOCKFILE_OK"
```

Expected: `LOCKFILE_OK`.

- [ ] **Step 10: Confirm no bot-side music references survive**

```bash
grep -rniE "music|shoukaku|lavalink" apps/bot/src apps/bot/package.json
```

Expected: no output. Any hit is a missed edit.

- [ ] **Step 11: Commit**

```bash
git add apps/bot pnpm-lock.yaml
git commit -m "chore(music): remove music from the bot

Deletes features/music (2 commands, 8 system modules), the Shoukaku init and
shutdown drain in index.ts, the ready.ts music bootstrap including 24/7 rejoin,
the interactionCreate button/autocomplete hooks, and the reloadMusic sync
branch. Drops the shoukaku dependency and regenerates the lockfile."
```

---

### Task 3: Remove music from the dashboard server

**Files:**

- Delete: `apps/dashboard/src/server/features/music/routes.ts` (and the now-empty directory)
- Delete: `apps/dashboard/tests/server/features/music/musicRateLimit.test.ts` (and its directory)
- Modify: `apps/dashboard/src/server/index.ts:21,148`
- Modify: `apps/dashboard/src/server/shared/openapi.ts:12`
- Modify: `apps/dashboard/src/server/shared/i18n.ts:72`
- Modify: `apps/dashboard/tests/server/openapi.test.ts:26,44,60`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: nothing. Removes the dashboard server's imports of `@fluxcore/systems/music/*`, which Task 5 depends on.

- [ ] **Step 1: Delete the route module and its test**

```bash
git rm -r apps/dashboard/src/server/features/music
git rm -r apps/dashboard/tests/server/features/music
```

- [ ] **Step 2: Unregister the routes**

In `apps/dashboard/src/server/index.ts`, delete the import on line 21:

```typescript
import { registerMusicRoutes } from "./features/music/routes.js";
```

and the registration on line 148:

```typescript
  registerMusicRoutes(app);
```

- [ ] **Step 3: Remove the OpenAPI tag**

In `apps/dashboard/src/server/shared/openapi.ts`, delete line 12:

```typescript
  { name: "Music", description: "Music player settings and queue management." },
```

- [ ] **Step 4: Remove the server-side i18n namespace**

In `apps/dashboard/src/server/shared/i18n.ts` line 72, remove `"music"` from the namespace array, leaving the surrounding entries and comma placement valid.

- [ ] **Step 5: Update the OpenAPI test**

In `apps/dashboard/tests/server/openapi.test.ts`, delete the import on line 26 and the `registerMusicRoutes(app);` call on line 60, then remove `"Music"` from the expected tag list on line 44 so it reads:

```typescript
  "Meta", "Auth", "Guilds", "TempVoice", "Actions", "Discord",
```

- [ ] **Step 6: Confirm no server-side music references survive**

```bash
grep -rniE "music|lavalink" apps/dashboard/src/server apps/dashboard/tests/server
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/server apps/dashboard/tests/server
git commit -m "chore(music): remove music from the dashboard server

Deletes the music route module and its rate-limit test, unregisters it from the
Fastify app, and drops the Music OpenAPI tag and i18n namespace."
```

---

### Task 4: Remove music from the dashboard client

**Files:**

- Delete: `apps/dashboard/src/client/features/music/` (3 files)
- Delete: `apps/dashboard/src/client/routes/guild/$guildId/music.tsx`
- Modify: `apps/dashboard/src/client/main.tsx:54-55,158-161,249`
- Modify: `apps/dashboard/src/client/shared/components/Sidebar.tsx:21`
- Modify: `apps/dashboard/src/client/shared/components/Icon.tsx:49,141`
- Modify: `apps/dashboard/src/client/shared/lib/schemas.ts:303-347`
- Modify: `apps/dashboard/src/client/features/landing/FeaturesSection.tsx:6`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: nothing.

- [ ] **Step 1: Delete the client feature and its route**

```bash
git rm -r apps/dashboard/src/client/features/music
git rm "apps/dashboard/src/client/routes/guild/\$guildId/music.tsx"
```

The `$guildId` path segment is literal — quote it so the shell does not expand it as a variable.

- [ ] **Step 2: Remove the lazy page and its route from `main.tsx`**

Delete the lazy import (lines 54-56):

```typescript
const MusicPage = lazyPage(() =>
  import("./routes/guild/$guildId/music").then((m) => ({ default: m.MusicPage })),
);
```

Delete the route definition beginning at line 158:

```typescript
const musicRoute = createRoute({
  ...
  path: "/music",
  component: MusicPage,
});
```

Read the full `createRoute` call before deleting so the closing `});` goes with it. Then remove `musicRoute,` from the route tree array at line 249.

- [ ] **Step 3: Remove the sidebar entry**

In `apps/dashboard/src/client/shared/components/Sidebar.tsx`, delete line 21:

```typescript
  { path: "/guild/$guildId/music", i18nKey: "nav.music", icon: "library_music", permission: "music.settings.view" },
```

- [ ] **Step 4: Remove the icon mapping**

In `apps/dashboard/src/client/shared/components/Icon.tsx`, delete the `library_music: Music,` entry on line 141 and remove `Music,` from the `lucide-react` import block on line 49. Verify `Music` is not used by any other mapping in the same file before removing the import.

- [ ] **Step 5: Remove the zod schemas**

In `apps/dashboard/src/client/shared/lib/schemas.ts`, delete the whole `// --- Music ---` section, lines 303-347 inclusive. That covers `MusicSettingsSchema`, `MusicSettings`, `MusicSettingsFormSchema`, `MusicSettingsFormData`, `MusicAlbumSchema`, `MusicAlbum`, `MusicAlbumListSchema`, `MusicTrackSchema`, `MusicTrack`, and `MusicTrackListSchema`.

- [ ] **Step 6: Remove the landing page feature card**

In `apps/dashboard/src/client/features/landing/FeaturesSection.tsx`, delete line 6:

```typescript
  { icon: "library_music", key: "music" },
```

- [ ] **Step 7: Confirm no client-side music references survive**

```bash
grep -rniE "music|lavalink" apps/dashboard/src/client
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/client
git commit -m "chore(music): remove music from the dashboard client

Deletes the music page, its components and hook, the lazy route registration,
the sidebar entry, the library_music icon mapping, the six Music zod schemas,
and the landing page feature card."
```

---

### Task 5: Remove music from `packages/systems`

Runs after Tasks 2-4 because it deletes the modules those tasks were importing.

**Files:**

- Delete: `packages/systems/src/music/` (4 files)
- Delete: `packages/systems/tests/integration/music-sync.test.ts`
- Modify: `packages/systems/src/index.ts`
- Modify: `packages/systems/package.json:61-76`
- Modify: `packages/systems/src/actions/cacheSync.ts:6,25,33-34,48`
- Modify: `packages/systems/src/actions/persistence.ts:247`
- Modify: `packages/systems/tests/helpers/factories.ts:74,82-101`
- Modify: `packages/systems/tests/integration/cache-sync.test.ts`

**Interfaces:**

- Consumes: the absence of music imports in the bot and dashboard, established by Tasks 2-4.
- Produces: `notifyCacheInvalidation(guildId: string, action?: "reload" | "reloadSettings" | "reloadTempVoice")` — the `reloadMusic` member is gone from the union.

- [ ] **Step 1: Delete the music system and its integration test**

```bash
git rm -r packages/systems/src/music
git rm packages/systems/tests/integration/music-sync.test.ts
```

- [ ] **Step 2: Remove the barrel exports**

In `packages/systems/src/index.ts`, delete all three music export blocks — the `loadMusicSettings … get247Guilds` block, the `getAlbums … findTrackByUrl` block, and the `MU_PREFIX, MusicButtonIds` block. They are contiguous near the top of the file, between the `reminders.js` export and the `// Logging` comment.

- [ ] **Step 3: Remove the subpath exports**

In `packages/systems/package.json`, delete the four `"./music/…"` entries from the `exports` map (lines 61-76): `./music/types`, `./music/config`, `./music/library`, `./music/constants`. Fix comma placement so the JSON stays valid.

- [ ] **Step 4: Remove the cache-sync branch**

In `packages/systems/src/actions/cacheSync.ts`, delete the import on line 6, the `guildsToReloadMusic` declaration on line 25, the `else if (record.action === "reloadMusic")` branch on lines 33-34, and the `loadMusicSettingsForGuild` spread on line 48.

The remaining branch chain must stay valid. After the edit it reads:

```typescript
    for (const record of records) {
      if (record.action === "reloadSettings") {
        needSettingsReload = true;
      }
      if (record.action === "reloadTempVoice") {
        guildsToReloadTempVoice.add(record.guildId);
      } else {
        guildsToReload.add(record.guildId);
      }
      lastCheckedId = record.id;
    }
```

This is intentional, and it is why no data migration is needed: any `reloadMusic` row still sitting in `ActionCacheInvalidation` now falls into the generic `guildsToReload` branch, which performs a harmless action-rule reload rather than crashing. Those rows are deleted by the existing one-hour cleanup at the bottom of the same function.

Do **not** "fix" the pre-existing quirk that `reloadSettings` uses a standalone `if` and therefore also falls through to the `else`. It is out of scope.

- [ ] **Step 5: Narrow the invalidation action union**

In `packages/systems/src/actions/persistence.ts` line 247, change:

```typescript
  action: "reload" | "reloadSettings" | "reloadTempVoice" | "reloadMusic" = "reload",
```

to:

```typescript
  action: "reload" | "reloadSettings" | "reloadTempVoice" = "reload",
```

- [ ] **Step 6: Update the test factories**

In `packages/systems/tests/helpers/factories.ts`, apply the same union narrowing on line 74, then delete the entire music section — the `// ─── Music Guild Settings ───` banner, `CreateMusicSettingsInput`, and `createMusicSettings` (lines 82-101 and the remainder of that function).

- [ ] **Step 7: Update the cache-sync integration test**

In `packages/systems/tests/integration/cache-sync.test.ts`:

- Remove `createMusicSettings` from the factory import on line 15.
- Delete the `getMusicSettings, loadMusicSettingsForGuild` import on line 19.
- Delete the test `"writes correct action type for music reload"` (lines 53-62).
- Delete the test `"music settings: dashboard write → invalidation record → bot reload"` (lines 128-145).
- At line 88 a `notifyCacheInvalidation(GUILD_ID, "reloadMusic")` call sits inside a test that is otherwise not about music. Read that test, and change the argument to `"reloadTempVoice"` — it is exercising the polling loop, not music specifically. If the surrounding assertions depend on the music reload actually happening, delete that test too rather than leaving a false pass.

- [ ] **Step 8: Confirm no systems-side music references survive**

```bash
grep -rniE "music|lavalink" packages/systems/src packages/systems/package.json
grep -rniE "music" packages/systems/tests --include="*.ts" | grep -v helpers/db.ts
```

Expected: no output from either. `helpers/db.ts` is excluded because its three music table names stay (D1) — the tables still exist.

- [ ] **Step 9: Commit**

```bash
git add packages/systems
git commit -m "chore(music): remove music from packages/systems

Deletes src/music, its four subpath exports and barrel re-exports, the
music-sync integration test, and the createMusicSettings factory. Narrows the
cache-invalidation action union to drop reloadMusic; stale rows now fall through
to the generic reload branch and are purged by the existing one-hour cleanup."
```

---

### Task 6: Remove music from the permission catalog and rewrite the matcher tests

The matcher tests use `music.*` as their worked example throughout. Most are not music tests — they are permission-matcher tests that happen to use music as a fixture. Deleting them would silently cut matcher coverage, so they are re-pointed at `moderation` instead.

**Files:**

- Modify: `packages/types/src/dashboard-permissions.ts:55-64,226-230`
- Modify: `apps/dashboard/tests/server/shared/permissions.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `PERMISSION_REGISTRY` with 48 keys across its remaining modules (was 52), and `ROLE_PRESETS` without `dj`.

**Substitution rules.** `music.settings.*` → `moderation.cases.*`, `music.library.*` → `moderation.warnings.*`. Both target resources have real `view` and `manage` keys, so the shape is identical. **Do not substitute `moderation.settings.*`** — unlike the others it has only `manage` and no `view`, so a test asserting on `moderation.settings.view` would be asserting against a key that does not exist and would pass for the wrong reason. It stays valid only in the `*.settings.manage` cross-module test, where `actions.settings.manage` is the natural second module.

- [ ] **Step 1: Remove the module and preset from the registry**

In `packages/types/src/dashboard-permissions.ts`, delete the whole `music` module object (the `{ key: "music", label: "Music", icon: "Music", permissions: [...] }` block, lines 55-64) and the `dj` preset (lines 226-230):

```typescript
  dj: {
    name: "DJ",
    color: "#ac8aff",
    permissions: ["music.*"],
  },
```

Leave the explanatory comments at lines 257, 280 and 293 that use `"music.*"` as an illustrative example in prose — or reword them to `"moderation.*"`. Either is fine; they are comments, not code.

- [ ] **Step 2: Run the permission tests and watch them fail**

```bash
docker compose --profile bot run --rm bot pnpm --filter @fluxcore/dashboard test -- permissions
```

Expected: FAIL. Note that `expandWildcard("music.*")` and `resolveEffectivePermissions(["music.*"])` now return **empty arrays** rather than raising a type error — these fail on assertions, which is exactly why they must be rewritten rather than left to "pass".

- [ ] **Step 3: Rewrite the matcher tests**

In `apps/dashboard/tests/server/shared/permissions.test.ts`, apply these edits.

Line 14 — inside "grants access for full wildcard":

```typescript
    expect(matchPermission(new Set(["*"]), "moderation.settings.manage")).toBe(true);
```

Lines 17-23 — exact match and denial:

```typescript
  it("grants access for exact match", () => {
    expect(matchPermission(new Set(["moderation.cases.view"]), "moderation.cases.view")).toBe(true);
  });

  it("denies access when permission not granted", () => {
    expect(matchPermission(new Set(["moderation.cases.view"]), "moderation.cases.manage")).toBe(false);
  });
```

Lines 29-35 — module-level wildcard:

```typescript
  it("grants access for module-level wildcard (moderation.*)", () => {
    const granted = new Set(["moderation.*"]);
    expect(matchPermission(granted, "moderation.cases.view")).toBe(true);
    expect(matchPermission(granted, "moderation.cases.manage")).toBe(true);
    expect(matchPermission(granted, "moderation.warnings.view")).toBe(true);
    expect(matchPermission(granted, "actions.rules.view")).toBe(false);
  });
```

Lines 44-50 — cross-module wildcard:

```typescript
  it("handles cross-module wildcard (*.settings.manage)", () => {
    const granted = new Set(["*.settings.manage"]);
    expect(matchPermission(granted, "moderation.settings.manage")).toBe(true);
    expect(matchPermission(granted, "actions.settings.manage")).toBe(true);
    expect(matchPermission(granted, "moderation.cases.view")).toBe(false);
    expect(matchPermission(granted, "moderation.warnings.manage")).toBe(false);
  });
```

Lines 52-57 — `*.*.view`:

```typescript
  it("handles *.*.view wildcard", () => {
    const granted = new Set(["*.*.view"]);
    expect(matchPermission(granted, "moderation.cases.view")).toBe(true);
    expect(matchPermission(granted, "actions.rules.view")).toBe(true);
    expect(matchPermission(granted, "moderation.cases.manage")).toBe(false);
  });
```

Lines 59-64 — multiple grants:

```typescript
  it("handles multiple granted permissions", () => {
    const granted = new Set(["moderation.*", "actions.rules.view"]);
    expect(matchPermission(granted, "moderation.cases.manage")).toBe(true);
    expect(matchPermission(granted, "actions.rules.view")).toBe(true);
    expect(matchPermission(granted, "actions.rules.manage")).toBe(false);
  });
```

Lines 66-69 — partial match:

```typescript
  it("does not partially match non-wildcard keys", () => {
    const granted = new Set(["moderation.cases"]);
    expect(matchPermission(granted, "moderation.cases.view")).toBe(false);
  });
```

Lines 79-86 — `expandWildcard`:

```typescript
  it("expands module.* to all permissions in that module", () => {
    const expanded = expandWildcard("moderation.*");
    expect(expanded).toContain("moderation.cases.view");
    expect(expanded).toContain("moderation.cases.manage");
    expect(expanded).toContain("moderation.warnings.view");
    expect(expanded).toContain("moderation.warnings.manage");
    expect(expanded).not.toContain("actions.rules.view");
  });
```

Lines 96-101 — `resolveEffectivePermissions`:

```typescript
  it("resolves wildcard to concrete keys", () => {
    const effective = resolveEffectivePermissions(["moderation.*"]);
    expect(effective).toContain("moderation.cases.view");
    expect(effective).toContain("moderation.warnings.manage");
    expect(effective).not.toContain("actions.rules.view");
  });
```

Lines 108-113 — merging grants:

```typescript
  it("merges multiple grants", () => {
    const effective = resolveEffectivePermissions(["moderation.*", "actions.rules.view"]);
    expect(effective).toContain("moderation.cases.view");
    expect(effective).toContain("actions.rules.view");
    expect(effective).not.toContain("actions.rules.manage");
  });
```

Line 125 — delete this single assertion from "has all expected modules":

```typescript
    expect(moduleKeys).toContain("music");
```

Lines 144-148 — drop `"dj"` from the preset list:

```typescript
  it("has expected presets", () => {
    expect(Object.keys(ROLE_PRESETS)).toEqual(
      expect.arrayContaining(["moderator", "content-manager", "full-admin", "viewer"]),
    );
  });
```

Lines 155-158 — delete the whole `"dj preset only has music permissions"` test.

Leave line 76 (`expect(expanded.length).toBeGreaterThan(40)`) alone: the registry drops from 52 keys to 48, so the assertion still holds.

- [ ] **Step 4: Run the permission tests and verify they pass**

```bash
docker compose --profile bot run --rm bot pnpm --filter @fluxcore/dashboard test -- permissions
```

Expected: PASS. If "all preset permissions are valid" fails, a preset still references a key that no longer expands — recheck Step 1.

- [ ] **Step 5: Confirm no music permission references survive**

```bash
grep -rn "music" packages/types/src apps/dashboard/tests/server/shared/permissions.test.ts
```

Expected: no output, unless you chose to keep illustrative `music.*` wording in the matcher comments.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/dashboard-permissions.ts \
        apps/dashboard/tests/server/shared/permissions.test.ts
git commit -m "chore(music): drop the music permission module and DJ preset

Removes the four music.* permissions and the DJ preset, which was entirely
music.*. Re-points the permission matcher tests at moderation rather than
deleting them — they exercise the matcher, not music, and expandWildcard now
returns empty for music.* rather than erroring.

Stale music.* grants on existing DashboardRole rows are left in place: they
match nothing and self-clean on next save."
```

---

### Task 7: Remove the Lavalink config and env plumbing

The highest-risk task. `LAVALINK_PASSWORD` currently throws at module import time in `@fluxcore/config`, which **both** the bot and the dashboard import — neither boots without it today.

**Files:**

- Modify: `packages/config/src/index.ts:24-26,37,136-141,156-158`
- Modify: `packages/config/tests/index.test.ts:94-113`
- Modify: `packages/config/tests/bot-sync-secret.test.ts:8`
- Modify: `apps/bot/tests/config/config.test.ts:13,44,54`
- Modify: `turbo.json:7-9`
- Modify: `.env.example`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: the `Config` interface without `lavalinkHost`, `lavalinkPort`, `lavalinkPassword`.

- [ ] **Step 1: Remove the config fields**

In `packages/config/src/index.ts`:

Delete lines 24-26 from the `Config` interface:

```typescript
  lavalinkHost: string;
  lavalinkPort: number;
  lavalinkPassword: string;
```

Delete `"LAVALINK_PASSWORD",` from the `resolveSecretFiles([...])` array on line 37.

Delete the resolution block and its throw, lines 136-141:

```typescript
  const lavalinkHost = process.env.LAVALINK_HOST || "lavalink";
  const lavalinkPort = Number(process.env.LAVALINK_PORT) || 2333;
  const lavalinkPassword = process.env.LAVALINK_PASSWORD;
  if (!lavalinkPassword) {
    throw new Error("Missing required environment variable: LAVALINK_PASSWORD");
  }
```

Delete the three matching properties from the returned object, lines 156-158, so it ends:

```typescript
    botSyncPort,
    botSyncSecret,
    botSyncUrl,
  };
```

- [ ] **Step 2: Delete the lavalink config tests**

In `packages/config/tests/index.test.ts`, delete the entire `describe("lavalink password", …)` block, lines 94-113 inclusive.

**Be aware these tests never actually run.** `packages/config` has no `test` script, no `vitest.config.ts`, and no vitest devDependency, so `turbo run test` skips the package entirely — its two test files are dead code. Delete the lavalink block anyway (leaving a test that asserts a removed throw is misleading either way), but do not expect a red-to-green signal from it, and do not expand this task into wiring up a test runner for the package. That is a separate follow-up, noted at the end of this plan.

- [ ] **Step 3: Remove the env stubs from the remaining tests**

In `packages/config/tests/bot-sync-secret.test.ts`, delete line 8:

```typescript
    process.env.LAVALINK_PASSWORD = "z";
```

In `apps/bot/tests/config/config.test.ts`, delete all three occurrences (lines 13, 44, 54):

```typescript
    vi.stubEnv("LAVALINK_PASSWORD", "test-lavalink-pw");
```

These stubs exist only to satisfy the throw being removed. Leaving them would not fail, but they would be misleading — remove them.

- [ ] **Step 4: Remove the turbo env declarations**

In `turbo.json`, delete `"LAVALINK_HOST"`, `"LAVALINK_PORT"` and `"LAVALINK_PASSWORD"` from the **`globalPassThroughEnv`** array (lines 7-9), fixing comma placement. Note the key is `globalPassThroughEnv`, not `globalEnv` — this repo has no `globalEnv`. The array should end at `"LOG_LEVEL"`.

- [ ] **Step 5: Update `.env.example`**

Delete the entire `# === Lavalink (Music System) ===` section (the comment banner through `LAVALINK_PASSWORD=`, lines 52-61) and the two Docker-secrets references to `secrets/lavalink_password` and `LAVALINK_PASSWORD_FILE` further down (around lines 86 and 96).

This is `.env.example`, not `.env` — editing it is allowed and expected. Do not touch any real `.env` file.

- [ ] **Step 6: Verify the package typechecks and nothing still reads the fields**

Because `packages/config` has no test runner, typecheck is the real signal here — it is what catches any surviving `config.lavalinkPassword` reader.

```bash
docker compose --profile bot run --rm --no-deps bot pnpm turbo run typecheck --filter=@fluxcore/config
grep -rniE "lavalink" packages/config apps/bot/tests turbo.json .env.example
```

Expected: typecheck clean, grep silent.

- [ ] **Step 7: Prove both apps boot without the variable**

```bash
env -u LAVALINK_PASSWORD -u LAVALINK_HOST -u LAVALINK_PORT \
  node -e "import('@fluxcore/config').then(m => console.log('CONFIG_OK', !('lavalinkPassword' in m.config)))"
```

Expected: `CONFIG_OK true`. If this throws `Missing required environment variable: LAVALINK_PASSWORD`, Step 1 was incomplete. If the module cannot be resolved from the repo root, run it from `packages/config` or defer this check to Task 11's full boot test — but do not skip it silently.

- [ ] **Step 8: Commit**

```bash
git add packages/config turbo.json .env.example apps/bot/tests/config/config.test.ts
git commit -m "chore(music): remove Lavalink config and env plumbing

Drops lavalinkHost/lavalinkPort/lavalinkPassword from Config and the
LAVALINK_PASSWORD required-env throw, which blocked startup for both the bot
and the dashboard even though only the bot used Lavalink. Removes the matching
turbo globalPassThroughEnv entries, .env.example section, and test stubs."
```

---

### Task 8: Remove the Lavalink infrastructure

**Files:**

- Delete: `lavalink/application.yml` (and the directory)
- Modify: `docker-compose.yml:13-17,25-42,84-88,119-135`
- Modify: `docker-compose.override.yml`
- Modify: `docker-compose.prod.yml:11,14-15,23,28,41-54,80,91,210-211`
- Modify: `.github/workflows/security.yml:96`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: nothing.

- [ ] **Step 1: Delete the Lavalink config directory**

```bash
git rm -r lavalink
```

- [ ] **Step 2: Strip Lavalink from `docker-compose.yml`**

Delete the whole `lavalink:` service (lines 25-42) and the whole `preview-lavalink:` service (lines 119-135).

Then remove the two `depends_on` entries that reference them. In `bot` (lines 16-17):

```yaml
      lavalink:
        condition: service_healthy
```

leaving:

```yaml
    depends_on:
      postgres:
        condition: service_healthy
```

And the same shape for `preview-bot` (lines 87-88), which references `preview-lavalink`.

- [ ] **Step 3: Strip Lavalink from `docker-compose.override.yml`**

Delete the `LAVALINK_PASSWORD` and `LAVALINK_SERVER_PASSWORD` environment entries from both the `bot` and `dashboard` services, and delete the entire `lavalink:` service block. Also delete the explanatory header comment about `LAVALINK_PASSWORD` vs `LAVALINK_SERVER_PASSWORD` (numbered item 2 near the top) — it documents a distinction that no longer exists.

If removing those entries leaves a service with an empty `environment:` key, remove the key too; if it leaves the service with no keys at all, remove the service block.

- [ ] **Step 4: Strip Lavalink from `docker-compose.prod.yml`**

Delete, in this file:

- `LAVALINK_PASSWORD_FILE: /run/secrets/lavalink_password` from both the bot (line 11) and dashboard (line 80) services
- `LAVALINK_HOST` and `LAVALINK_PORT` (lines 14-15)
- `- lavalink_password` from both services' `secrets:` lists (lines 23 and 91)
- the `depends_on` entry for `lavalink` (line 28)
- the entire `lavalink:` service (lines 41-54)
- the `lavalink_password:` secret definition at the bottom (lines 210-211)

- [ ] **Step 5: Remove the security CI check**

In `.github/workflows/security.yml`, delete the whole `- name: Block re-introduction of default lavalink password` step (starting line 96) including its `run:` body. Read the surrounding steps first so YAML indentation stays valid.

- [ ] **Step 6: Validate every compose file parses**

```bash
PGADMIN_PASSWORD=ci-dummy docker compose config >/dev/null && echo BASE_OK
PGADMIN_PASSWORD=ci-dummy docker compose -f docker-compose.prod.yml config >/dev/null && echo PROD_OK
```

Expected: `BASE_OK` and `PROD_OK`. The base invocation picks up `docker-compose.override.yml` automatically. A failure naming an undefined secret or an unknown service means a dangling reference was missed.

- [ ] **Step 7: Confirm no infrastructure references survive**

```bash
grep -rniE "lavalink" docker-compose*.yml .github/workflows/ Dockerfile* 2>/dev/null
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add -A lavalink docker-compose.yml docker-compose.override.yml \
           docker-compose.prod.yml .github/workflows/security.yml
git commit -m "chore(music): remove Lavalink infrastructure

Deletes the lavalink service from all three compose files (including
preview-lavalink and the prod Docker secret), the application.yml config, and
the CI step guarding against a default lavalink password. Also retires the
committed YouTube refresh-token plumbing that lived in application.yml."
```

---

### Task 9: Remove the music i18n resources

48 locales, four touchpoints each. Scripted, because 192 files cannot be hand-edited reliably.

**Files:**

- Delete: `packages/i18n/src/locales/*/music.json` (48 files)
- Modify: `packages/i18n/src/locales/*/common.json` — remove `nav.music`
- Modify: `packages/i18n/src/locales/*/permissions.json` — remove `permissionCategories.music`
- Modify: `packages/i18n/src/locales/*/landing.json` — remove `features.music`
- Modify: `packages/i18n/src/client.ts:22`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: nothing.

- [ ] **Step 1: Delete the music namespace files and strip the music keys**

All locale JSON uses 2-space indent and a trailing newline, so re-serialising with `JSON.stringify(obj, null, 2) + "\n"` preserves formatting and keeps the diff to the removed keys.

```bash
node -e '
const fs = require("fs"), path = require("path");
const root = "packages/i18n/src/locales";
const targets = [
  ["common.json", ["nav", "music"]],
  ["permissions.json", ["permissionCategories", "music"]],
  ["landing.json", ["features", "music"]],
];
let deleted = 0, stripped = 0;
for (const locale of fs.readdirSync(root)) {
  const dir = path.join(root, locale);
  if (!fs.statSync(dir).isDirectory()) continue;

  const musicFile = path.join(dir, "music.json");
  if (fs.existsSync(musicFile)) { fs.unlinkSync(musicFile); deleted++; }

  for (const [file, [parent, key]] of targets) {
    const p = path.join(dir, file);
    if (!fs.existsSync(p)) continue;
    const json = JSON.parse(fs.readFileSync(p, "utf8"));
    if (json[parent] && key in json[parent]) {
      delete json[parent][key];
      fs.writeFileSync(p, JSON.stringify(json, null, 2) + "\n");
      stripped++;
    }
  }
}
console.log("deleted music.json:", deleted, "| stripped keys:", stripped);
'
```

Expected: `deleted music.json: 48 | stripped keys: 144`. Any lower number means a locale has a different shape — investigate before continuing rather than moving on.

- [ ] **Step 2: Remove the client namespace registration**

In `packages/i18n/src/client.ts` line 22, remove `"music"` from the namespace array, keeping comma placement valid.

- [ ] **Step 3: Verify the diff touches only music keys**

```bash
git diff --stat packages/i18n/src/locales | tail -3
git diff packages/i18n/src/locales -- '*/common.json' | grep '^[-+]' | grep -v '^[-+][-+]' | sort -u
```

Expected: the second command shows only removed `"music": …` lines. If it shows reindentation or reordering across whole files, the serialisation assumption was wrong — revert with `git checkout -- packages/i18n/src/locales` and strip the keys with a formatting-preserving edit instead.

- [ ] **Step 4: Rebuild so the served locales match the source**

The app serves `packages/i18n/dist/locales`, not `src/locales` — `dist/` is gitignored build output, so deleting source files alone does not change runtime behaviour until a rebuild.

```bash
docker compose --profile bot run --rm --no-deps bot pnpm turbo run build --filter=@fluxcore/i18n
ls packages/i18n/dist/locales/en/music.json 2>&1 | tail -1
```

Expected: the `ls` reports "No such file or directory". The i18n build script is `tsc && rm -rf dist/locales && cp -r src/locales dist/locales`, so it already wipes and recopies the locale tree — stale files cannot survive a successful build. If `music.json` is still present, the build did not run.

- [ ] **Step 5: Confirm no music i18n references survive**

```bash
grep -rn "music" packages/i18n/src
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add packages/i18n
git commit -m "chore(music): remove music i18n resources

Deletes 48 music.json namespace files and strips nav.music,
permissionCategories.music and features.music from every locale, plus the
music namespace registration in client.ts."
```

---

### Task 10: Update the living documentation

Historical records are deliberately left alone: `docs/design-audit/**`, `claudedocs/**`, and `docs/superpowers/plans/**` are point-in-time reports, not living docs. Editing them would falsify the record.

**Files:**

- Delete: `docs/music-setup.md`
- Modify: `CLAUDE.md`
- Modify: `docs/module-guide.md`
- Modify: `docs/PROJECT_INDEX.md`
- Modify: `design.md`
- Modify: `docs/features/dashboard-permissions.md`
- Modify: `docs/features/suggestions.md`
- Modify: `docs/ui-ux-agent-prompt.md`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: nothing.

- [ ] **Step 1: Delete the setup guide**

```bash
git rm docs/music-setup.md
```

- [ ] **Step 2: Update `CLAUDE.md`**

Remove Music from the `packages/systems/` description ("actions, music, tempVoice" → "actions, tempVoice"), from the "Active Modules" line, and from the systems path example. Remove the `docs/music-setup.md` bullet from the Documentation list.

- [ ] **Step 3: Update `docs/module-guide.md`**

This has the most references. Remove: the Music table-of-contents entry (line 23), the Lavalink environment row (line 112), the Music database-models row (line 197), the whole `### 3.6 Music` section (from line 414 through the end of that section), the Shoukaku init bullet in the startup sequence (line 661), the `music/` entry in the directory tree (line 677), "music" from the `voiceStateUpdate.ts` description (line 726), the Music systems row (line 745), the music routes row (line 817), the `/music` dashboard page row (line 854), the "Music DJ" preset row (line 915), the Music node in the ASCII architecture diagram (around line 1082), and the Music row in the module status table (line 1096).

Renumber any sections that followed `3.6 Music` so the numbering stays contiguous, and update the table of contents to match.

The `music.settings.manage` example at line 903 illustrates permission-key syntax — reword it to `moderation.cases.view` rather than deleting the line.

- [ ] **Step 4: Update the remaining docs**

- `docs/PROJECT_INDEX.md` — remove music/Lavalink entries
- `design.md` — remove music from any page or navigation inventory
- `docs/features/dashboard-permissions.md` — remove the `music.*` permission rows and the DJ preset
- `docs/features/suggestions.md` — remove the incidental music reference
- `docs/ui-ux-agent-prompt.md` — remove the music page from the screen inventory

- [ ] **Step 5: Verify only historical records still mention music**

```bash
grep -rniE "music|lavalink|shoukaku" --include="*.md" . \
  | grep -v node_modules \
  | grep -vE "docs/design-audit/|claudedocs/|docs/superpowers/"
```

Expected: no output. Hits under `docs/superpowers/specs/` and `docs/superpowers/plans/` are this spec and this plan — they are supposed to mention music.

- [ ] **Step 6: Commit**

```bash
git add -A docs CLAUDE.md design.md
git commit -m "docs(music): drop music from the living documentation

Deletes docs/music-setup.md and removes music from CLAUDE.md, the module guide,
project index, design doc, permissions and suggestions specs, and the UI/UX
brief. Historical audit reports under docs/design-audit, claudedocs and
docs/superpowers are left intact as point-in-time records."
```

---

### Task 11: Full verification gate

The first point at which the tree is expected to be green (D3). Nothing here should need code changes; anything that fails is a missed edit from an earlier task.

**Files:** none modified unless a failure is found.

**Interfaces:**

- Consumes: every prior task.
- Produces: a verified branch ready for PR.

- [ ] **Step 1: Typecheck the whole monorepo**

```bash
pnpm typecheck
```

Expected: clean across all packages. A "cannot find module `@fluxcore/systems/music/...`" error means a consumer edit was missed in Tasks 2-4.

- [ ] **Step 2: Run the unit tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 3: Run the integration tests**

```bash
pnpm test:integration
```

Expected: all pass. These use the real test PostgreSQL, whose schema still contains the three music tables (D1) — that is correct and expected.

- [ ] **Step 4: Validate the compose files**

```bash
PGADMIN_PASSWORD=ci-dummy docker compose config >/dev/null && echo BASE_OK
PGADMIN_PASSWORD=ci-dummy docker compose -f docker-compose.prod.yml config >/dev/null && echo PROD_OK
```

Expected: `BASE_OK`, `PROD_OK`.

- [ ] **Step 5: Boot both apps with no Lavalink variables present**

```bash
env -u LAVALINK_PASSWORD -u LAVALINK_HOST -u LAVALINK_PORT \
  PGADMIN_PASSWORD=ci-dummy docker compose --profile full up -d
sleep 20
PGADMIN_PASSWORD=ci-dummy docker compose --profile full logs bot dashboard | grep -iE "lavalink|shoukaku|error" | head -20
```

Expected: no `LAVALINK` errors and no "Missing required environment variable". The bot should reach "Logged in as …" and the dashboard should serve. Tear down with `PGADMIN_PASSWORD=ci-dummy docker compose --profile full down`.

- [ ] **Step 6: Clear stale build output and rebuild**

`apps/bot/dist/commands/` still holds a pre-refactor tree including `music/`. It is gitignored, but it is actively misleading when debugging command deployment.

```bash
rm -rf apps/bot/dist apps/dashboard/dist packages/systems/dist packages/i18n/dist
pnpm build
find apps/bot/dist apps/dashboard/dist packages/systems/dist packages/i18n/dist -ipath "*music*" 2>/dev/null
```

Expected: `pnpm build` succeeds and the `find` returns nothing.

- [ ] **Step 7: Deploy the slash commands and confirm music is gone**

This is the step that actually retires `/play` and `/queue` from Discord. It requires valid Discord credentials and makes a real API call.

```bash
pnpm deploy:commands
```

Expected: logs `Deploying N command(s)…` with N > 0, then "Commands deployed successfully!". Confirm in Discord that `/play` and `/queue` no longer appear.

If it reports the "No commands discovered" error from Task 1, the discovery path is wrong. If N is implausibly small, check that `collectCommandFiles` is walking `src/features`, not `dist`.

Note this is the first successful deployment since the features refactor, so it will also register commands from modules added since then — `suggestions`, `tickets`, and others. That is intended.

- [ ] **Step 8: Final sweep for stragglers**

```bash
grep -rniE "music|lavalink|shoukaku" \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  --include="*.yml" --include="*.yaml" \
  apps/ packages/ docker-compose*.yml turbo.json .github/ \
  | grep -v node_modules | grep -v "/dist/" | grep -v pnpm-lock.yaml
```

Expected: only hits in `packages/database/prisma/schema.prisma` (the three retained models, per D1) and `packages/systems/tests/helpers/db.ts` (the retained truncation entries). Anything else is a miss.

- [ ] **Step 9: Confirm the database was left alone**

```bash
git diff main --stat -- packages/database/
```

Expected: no output. Any diff under `packages/database/` violates D1 — revert it.

- [ ] **Step 10: Commit any fixes and push**

If Steps 1-9 required corrections, commit them:

```bash
git add -A
git commit -m "fix(music): address verification gate findings"
```

Then push and open the PR:

```bash
git push -u origin chore/drop-music-feature
```

The PR description should state that the three Prisma models are intentionally retained, that stale `music.*` role grants are intentionally left in place, and that the `deploy.ts` repair changes deployed commands for every module — reviewers need all three called out.

---

## Notes for the implementer

**Why intermediate tasks do not typecheck.** Tasks 2-5 remove a provider (`packages/systems`) and its consumers (bot, dashboard) in separate commits. The ordering — consumers first — keeps the window small, but `pnpm typecheck` is only meaningful at Task 11. Do not chase errors that a later task will resolve.

**Why the database is untouched.** Removing the Prisma models would force a destructive `DROP TABLE` migration and permanently discard guild music settings and libraries. Keeping the tables while removing the models is not an option either: Prisma compares `schema.prisma` against migration history, so every future `migrate dev` would try to generate a drop. Three unused models cost nothing.

**Why stale permission grants are fine.** `DashboardRole.permissions` is a JSON string array. Once `music` leaves the catalog, `matchPermission` finds no target key for those strings, so they grant nothing. The role editor only offers catalog keys, so the next save drops them.

## Follow-ups found while planning — deliberately NOT in scope

Both were discovered while mapping the removal. Neither is caused by it, and neither is fixed here.

1. **`packages/config` has no test runner.** `tests/index.test.ts` and `tests/bot-sync-secret.test.ts` exist but never execute: the package declares no `test` script, has no `vitest.config.ts`, and does not depend on vitest, so `turbo run test` skips it. Roughly 100 lines of config tests — including the `DASHBOARD_SESSION_SECRET` and `BOT_SYNC_SECRET` validation paths — have been providing no coverage. Worth a dedicated PR that adds the runner and confirms the surviving assertions actually pass.

2. **The `deploy.ts` repair has wide blast radius.** Task 1 fixes deployment for every module, not just music, so the first successful `pnpm deploy:commands` will register commands that have never reached Discord — `suggestions`, `tickets`, and anything else added since the features refactor. This is intended and was accepted when the fix was folded in, but reviewers should be told explicitly, and someone should eyeball the deployed command list afterwards.
