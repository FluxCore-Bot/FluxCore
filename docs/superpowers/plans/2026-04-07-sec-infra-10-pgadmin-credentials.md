# pgAdmin Hardcoded admin/admin — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** MEDIUM
**Goal:** Replace the literal `admin@fluxcore.dev` / `admin` credentials in the pgAdmin dev service with environment-driven values. Keep dev convenience defaults but make them overridable.
**Architecture:** pgAdmin's official image reads `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` from the environment on first boot. docker-compose can interpolate from the host shell with `${VAR:-default}` syntax. The pgAdmin container is gated behind the `tools` profile and bound to `127.0.0.1:5050`, so the blast radius is limited to the dev host — but it's still trivial to fix.
**Tech Stack:** Docker, docker-compose, Caddy, PostgreSQL, Lavalink, Vite

---

## Vulnerability

`docker-compose.yml:151–166`:

```yaml
pgadmin:
  image: dpage/pgadmin4:latest
  environment:
    PGADMIN_DEFAULT_EMAIL: admin@fluxcore.dev
    PGADMIN_DEFAULT_PASSWORD: admin
    PGADMIN_CONFIG_SERVER_MODE: "False"
  ports:
    - "127.0.0.1:5050:80"
  ...
```

Hardcoded `admin/admin` is the canonical "test for default creds" target. If a developer accidentally exposes 5050 (binds to `0.0.0.0`, opens a tunnel, runs on a shared host) the entire dev database is one HTTP request away. Beyond the immediate exposure, hardcoded creds in tracked files train developers to leave defaults in place.

## Files

- `docker-compose.yml` (pgadmin block, lines 151–166)
- `.env.example`

## Tasks

### Task 1: Parameterise pgadmin credentials

- [ ] **Step 1: Write verification check.**
  ```bash
  grep -n 'PGADMIN_DEFAULT' docker-compose.yml
  ```
- [ ] **Step 2: Run** — expect lines 154–155 with literals.
- [ ] **Step 3: Apply fix.** Edit `docker-compose.yml` lines 151–166:
  ```yaml
    pgadmin:
      image: dpage/pgadmin4:latest
      environment:
        PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL:-admin@fluxcore.local}
        PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD:?PGADMIN_PASSWORD is required to enable the tools profile}
        PGADMIN_CONFIG_SERVER_MODE: "False"
      ports:
        - "127.0.0.1:5050:80"
      depends_on:
        postgres:
          condition: service_healthy
      networks:
        - fluxcore
      restart: unless-stopped
      profiles:
        - tools
  ```
  The `:?` guard means running `docker compose --profile tools up pgadmin` without setting `PGADMIN_PASSWORD` errors out, preventing accidental defaults.
- [ ] **Step 4: Verify.**
  ```bash
  grep -n 'admin@fluxcore.dev' docker-compose.yml   # expect empty
  grep -n 'PGADMIN_DEFAULT_PASSWORD: admin$' docker-compose.yml   # expect empty
  unset PGADMIN_PASSWORD; docker compose --profile tools config 2>&1 | grep -i 'PGADMIN_PASSWORD is required'
  PGADMIN_PASSWORD=devpw docker compose --profile tools config | grep -A2 pgadmin | grep PGADMIN_DEFAULT_PASSWORD
  ```
  First negative grep: empty. Second: empty. Third: prints error. Fourth: shows `PGADMIN_DEFAULT_PASSWORD: devpw`.
- [ ] **Step 5: Commit.** `fix(docker): require PGADMIN_PASSWORD env var for pgadmin tools profile`

### Task 2: Document in `.env.example`

- [ ] **Step 1: Write verification check.** `grep -n PGADMIN .env.example` — expect no match.
- [ ] **Step 2: Run** above.
- [ ] **Step 3: Apply fix.** Append to `.env.example` after the existing dev section:
  ```
  # === Dev tools profile (pgadmin) ===
  # Required when running: docker compose --profile tools up pgadmin
  # PGADMIN_EMAIL=admin@fluxcore.local
  # PGADMIN_PASSWORD=
  ```
- [ ] **Step 4: Verify.** `grep -c PGADMIN .env.example` returns >= 2.
- [ ] **Step 5: Commit.** `docs(env): document pgadmin credential overrides`

### Task 3: Smoke test

- [ ] **Step 1: Write verification check.**
  ```bash
  PGADMIN_PASSWORD=$(openssl rand -base64 12) docker compose --profile tools up -d pgadmin
  sleep 6
  curl -sSf http://127.0.0.1:5050/login | grep -q 'pgAdmin' && echo OK
  docker compose --profile tools down
  ```
- [ ] **Step 2: Run** — expect `OK`.
- [ ] **Step 3: Apply fix.** No-op.
- [ ] **Step 4: Verify.** `docker compose ps pgadmin` shows nothing after teardown.
- [ ] **Step 5: Commit.** No commit.
