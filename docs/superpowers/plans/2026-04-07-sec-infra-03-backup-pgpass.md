# Backup Service `PGPASSWORD` Exposure — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** HIGH
**Goal:** Stop exporting the postgres password as a process-visible env var inside the backup container. Use a `.pgpass` file generated at runtime from a Docker secret so `pg_dump` reads credentials from disk (mode 0600) instead of environment.
**Architecture:** PostgreSQL clients automatically read `~/.pgpass` (or `$PGPASSFILE`) when no password is supplied. Docker secrets give us the password as a file under `/run/secrets/postgres_password`. The backup script writes a temporary `.pgpass` from the secret, runs `pg_dump`, then exits — credentials never appear in `/proc/<pid>/environ`.
**Tech Stack:** Docker, docker-compose, Caddy, PostgreSQL, Lavalink, Vite

---

## Vulnerability

`docker-compose.prod.yml` lines 118–143 define a backup service that sets `PGPASSWORD: ${POSTGRES_PASSWORD}`. This means:

- The password is interpolated from the host shell into the compose config (visible in `docker compose config`).
- It is exported into every child process started by `crond` and `pg_dump`.
- It appears in `docker inspect backup` and `/proc/<pid>/environ` on the host.
- Any subprocess crash dump or exec hook that captures the environment leaks the password.

`docker/backup.sh` line 7 also relies on `$PGUSER`/`$PGHOST` from the env block.

This plan depends on Finding 2 (Docker secrets migration) — apply that first or alongside this one.

## Files

- `docker-compose.prod.yml` (backup service block, lines 118–143)
- `docker/backup.sh`

## Tasks

### Task 1: Switch the backup service to a Docker secret

- [ ] **Step 1: Write verification check.**
  ```bash
  grep -n 'PGPASSWORD' docker-compose.prod.yml docker/backup.sh
  ```
- [ ] **Step 2: Run** — expect `docker-compose.prod.yml:123` and any references in `backup.sh`.
- [ ] **Step 3: Apply fix.** Replace the backup service block (lines 118–143) with:
  ```yaml
    backup:
      image: postgres:18-alpine
      environment:
        PGHOST: postgres
        PGUSER: fluxcore
        PGDATABASE: fluxcore
        PGPASSFILE: /home/postgres/.pgpass
        BACKUP_RETENTION_DAYS: ${BACKUP_RETENTION_DAYS:-7}
        BACKUP_SCHEDULE: ${BACKUP_SCHEDULE:-0 2 * * *}
      volumes:
        - ./docker/backup.sh:/backup.sh:ro
        - backups:/backups
      secrets:
        - postgres_password
      entrypoint: ["/bin/sh", "-c"]
      command:
        - |
          set -eu
          # Build .pgpass from the mounted secret (mode 0600 required by libpq)
          mkdir -p /home/postgres
          printf '%s:%s:%s:%s:%s\n' "$PGHOST" 5432 "$PGDATABASE" "$PGUSER" "$(cat /run/secrets/postgres_password)" > "$PGPASSFILE"
          chmod 600 "$PGPASSFILE"
          echo "$BACKUP_SCHEDULE /backup.sh" | crontab -
          crond -f -l 2
      depends_on:
        postgres:
          condition: service_healthy
      networks:
        - backend
      restart: always
      deploy:
        resources:
          limits:
            memory: 256M
  ```
- [ ] **Step 4: Verify.**
  ```bash
  CLIENT_ID=test docker compose -f docker-compose.prod.yml config | awk '/^  backup:/,/^  [a-z]+:/' > /tmp/backup.yml
  grep -c 'PGPASSWORD' /tmp/backup.yml      # expect 0
  grep 'PGPASSFILE' /tmp/backup.yml         # expect /home/postgres/.pgpass
  grep 'postgres_password' /tmp/backup.yml  # expect listed under secrets
  ```
- [ ] **Step 5: Commit.** `fix(docker): use Docker secret + .pgpass for backup service instead of PGPASSWORD env`

### Task 2: Update `docker/backup.sh` to rely on the `.pgpass` file

- [ ] **Step 1: Write verification check.**
  ```bash
  grep -n 'PGPASSWORD\|pg_dump' docker/backup.sh
  ```
- [ ] **Step 2: Run** — expect line 7 `pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" | gzip > "$BACKUP_FILE"` (which already does NOT pass a password — good).
- [ ] **Step 3: Apply fix.** Tighten `docker/backup.sh` so a missing `.pgpass` fails loudly:
  ```bash
  #!/bin/sh
  set -eu

  : "${PGPASSFILE:?PGPASSFILE must be set}"
  if [ ! -f "$PGPASSFILE" ]; then
    echo "[$(date)] FATAL: $PGPASSFILE missing — refusing to run backup" >&2
    exit 2
  fi

  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="/backups/fluxcore_${TIMESTAMP}.sql.gz"

  pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" | gzip > "$BACKUP_FILE"

  # Remove backups older than retention period
  find /backups -name "fluxcore_*.sql.gz" -mtime +"${BACKUP_RETENTION_DAYS:-7}" -delete

  echo "[$(date)] Backup completed: $BACKUP_FILE"
  ```
- [ ] **Step 4: Verify.**
  ```bash
  sh -n docker/backup.sh   # syntax check
  grep -c PGPASSWORD docker/backup.sh   # expect 0
  ```
- [ ] **Step 5: Commit.** `fix(backup): rely on PGPASSFILE and fail closed when missing`

### Task 3: Smoke test against a real backup run

- [ ] **Step 1: Write verification check.** Bring up postgres + backup using a throwaway secret:
  ```bash
  mkdir -p secrets && echo "smokepw" > secrets/postgres_password
  CLIENT_ID=x docker compose -f docker-compose.prod.yml --profile full up -d postgres backup
  sleep 5
  docker compose -f docker-compose.prod.yml exec backup sh -c 'cat $PGPASSFILE && stat -c %a $PGPASSFILE'
  docker compose -f docker-compose.prod.yml exec backup sh -c 'env | grep -i pgpass; env | grep -i pgpassword || echo "no PGPASSWORD - good"'
  docker compose -f docker-compose.prod.yml exec backup /backup.sh
  docker compose -f docker-compose.prod.yml exec backup ls -lh /backups/
  ```
- [ ] **Step 2: Run** — expect `.pgpass` exists with mode `600`, no `PGPASSWORD` in env, and a non-empty `fluxcore_*.sql.gz` file.
- [ ] **Step 3: Apply fix.** No-op — verification only.
- [ ] **Step 4: Verify.** `docker compose -f docker-compose.prod.yml down -v` cleans up. `rm secrets/postgres_password`.
- [ ] **Step 5: Commit.** No commit if Tasks 1–2 are clean; otherwise `fix(backup): smoke-test follow-up`.
