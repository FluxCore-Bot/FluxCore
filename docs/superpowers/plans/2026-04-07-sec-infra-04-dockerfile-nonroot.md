# Dev/Test Docker Stages Run as Root — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** MEDIUM
**Goal:** Drop root in the `development` and `test` Dockerfile stages so a process compromise doesn't grant root inside the container (and, on Linux with default user namespaces, root on the host bind mount).
**Architecture:** The base `node:22-alpine` image ships with an unprivileged `node` user (uid 1000). The two production stages already use `USER node`. We need to make sure `/app` is owned by that user before switching, otherwise pnpm and turbo can't write to `node_modules` / `.turbo`.
**Tech Stack:** Docker, docker-compose, Caddy, PostgreSQL, Lavalink, Vite

---

## Vulnerability

`Dockerfile` lines 25–31:

```dockerfile
FROM deps AS development
COPY . .
CMD ["pnpm", "dev"]

FROM deps AS test
COPY . .
CMD ["pnpm", "test"]
```

Both stages inherit `USER root` from `base`. Compose uses these stages for `bot`, `dashboard`, `preview-bot`, `preview-dashboard`. A compromised dependency or RCE in dev/test runs as root inside the container, can write anywhere on bind mounts, and bypasses any per-user filesystem ACLs the host might rely on.

The production stages (lines 67, 95) already use `USER node`, so the pattern is established.

## Files

- `Dockerfile`

## Tasks

### Task 1: Make `deps` give the `node` user ownership of `/app`

- [ ] **Step 1: Write verification check.** Build the existing dev stage and inspect uid:
  ```bash
  docker build --target development -t fluxcore-dev-old .
  docker run --rm fluxcore-dev-old id -u
  ```
- [ ] **Step 2: Run** — expect `0` (root).
- [ ] **Step 3: Apply fix.** Edit `Dockerfile` lines 11–31:
  ```dockerfile
  FROM base AS deps
  COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
  COPY packages/config/package.json ./packages/config/
  COPY packages/types/package.json ./packages/types/
  COPY packages/utils/package.json ./packages/utils/
  COPY packages/database/package.json ./packages/database/
  COPY packages/systems/package.json ./packages/systems/
  COPY packages/i18n/package.json ./packages/i18n/
  COPY apps/bot/package.json ./apps/bot/
  COPY apps/dashboard/package.json ./apps/dashboard/
  COPY packages/database/prisma ./packages/database/prisma/
  COPY packages/database/prisma.config.ts ./packages/database/
  RUN pnpm install --frozen-lockfile \
   && chown -R node:node /app

  FROM deps AS development
  COPY --chown=node:node . .
  USER node
  CMD ["pnpm", "dev"]

  FROM deps AS test
  COPY --chown=node:node . .
  USER node
  CMD ["pnpm", "test"]
  ```
- [ ] **Step 4: Verify.**
  ```bash
  docker build --target development -t fluxcore-dev-new .
  docker run --rm fluxcore-dev-new id -u        # expect 1000
  docker run --rm fluxcore-dev-new sh -c 'touch /app/.write-test && echo OK'   # expect OK
  docker build --target test -t fluxcore-test-new .
  docker run --rm fluxcore-test-new id -u       # expect 1000
  ```
- [ ] **Step 5: Commit.** `fix(docker): drop root in development and test stages`

### Task 2: Sanity-check compose dev workflow still works with bind mounts

- [ ] **Step 1: Write verification check.** Bind-mounted host files have host uid/gid; the `node` user (uid 1000) inside the container needs read access. On most Linux dev hosts the developer is also uid 1000 — verify:
  ```bash
  id -u
  ls -ld apps/bot
  ```
- [ ] **Step 2: Run** — note the uid; if it isn't 1000 the developer may need to add `user: "${UID}:${GID}"` to the compose service. Document this in the verification step.
- [ ] **Step 3: Apply fix.** If host uid != 1000, add to `docker-compose.yml` bot/dashboard services (and preview-*):
  ```yaml
      user: "${UID:-1000}:${GID:-1000}"
  ```
  And document in `docs/development.md` (or wherever local-dev docs live) that developers should `export UID GID` before `pnpm dev` if they aren't on uid 1000.
- [ ] **Step 4: Verify.**
  ```bash
  docker compose --profile bot up -d bot
  docker compose exec bot id
  docker compose exec bot sh -c 'touch /app/apps/bot/.devtest && rm /app/apps/bot/.devtest && echo OK'
  docker compose --profile bot down
  ```
  Expect uid != 0 and the touch to succeed.
- [ ] **Step 5: Commit.** `fix(docker): document non-root dev workflow with bind mounts`
