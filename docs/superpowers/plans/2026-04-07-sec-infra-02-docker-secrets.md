# Production Secrets via env_file → Docker Secrets — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** HIGH
**Goal:** Stop loading the entire `.env.prod` file as plaintext environment variables in production. Migrate every sensitive value to Docker secrets and have each app read them via `*_FILE` environment variables.
**Architecture:** docker-compose `secrets:` top-level block sources files from `./secrets/*` (gitignored). Each service references the secrets it needs and reads them at startup. Node services already use `dotenv` so we add a tiny secret-loader that reads `*_FILE` paths and exports the underlying value into `process.env` before `loadConfig()` runs.
**Tech Stack:** Docker, docker-compose, Caddy, PostgreSQL, Lavalink, Vite

---

## Vulnerability

`docker-compose.prod.yml` currently uses `env_file: - .env.prod` for `bot` (line 8) and `dashboard` (line 55), and inlines `${POSTGRES_PASSWORD}` for postgres (line 76) and the bot's `DATABASE_URL` (line 7). Consequences:

- The whole `.env.prod` is mounted into the container's environment, exposing every secret to anything that can `cat /proc/<pid>/environ` (other containers if namespaces leak, monitoring agents, crash dumps).
- `docker inspect` reveals the values in plaintext to anyone with Docker socket access.
- Backups (see Finding 3) and CI logs frequently leak entire env blocks.

Docker secrets store the values in a tmpfs-mounted file (`/run/secrets/<name>`) readable only by the process inside the container, never appearing in `docker inspect` or `ps eww`.

## Files

- `docker-compose.prod.yml`
- `packages/config/src/index.ts` (new helper)
- `.env.example`
- `.gitignore`
- `secrets/.gitkeep` (new)

## Tasks

### Task 1: Add a `_FILE` env-var resolver to `packages/config`

- [ ] **Step 1: Write verification test.** Add to `packages/config/tests/secret-files.test.ts`:
  ```typescript
  import { describe, it, expect, beforeEach } from "vitest";
  import { writeFileSync, mkdtempSync } from "node:fs";
  import { join } from "node:path";
  import { tmpdir } from "node:os";
  import { resolveSecretFiles } from "../src/secret-files";

  describe("resolveSecretFiles", () => {
    beforeEach(() => {
      delete process.env.DISCORD_TOKEN;
      delete process.env.DISCORD_TOKEN_FILE;
    });

    it("loads value from a *_FILE path into the base var", () => {
      const dir = mkdtempSync(join(tmpdir(), "sec-"));
      const path = join(dir, "token");
      writeFileSync(path, "abc123\n");
      process.env.DISCORD_TOKEN_FILE = path;
      resolveSecretFiles(["DISCORD_TOKEN"]);
      expect(process.env.DISCORD_TOKEN).toBe("abc123");
    });

    it("leaves base var alone if no *_FILE present", () => {
      process.env.DISCORD_TOKEN = "literal";
      resolveSecretFiles(["DISCORD_TOKEN"]);
      expect(process.env.DISCORD_TOKEN).toBe("literal");
    });

    it("throws when both are set", () => {
      process.env.DISCORD_TOKEN = "literal";
      process.env.DISCORD_TOKEN_FILE = "/nope";
      expect(() => resolveSecretFiles(["DISCORD_TOKEN"])).toThrow(/both/);
    });
  });
  ```
- [ ] **Step 2: Run** `pnpm --filter @fluxcore/config test` — expect failure (helper missing).
- [ ] **Step 3: Apply fix.** Create `packages/config/src/secret-files.ts`:
  ```typescript
  import { readFileSync } from "node:fs";

  export function resolveSecretFiles(names: readonly string[]): void {
    for (const name of names) {
      const fileVar = `${name}_FILE`;
      const filePath = process.env[fileVar];
      const literal = process.env[name];
      if (filePath && literal) {
        throw new Error(
          `Both ${name} and ${fileVar} are set; choose one.`,
        );
      }
      if (filePath) {
        process.env[name] = readFileSync(filePath, "utf8").trimEnd();
      }
    }
  }
  ```
  Then in `packages/config/src/index.ts` add at the top of `loadConfig()`:
  ```typescript
  import { resolveSecretFiles } from "./secret-files";

  function loadConfig(): Config {
    resolveSecretFiles([
      "DISCORD_TOKEN",
      "DASHBOARD_CLIENT_SECRET",
      "DASHBOARD_SESSION_SECRET",
      "BOT_SYNC_SECRET",
      "LAVALINK_PASSWORD",
      "POSTGRES_PASSWORD",
      "DATABASE_URL",
    ]);
    // ...rest unchanged
  ```
  Re-export from `packages/config/src/index.ts`: `export { resolveSecretFiles } from "./secret-files";`
