# CI Security Scanning Workflow — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** HIGH (because nothing currently blocks regressions)
**Goal:** Add a GitHub Actions workflow that runs on every PR and on pushes to `main` and fails the build if (a) `pnpm audit` reports a HIGH/CRITICAL advisory, (b) gitleaks finds a secret, or (c) Trivy finds a HIGH/CRITICAL vulnerability in either of the production container images.
**Architecture:** A single workflow file `.github/workflows/security.yml` with three parallel jobs. The Trivy job builds the bot and dashboard images using the existing multi-stage Dockerfile (`production-bot`, `production-dashboard`).
**Tech Stack:** Docker, docker-compose, Caddy, PostgreSQL, Lavalink, Vite

---

## Vulnerability

There is no automated security scanning. Without CI gates:

- A new dependency with a known CVE merges silently.
- A developer accidentally commits a real Discord token, OAuth refresh token (note: `lavalink/application.yml` already contains a real-looking YouTube refresh token), or `.env.prod`.
- Container base image drift introduces critical OS-level CVEs that ship to production.

The other 11 plans in this batch fix point-in-time issues; this plan ensures regressions are caught.

## Files

- `.github/workflows/security.yml` (CREATE)

## Tasks

### Task 1: Create the security workflow

- [ ] **Step 1: Write verification check.**
  ```bash
  ls .github/workflows/security.yml 2>&1
  ```
- [ ] **Step 2: Run** — expect "No such file or directory".
- [ ] **Step 3: Apply fix.** Create `.github/workflows/security.yml`:
  ```yaml
  name: Security

  on:
    push:
      branches: [main]
    pull_request:
    schedule:
      - cron: "0 6 * * 1"  # Mondays 06:00 UTC

  permissions:
    contents: read
    security-events: write

  jobs:
    pnpm-audit:
      name: pnpm audit (high+)
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v4
          with:
            version: 10.28.0
        - uses: actions/setup-node@v4
          with:
            node-version: 22
            cache: pnpm
        - run: pnpm install --frozen-lockfile
        - name: Audit (fail on high or critical)
          run: pnpm audit --audit-level=high

    gitleaks:
      name: gitleaks
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
          with:
            fetch-depth: 0
        - name: Run gitleaks
          uses: gitleaks/gitleaks-action@v2
          env:
            GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
            GITLEAKS_ENABLE_UPLOAD_ARTIFACT: true

    trivy-bot:
      name: trivy (bot image)
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - name: Build bot image
          run: docker build --target production-bot -t fluxcore-bot:ci .
        - name: Trivy scan
          uses: aquasecurity/trivy-action@0.28.0
          with:
            image-ref: fluxcore-bot:ci
            severity: HIGH,CRITICAL
            exit-code: "1"
            ignore-unfixed: true
            vuln-type: os,library
            format: sarif
            output: trivy-bot.sarif
        - name: Upload SARIF
          if: always()
          uses: github/codeql-action/upload-sarif@v3
          with:
            sarif_file: trivy-bot.sarif
            category: trivy-bot

    trivy-dashboard:
      name: trivy (dashboard image)
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - name: Build dashboard image
          run: docker build --target production-dashboard -t fluxcore-dashboard:ci .
        - name: Trivy scan
          uses: aquasecurity/trivy-action@0.28.0
          with:
            image-ref: fluxcore-dashboard:ci
            severity: HIGH,CRITICAL
            exit-code: "1"
            ignore-unfixed: true
            vuln-type: os,library
            format: sarif
            output: trivy-dashboard.sarif
        - name: Upload SARIF
          if: always()
          uses: github/codeql-action/upload-sarif@v3
          with:
            sarif_file: trivy-dashboard.sarif
            category: trivy-dashboard

    trivy-fs:
      name: trivy (filesystem & config)
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - name: Trivy filesystem scan (config, IaC, secrets)
          uses: aquasecurity/trivy-action@0.28.0
          with:
            scan-type: fs
            scan-ref: .
            severity: HIGH,CRITICAL
            exit-code: "1"
            ignore-unfixed: true
            scanners: vuln,secret,config
  ```
- [ ] **Step 4: Verify.**
  ```bash
  cat .github/workflows/security.yml | head -5
  # YAML syntax check
  python3 -c 'import yaml,sys; yaml.safe_load(open(".github/workflows/security.yml"))' && echo OK
  # actionlint if available
  command -v actionlint && actionlint .github/workflows/security.yml || echo "actionlint not installed (optional)"
  ```
- [ ] **Step 5: Commit.** `ci(security): add pnpm audit, gitleaks, and Trivy scanning workflow`

### Task 2: Triage the first run

- [ ] **Step 1: Write verification check.** Push the branch and open the PR; watch the Security workflow.
- [ ] **Step 2: Run** — expect at least one job to fail initially (gitleaks should flag the YouTube refresh token in `lavalink/application.yml:17`, and Trivy on the lavalink-pinned plugin sha may flag advisories).
- [ ] **Step 3: Apply fix.** For each finding:
  - Real leaked credential (YouTube refresh token) → rotate it externally, then either remove from the file or move to a Docker secret.
  - False positive → add to `.gitleaks.toml` allowlist with a justifying comment.
  - HIGH dep advisory → upgrade or add `audit-ci`-style allowlist with expiry.
- [ ] **Step 4: Verify.** Re-run the workflow until all four jobs are green.
- [ ] **Step 5: Commit.** `fix(security): address initial CI scan findings` (one commit per logical fix).

### Task 3: Add a baseline `.gitleaks.toml`

- [ ] **Step 1: Write verification check.** `ls .gitleaks.toml 2>&1` — expect missing.
- [ ] **Step 2: Run** above.
- [ ] **Step 3: Apply fix.** Create `.gitleaks.toml`:
  ```toml
  title = "FluxCore gitleaks config"

  [extend]
  useDefault = true

  [allowlist]
  description = "Test fixtures and example placeholders"
  paths = [
    '''.*\.test\.(ts|js)$''',
    '''packages/systems/tests/.*''',
    '''docs/.*''',
    '''\.env\.example$''',
  ]
  ```
- [ ] **Step 4: Verify.** Re-run the gitleaks job; allowlisted files no longer trigger.
- [ ] **Step 5: Commit.** `ci(security): add gitleaks allowlist for test fixtures and docs`
