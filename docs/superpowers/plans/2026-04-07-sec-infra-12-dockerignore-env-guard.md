# `.dockerignore` Validation & Env-File Guard — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** LOW
**Goal:** Make sure `.env*` files can never sneak into a Docker build context, never get committed to git, and never silently bypass `.dockerignore`. Add a CI check that fails the build if a real `.env`, `.env.dev`, `.env.prod`, or `.env.local` is present in the working tree.
**Architecture:** `.dockerignore` already lists `.env`, `.env.dev`, `.env.prod` (lines 3–5), so they cannot enter the build context. We additionally need: (a) `.gitignore` to block them from being committed, and (b) a CI check that asserts they aren't in the worktree at all.
**Tech Stack:** Docker, docker-compose, Caddy, PostgreSQL, Lavalink, Vite

---

## Vulnerability

Current state:

- `.dockerignore` lines 3–5 cover `.env`, `.env.dev`, `.env.prod` — good but doesn't cover `.env.local`, `.env.production`, `.env.*.local`.
- There's no CI assertion that those files aren't checked in. A developer can `git add -f .env.prod` and CI won't notice.
- There's no test that the `.dockerignore` actually keeps env files out of the build context (regressions silent).

## Files

- `.dockerignore`
- `.gitignore`
- `.github/workflows/security.yml` (extend, created in `sec-infra-08`)

## Tasks

### Task 1: Broaden `.dockerignore` to cover all env-file flavors

- [ ] **Step 1: Write verification check.**
  ```bash
  cat .dockerignore
  ```
- [ ] **Step 2: Run** — confirm only `.env`, `.env.dev`, `.env.prod` are listed.
- [ ] **Step 3: Apply fix.** Replace lines 3–5 of `.dockerignore` with a glob pattern:
  ```
   node_modules
   dist
  -.env
  -.env.dev
  -.env.prod
  +.env
  +.env.*
  +!.env.example
   .git
  ```
- [ ] **Step 4: Verify.** Build context test:
  ```bash
  printf 'SECRET=should-not-leak\n' > .env.local
  docker build --target deps -t fluxcore-ignore-test . > /tmp/build.log 2>&1
  docker run --rm fluxcore-ignore-test sh -c 'ls /app/.env* 2>&1 || echo NO_ENV_FILES'
  rm .env.local
  ```
  Expect `NO_ENV_FILES` and the build log NOT to mention `.env.local`.
- [ ] **Step 5: Commit.** `fix(docker): expand .dockerignore env-file glob to cover all variants`

### Task 2: Mirror the pattern in `.gitignore`

- [ ] **Step 1: Write verification check.**
  ```bash
  grep -n '^\.env' .gitignore 2>&1
  ```
- [ ] **Step 2: Run** — note current state (likely lists `.env`, `.env.dev`, `.env.prod`).
- [ ] **Step 3: Apply fix.** Ensure `.gitignore` contains:
  ```
  .env
  .env.*
  !.env.example
  ```
  Edit in place if those exact lines are missing.
- [ ] **Step 4: Verify.**
  ```bash
  touch .env.dev .env.prod .env.local
  git status --porcelain | grep -E '\.env\.(dev|prod|local)' && echo LEAK || echo OK
  rm .env.dev .env.prod .env.local
  ```
  Expect `OK`.
- [ ] **Step 5: Commit.** `fix(git): use .env.* glob with .env.example exception`

### Task 3: CI guard against committed env files

- [ ] **Step 1: Write verification check.** Examine the worktree for tracked env files:
  ```bash
  git ls-files | grep -E '^\.env(\..+)?$' | grep -v '^\.env\.example$' || echo CLEAN
  ```
- [ ] **Step 2: Run** — expect `CLEAN`.
- [ ] **Step 3: Apply fix.** Add a job to `.github/workflows/security.yml`:
  ```yaml
    no-env-files:
      name: no env files in repo
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - name: Assert no .env files are tracked
          run: |
            tracked=$(git ls-files | grep -E '^\.env(\..+)?$' | grep -v '^\.env\.example$' || true)
            if [ -n "$tracked" ]; then
              echo "::error::These env files must not be committed:"
              echo "$tracked"
              exit 1
            fi
        - name: Assert .dockerignore covers env files
          run: |
            grep -qE '^\.env\*?$|^\.env\.\*$' .dockerignore || {
              echo "::error::.dockerignore must include '.env' and '.env.*'"
              exit 1
            }
  ```
- [ ] **Step 4: Verify.** YAML lint and a dry test by creating a fixture in a throwaway branch:
  ```bash
  python3 -c 'import yaml; yaml.safe_load(open(".github/workflows/security.yml"))' && echo OK
  ```
- [ ] **Step 5: Commit.** `ci(security): block committed env files and verify .dockerignore coverage`

### Task 4: Local pre-commit safety net (optional)

- [ ] **Step 1: Write verification check.** `ls .git/hooks/pre-commit 2>&1` — likely missing.
- [ ] **Step 2: Run** above.
- [ ] **Step 3: Apply fix.** Add a documented hook snippet to `docs/development.md` (or wherever local-dev docs live) so devs can opt in:
  ```bash
  cat > .git/hooks/pre-commit <<'EOF'
  #!/bin/sh
  if git diff --cached --name-only | grep -E '^\.env(\..+)?$' | grep -v '^\.env\.example$'; then
    echo "Refusing to commit .env files. Use .env.example for documented placeholders."
    exit 1
  fi
  EOF
  chmod +x .git/hooks/pre-commit
  ```
  Do NOT install this automatically — just document.
- [ ] **Step 4: Verify.** Manual: try `git commit` with a staged `.env.local` and confirm rejection.
- [ ] **Step 5: Commit.** `docs(dev): document optional pre-commit env-file guard`
