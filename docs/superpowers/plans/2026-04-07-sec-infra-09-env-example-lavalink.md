# `.env.example` Lavalink Default — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** LOW
**Goal:** Stop shipping a working default for `LAVALINK_PASSWORD` in `.env.example`. Leave the value blank with a generation hint so anyone copying the file is forced to set their own.
**Architecture:** `.env.example` is the canonical reference developers copy to `.env.dev` / `.env.prod`. Whatever it contains becomes the default everyone uses unless they think to change it.
**Tech Stack:** Docker, docker-compose, Caddy, PostgreSQL, Lavalink, Vite

---

## Vulnerability

`.env.example:46–47`:

```
# Lavalink server password (must match lavalink/application.yml)
LAVALINK_PASSWORD=youshallnotpass
```

This is the literal Lavalink default and is hardcoded across the codebase (see Finding 1). Even after Finding 1 is fixed, anyone copying `.env.example` would still get the unsafe value unless this line is corrected.

## Files

- `.env.example`

## Tasks

### Task 1: Blank the default and add a generation hint

- [ ] **Step 1: Write verification check.**
  ```bash
  grep -n 'LAVALINK_PASSWORD' .env.example
  ```
- [ ] **Step 2: Run** — expect line 47 with `LAVALINK_PASSWORD=youshallnotpass`.
- [ ] **Step 3: Apply fix.** Edit `.env.example` lines 40–47:
  ```
   # === Lavalink (Music System) ===

   # Lavalink server host (Docker service name in compose, or external IP)
   LAVALINK_HOST=lavalink
   # Lavalink server port
   LAVALINK_PORT=2333
  -# Lavalink server password (must match lavalink/application.yml)
  -LAVALINK_PASSWORD=youshallnotpass
  +# Lavalink server password (REQUIRED).
  +# Must match the LAVALINK_SERVER_PASSWORD env var the lavalink container reads.
  +# Generate with: openssl rand -base64 32
  +LAVALINK_PASSWORD=
  ```
- [ ] **Step 4: Verify.**
  ```bash
  grep -n 'youshallnotpass' .env.example   # expect no match
  grep -A2 'LAVALINK_PASSWORD' .env.example | grep -i 'openssl rand'
  ```
- [ ] **Step 5: Commit.** `docs(env): blank LAVALINK_PASSWORD default and add generation hint`

### Task 2: Add a CI grep guard so the literal can't be reintroduced

- [ ] **Step 1: Write verification check.** This task can be merged into the security workflow created in `sec-infra-08`. Add a step to the `trivy-fs` job (or as a new tiny job) that fails if `youshallnotpass` ever reappears.
- [ ] **Step 2: Run** — without the guard, someone could re-add the literal and CI would pass.
- [ ] **Step 3: Apply fix.** Append to `.github/workflows/security.yml` (or to whichever lint workflow exists):
  ```yaml
    forbidden-strings:
      name: forbidden strings
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - name: Block re-introduction of default lavalink password
          run: |
            if grep -RIn --exclude-dir=.git --exclude-dir=node_modules --exclude='*.md' 'youshallnotpass' .; then
              echo "::error::The literal 'youshallnotpass' must never be committed."
              exit 1
            fi
  ```
- [ ] **Step 4: Verify.**
  ```bash
  grep -RIn --exclude-dir=.git --exclude-dir=node_modules --exclude='*.md' 'youshallnotpass' . || echo OK
  ```
  Expect `OK`.
- [ ] **Step 5: Commit.** `ci(security): block reintroduction of default lavalink password`
