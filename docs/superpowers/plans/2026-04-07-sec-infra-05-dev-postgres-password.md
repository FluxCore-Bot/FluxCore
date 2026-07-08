# Hardcoded Dev Postgres Password — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** MEDIUM
**Goal:** Allow developers to override the local Postgres password via environment instead of leaving the literal `fluxcore` value baked into `docker-compose.yml`. Keep `fluxcore` as the documented default for friction-free local dev so this is purely additive.
**Architecture:** docker-compose's `${VAR:-default}` syntax interpolates from the host shell or `.env` (compose's auto-loaded file). We can also templatise the documented `DATABASE_URL` accordingly.
**Tech Stack:** Docker, docker-compose, Caddy, PostgreSQL, Lavalink, Vite

---

## Vulnerability

`docker-compose.yml:136` hardcodes `POSTGRES_PASSWORD: fluxcore`. While dev-only, this means:

- Developers can't override the password without editing tracked files (causing dirty git state and accidental commits).
- The literal string is duplicated across `.env.example` (`DATABASE_URL=postgresql://fluxcore:fluxcore@postgres:5432/fluxcore`) and the compose file, so they drift.
- Forming a habit of "the password is in compose" trains developers to commit secrets.

(pgAdmin defaults are addressed in a separate plan: `sec-infra-10-pgadmin-credentials.md`.)

## Files

- `docker-compose.yml` (postgres service, lines 132–149)
- `.env.example`

## Tasks

### Task 1: Parameterise the dev postgres password

- [ ] **Step 1: Write verification check.**
  ```bash
  grep -n 'POSTGRES_PASSWORD' docker-compose.yml
  ```
- [ ] **Step 2: Run** — expect line 136 with literal `fluxcore`.
- [ ] **Step 3: Apply fix.** Edit lines 132–149:
  ```yaml
    postgres:
      image: postgres:18-alpine
      environment:
        POSTGRES_USER: ${POSTGRES_USER:-fluxcore}
        POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-fluxcore}
        POSTGRES_DB: ${POSTGRES_DB:-fluxcore}
      volumes:
        - pgdata:/var/lib/postgresql/data
      ports:
        - "127.0.0.1:5432:5432"
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-fluxcore}"]
        interval: 5s
        timeout: 5s
        retries: 5
      networks:
        - fluxcore
      restart: unless-stopped
  ```
- [ ] **Step 4: Verify.**
  ```bash
  docker compose -f docker-compose.yml config | grep -A4 'postgres:' | grep POSTGRES_PASSWORD
  POSTGRES_PASSWORD=overridden docker compose -f docker-compose.yml config | grep POSTGRES_PASSWORD
  ```
  First command must show `POSTGRES_PASSWORD: fluxcore` (default), second must show `overridden`.
- [ ] **Step 5: Commit.** `fix(docker): allow overriding dev POSTGRES_PASSWORD via env`

### Task 2: Document the override in `.env.example`

- [ ] **Step 1: Write verification check.**
  ```bash
  grep -n 'POSTGRES_PASSWORD' .env.example
  ```
- [ ] **Step 2: Run** — expect only the production-only block at line 52.
- [ ] **Step 3: Apply fix.** Update `.env.example` lines 14–17:
  ```
   # Database (PostgreSQL) - points to Docker container hostname
  -DATABASE_URL=postgresql://fluxcore:fluxcore@postgres:5432/fluxcore
  +DATABASE_URL=postgresql://fluxcore:fluxcore@postgres:5432/fluxcore
  +# Optional dev override — defaults to "fluxcore" if unset
  +# POSTGRES_USER=fluxcore
  +# POSTGRES_PASSWORD=fluxcore
  +# POSTGRES_DB=fluxcore
  ```
- [ ] **Step 4: Verify.** `grep -c 'POSTGRES_PASSWORD' .env.example` returns at least 2 (one dev, one prod).
- [ ] **Step 5: Commit.** `docs(env): document optional dev postgres overrides`

### Task 3: Smoke test the override path

- [ ] **Step 1: Write verification check.**
  ```bash
  POSTGRES_PASSWORD=smoke-pw docker compose --profile bot up -d postgres
  sleep 5
  docker compose exec postgres psql -U fluxcore -c 'select 1' postgres
  ```
- [ ] **Step 2: Run** — expect the `select 1` to succeed (proves the password got through).
- [ ] **Step 3: Apply fix.** No-op.
- [ ] **Step 4: Verify.** `docker compose --profile bot down -v`.
- [ ] **Step 5: Commit.** No commit.
