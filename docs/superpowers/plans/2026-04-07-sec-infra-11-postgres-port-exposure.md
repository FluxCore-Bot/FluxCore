# Postgres Loopback Port Exposure — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** LOW
**Goal:** Document that the dev compose file intentionally exposes Postgres on `127.0.0.1:5432` for local debugging tools (psql, DataGrip, Prisma Studio), and add a `no-db-port` profile that suppresses the binding for developers who don't want it.
**Architecture:** docker-compose `ports:` cannot be conditionally enabled per profile out of the box. Workaround: split the binding into a sidecar service that runs only under a specific profile, or rely on a compose override file. The cleanest approach is the override-file pattern: keep the default binding in `docker-compose.yml`, and provide `docker-compose.no-db-port.yml` that re-declares the postgres service with `ports: []` to clear it.
**Tech Stack:** Docker, docker-compose, Caddy, PostgreSQL, Lavalink, Vite

---

## Vulnerability

`docker-compose.yml:140–141`:

```yaml
ports:
  - "127.0.0.1:5432:5432"
```

This is bound to loopback, so it is **not** reachable from other hosts on the network. The risk is local-host process boundary only:

- Any process on the dev machine (browser extensions, untrusted CLI tools, malware in `~/Downloads`) can connect using the well-known dev creds (`fluxcore`/`fluxcore`).
- After the dev-password fix (Finding 5) the password is overridable, but the loopback exposure remains.

This is intentional and useful, but undocumented. We need to (a) state that intent in a comment, (b) give developers an opt-out, and (c) confirm it isn't accidentally exposed publicly.

## Files

- `docker-compose.yml`
- `docker-compose.no-db-port.yml` (CREATE)

## Tasks

### Task 1: Document the binding inline

- [ ] **Step 1: Write verification check.**
  ```bash
  grep -B1 -A1 '127.0.0.1:5432' docker-compose.yml
  ```
- [ ] **Step 2: Run** — expect just the bare `ports:` block.
- [ ] **Step 3: Apply fix.** Edit `docker-compose.yml` lines 140–141:
  ```yaml
  -    ports:
  -      - "127.0.0.1:5432:5432"
  +    # Loopback-only exposure for local debugging tools (psql, DataGrip, Prisma Studio).
  +    # NOT reachable from other hosts. To disable entirely, use the override:
  +    #   docker compose -f docker-compose.yml -f docker-compose.no-db-port.yml up
  +    ports:
  +      - "127.0.0.1:5432:5432"
  ```
- [ ] **Step 4: Verify.** `grep -A1 'Loopback-only' docker-compose.yml` shows the comment.
- [ ] **Step 5: Commit.** `docs(docker): document intentional postgres loopback exposure`

### Task 2: Provide a `no-db-port` override

- [ ] **Step 1: Write verification check.**
  ```bash
  ls docker-compose.no-db-port.yml 2>&1
  ```
- [ ] **Step 2: Run** — expect "No such file or directory".
- [ ] **Step 3: Apply fix.** Create `docker-compose.no-db-port.yml`:
  ```yaml
  # Apply with: docker compose -f docker-compose.yml -f docker-compose.no-db-port.yml up
  # Suppresses the host loopback binding for the postgres service.
  services:
    postgres:
      ports: !reset []
  ```
- [ ] **Step 4: Verify.**
  ```bash
  docker compose -f docker-compose.yml config | awk '/postgres:/,/^  [a-z]/' | grep '5432'
  # expect "127.0.0.1:5432:5432"
  docker compose -f docker-compose.yml -f docker-compose.no-db-port.yml config | awk '/postgres:/,/^  [a-z]/' | grep '5432' || echo NO_PORT
  # expect NO_PORT
  ```
- [ ] **Step 5: Commit.** `feat(docker): add no-db-port override to suppress postgres host binding`

### Task 3: Verify no public exposure can sneak in

- [ ] **Step 1: Write verification check.** Add a forbidden-string CI check (combine with `sec-infra-09` Task 2 if already added):
  ```bash
  grep -n '"5432:5432"\|"0.0.0.0:5432' docker-compose.yml docker-compose.prod.yml
  ```
- [ ] **Step 2: Run** — expect no match (both forms would mean a public binding).
- [ ] **Step 3: Apply fix.** Add to `.github/workflows/security.yml` `forbidden-strings` job:
  ```yaml
        - name: Block public postgres exposure
          run: |
            if grep -RIn --include='docker-compose*.yml' -E '"(0\.0\.0\.0:)?5432:5432"' .; then
              echo "::error::Postgres must only bind 127.0.0.1, never 0.0.0.0 or unbound."
              exit 1
            fi
  ```
- [ ] **Step 4: Verify.** Re-run the workflow on the PR; the new step passes.
- [ ] **Step 5: Commit.** `ci(security): block public postgres port exposure in compose files`