- [ ] **Step 4: Verify.** `pnpm --filter @fluxcore/config test` passes; `pnpm typecheck` passes.
- [ ] **Step 5: Commit.** `feat(config): add resolveSecretFiles helper for Docker secret _FILE pattern`

### Task 2: Define secrets in `docker-compose.prod.yml`

- [ ] **Step 1: Write verification check.** `docker compose -f docker-compose.prod.yml config` should currently show `env_file: .env.prod` under bot/dashboard. Capture baseline:
  ```bash
  docker compose -f docker-compose.prod.yml config | grep -E '(env_file|secrets:)'
  ```
- [ ] **Step 2: Run** — expect only `env_file` lines, no `secrets:`.
- [ ] **Step 3: Apply fix.** Rewrite `docker-compose.prod.yml` to use secrets. Append at the end of the file:
  ```yaml
  secrets:
    discord_token:
      file: ./secrets/discord_token
    dashboard_client_secret:
      file: ./secrets/dashboard_client_secret
    dashboard_session_secret:
      file: ./secrets/dashboard_session_secret
    bot_sync_secret:
      file: ./secrets/bot_sync_secret
    lavalink_password:
      file: ./secrets/lavalink_password
    postgres_password:
      file: ./secrets/postgres_password
  ```
  Update the bot service (replace lines 2–24):
  ```yaml
    bot:
      build:
        context: .
        target: production-bot
      environment:
        NODE_ENV: production
        DISCORD_TOKEN_FILE: /run/secrets/discord_token
        DASHBOARD_SESSION_SECRET_FILE: /run/secrets/dashboard_session_secret
        BOT_SYNC_SECRET_FILE: /run/secrets/bot_sync_secret
        LAVALINK_PASSWORD_FILE: /run/secrets/lavalink_password
        POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
        # DATABASE_URL is built at runtime from POSTGRES_PASSWORD inside the entrypoint
        DATABASE_URL_TEMPLATE: "postgresql://fluxcore:__PW__@postgres:5432/fluxcore"
        CLIENT_ID: ${CLIENT_ID:?CLIENT_ID required}
        LAVALINK_HOST: lavalink
        LAVALINK_PORT: "2333"
      secrets:
        - discord_token
        - dashboard_session_secret
        - bot_sync_secret
        - lavalink_password
        - postgres_password
      depends_on:
        postgres:
          condition: service_healthy
        lavalink:
          condition: service_healthy
      networks:
        - backend
      restart: always
      deploy:
        resources:
          limits:
            memory: 512M
      profiles:
        - bot
        - full
  ```
  Update the dashboard service similarly (replace lines 49–70) with secrets `discord_token`, `dashboard_client_secret`, `dashboard_session_secret`, `bot_sync_secret`, `postgres_password`. Update postgres (lines 72–91):
  ```yaml
    postgres:
      image: postgres:18-alpine
      environment:
        POSTGRES_USER: fluxcore
        POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
        POSTGRES_DB: fluxcore
      secrets:
        - postgres_password
      # ...rest unchanged
  ```
  Lavalink also needs the password as a file; either keep using `LAVALINK_PASSWORD` env (it goes into the JVM's `${LAVALINK_SERVER_PASSWORD}`) or shell-substitute via an entrypoint wrapper. Simplest: keep one env var read from the secret file in an inline command:
  ```yaml
    lavalink:
      image: ghcr.io/lavalink-devs/lavalink:4
      volumes:
        - ./lavalink/application.yml:/opt/Lavalink/application.yml:ro
      environment:
        - _JAVA_OPTIONS=-Xmx256m
      secrets:
        - lavalink_password
      entrypoint:
        - sh
        - -c
        - 'export LAVALINK_SERVER_PASSWORD=$(cat /run/secrets/lavalink_password) && exec /opt/Lavalink/launch.sh'
      healthcheck:
        test: ["CMD-SHELL", "wget -qO- --header=\"Authorization: $(cat /run/secrets/lavalink_password)\" http://localhost:2333/version || exit 1"]
  ```
- [ ] **Step 4: Verify.**
  ```bash
  mkdir -p secrets
  for f in discord_token dashboard_client_secret dashboard_session_secret bot_sync_secret lavalink_password postgres_password; do
    openssl rand -base64 32 > "secrets/$f"
  done
  CLIENT_ID=test docker compose -f docker-compose.prod.yml config > /tmp/prodcfg.yml
  grep -c '_FILE:' /tmp/prodcfg.yml      # expect >= 8
  grep -c 'env_file' /tmp/prodcfg.yml    # expect 0
  grep 'secrets:' /tmp/prodcfg.yml       # expect top-level secrets block
  ```
- [ ] **Step 5: Commit.** `fix(docker): migrate prod secrets from env_file to Docker secrets`

### Task 3: Build the runtime `DATABASE_URL` from the postgres password file

- [ ] **Step 1: Write verification check.** Add an integration smoke test as a shell script `scripts/test-db-url-from-secret.sh`:
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  TMPDIR=$(mktemp -d)
  echo "secret-pw" > "$TMPDIR/pw"
  POSTGRES_PASSWORD_FILE="$TMPDIR/pw" \
    node -e '
      const { resolveSecretFiles } = require("./packages/config/dist/secret-files.js");
      resolveSecretFiles(["POSTGRES_PASSWORD"]);
      process.env.DATABASE_URL = `postgresql://fluxcore:${process.env.POSTGRES_PASSWORD}@postgres:5432/fluxcore`;
      console.log(process.env.DATABASE_URL);
    '
  ```
- [ ] **Step 2: Run** — expect `postgresql://fluxcore:secret-pw@postgres:5432/fluxcore`.
- [ ] **Step 3: Apply fix.** Update `packages/config/src/index.ts` to construct `DATABASE_URL` if it's unset but `POSTGRES_PASSWORD` is set:
  ```typescript
  if (!process.env.DATABASE_URL && process.env.POSTGRES_PASSWORD) {
    const host = process.env.POSTGRES_HOST || "postgres";
    const db = process.env.POSTGRES_DB || "fluxcore";
    const user = process.env.POSTGRES_USER || "fluxcore";
    process.env.DATABASE_URL = `postgresql://${user}:${process.env.POSTGRES_PASSWORD}@${host}:5432/${db}`;
  }
  ```
- [ ] **Step 4: Verify.** `pnpm --filter @fluxcore/config test && pnpm --filter @fluxcore/config build` and re-run the script.
- [ ] **Step 5: Commit.** `feat(config): build DATABASE_URL from POSTGRES_PASSWORD when unset`

### Task 4: Document the migration in `.env.example` and add `secrets/` to gitignore

- [ ] **Step 1: Write verification check.** `grep -n '^secrets/' .gitignore` — expect no match yet.
- [ ] **Step 2: Run** above command.
- [ ] **Step 3: Apply fix.** Append to `.gitignore`:
  ```
  /secrets/*
  !/secrets/.gitkeep
  ```
  Create `secrets/.gitkeep` (empty file). Add a section to `.env.example`:
  ```
  # === Production secrets (Docker secrets — DO NOT commit values) ===
  # In production, place each secret as a file under ./secrets/<name>:
  #   secrets/discord_token
  #   secrets/dashboard_client_secret
  #   secrets/dashboard_session_secret
  #   secrets/bot_sync_secret
  #   secrets/lavalink_password
  #   secrets/postgres_password
  # Generate strong values with: openssl rand -base64 32
  ```
- [ ] **Step 4: Verify.** `grep -n 'Docker secrets' .env.example` and `git check-ignore secrets/discord_token` (must report ignored).
- [ ] **Step 5: Commit.** `docs(env): document Docker secrets layout for production`
