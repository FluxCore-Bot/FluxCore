# Lavalink Hardcoded Password — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** CRITICAL
**Goal:** Eliminate the hardcoded `youshallnotpass` Lavalink password from every committed file. Require `LAVALINK_PASSWORD` to be supplied via environment, both for the Lavalink server config and for all healthchecks/clients that authenticate against it.
**Architecture:** Lavalink reads `application.yml` directly. Spring Boot config supports `${ENV_VAR}` substitution natively, so the YAML can reference an env var the container sees. Healthchecks use `wget --header=Authorization` and must read the same env var.
**Tech Stack:** Docker, docker-compose, Caddy, PostgreSQL, Lavalink, Vite

---

## Vulnerability

`youshallnotpass` is the well-known default Lavalink password and is currently hardcoded in:

- `lavalink/application.yml:25` — `password: "youshallnotpass"`
- `docker-compose.yml:32` — healthcheck header `Authorization: youshallnotpass`
- `docker-compose.yml:122` — preview-lavalink healthcheck same string
- `docker-compose.prod.yml:32` — `LAVALINK_SERVER_PASSWORD=${LAVALINK_PASSWORD:-youshallnotpass}` (default falls back)
- `docker-compose.prod.yml:34` — healthcheck header `Authorization: youshallnotpass`
- `.env.example:47` — `LAVALINK_PASSWORD=youshallnotpass`
- `packages/config/src/index.ts:59` — `process.env.LAVALINK_PASSWORD || "youshallnotpass"`

Anyone running FluxCore who forgets to override the password is exposing an unauthenticated audio gateway. Even when overridden in dev, the healthchecks still use the literal string and would fail silently — meaning real deployments must currently keep the default.

Note: `lavalink/application.yml:17` also contains a real-looking YouTube OAuth refresh token that should be rotated separately; this plan does not cover that, but the implementer MUST flag it during PR review.

## Files

- `lavalink/application.yml`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `.env.example`
- `packages/config/src/index.ts`

## Tasks

### Task 1: Make `application.yml` read the password from the environment

- [ ] **Step 1: Write verification check.** Confirm the literal string is present today:
  ```bash
  grep -n 'youshallnotpass' lavalink/application.yml
  ```
- [ ] **Step 2: Run** — expect line 25 to print `    password: "youshallnotpass"`.
- [ ] **Step 3: Apply fix.** Replace line 25 with a Spring Boot env-var reference (no default — Spring will fail to start if missing):
  ```yaml
  -    password: "youshallnotpass"
  +    password: ${LAVALINK_SERVER_PASSWORD}
  ```
- [ ] **Step 4: Verify.** `grep -n 'youshallnotpass' lavalink/application.yml` must print nothing, and `grep -n 'LAVALINK_SERVER_PASSWORD' lavalink/application.yml` must show line 25.
- [ ] **Step 5: Commit.** `fix(lavalink): require LAVALINK_SERVER_PASSWORD env var in application.yml`

### Task 2: Pass the password to the dev Lavalink container and parameterise its healthcheck

- [ ] **Step 1: Write verification check.**
  ```bash
  grep -n 'youshallnotpass' docker-compose.yml
  ```
- [ ] **Step 2: Run** — expect lines 32 and 122 to print the literal.
- [ ] **Step 3: Apply fix.** Edit `docker-compose.yml` Lavalink service (lines 25–41) and preview-lavalink (115–130):
  ```yaml
   lavalink:
     image: ghcr.io/lavalink-devs/lavalink:4
     volumes:
       - ./lavalink/application.yml:/opt/Lavalink/application.yml:ro
     environment:
       - _JAVA_OPTIONS=-Xmx128m
  +    - LAVALINK_SERVER_PASSWORD=${LAVALINK_PASSWORD:?LAVALINK_PASSWORD is required}
     healthcheck:
  -    test: ["CMD-SHELL", "wget -qO- --header='Authorization: youshallnotpass' http://localhost:2333/version || exit 1"]
  +    test: ["CMD-SHELL", "wget -qO- --header=\"Authorization: ${LAVALINK_SERVER_PASSWORD}\" http://localhost:2333/version || exit 1"]
  ```
  Apply the identical change to the `preview-lavalink` block.
- [ ] **Step 4: Verify.**
  ```bash
  grep -n 'youshallnotpass' docker-compose.yml   # must be empty
  LAVALINK_PASSWORD=test-pw docker compose -f docker-compose.yml config | grep -A2 lavalink | grep LAVALINK_SERVER_PASSWORD
  ```
  Second command must show `LAVALINK_SERVER_PASSWORD: test-pw`.
- [ ] **Step 5: Commit.** `fix(docker): require LAVALINK_PASSWORD for dev/preview lavalink and parameterise healthcheck`

### Task 3: Remove the production fallback default and parameterise its healthcheck

- [ ] **Step 1: Write verification check.**
  ```bash
  grep -n 'youshallnotpass' docker-compose.prod.yml
  ```
- [ ] **Step 2: Run** — expect lines 32 and 34 to print.
- [ ] **Step 3: Apply fix.** Edit `docker-compose.prod.yml` lavalink block (lines 26–47):
  ```yaml
     environment:
       - _JAVA_OPTIONS=-Xmx256m
  -    - LAVALINK_SERVER_PASSWORD=${LAVALINK_PASSWORD:-youshallnotpass}
  +    - LAVALINK_SERVER_PASSWORD=${LAVALINK_PASSWORD:?LAVALINK_PASSWORD is required}
     healthcheck:
  -    test: ["CMD-SHELL", "wget -qO- --header='Authorization: youshallnotpass' http://localhost:2333/version || exit 1"]
  +    test: ["CMD-SHELL", "wget -qO- --header=\"Authorization: ${LAVALINK_SERVER_PASSWORD}\" http://localhost:2333/version || exit 1"]
  ```
- [ ] **Step 4: Verify.**
  ```bash
  grep -n 'youshallnotpass' docker-compose.prod.yml   # must be empty
  unset LAVALINK_PASSWORD; docker compose -f docker-compose.prod.yml config 2>&1 | grep -i 'LAVALINK_PASSWORD is required'
  ```
  Second command must print the error (proves the `:?` guard fires when missing).
- [ ] **Step 5: Commit.** `fix(docker): drop default lavalink password in prod compose`

### Task 4: Remove the hardcoded fallback in `packages/config`

- [ ] **Step 1: Write verification check.** Add a Vitest case to `packages/config/tests/index.test.ts` (create file if missing):
  ```typescript
  import { describe, it, expect, beforeEach, vi } from "vitest";

  describe("lavalink password", () => {
    beforeEach(() => {
      vi.resetModules();
      process.env.DISCORD_TOKEN = "x";
      process.env.CLIENT_ID = "y";
    });

    it("throws when LAVALINK_PASSWORD is unset", async () => {
      delete process.env.LAVALINK_PASSWORD;
      await expect(import("../src/index")).rejects.toThrow(/LAVALINK_PASSWORD/);
    });

    it("uses the env value when present", async () => {
      process.env.LAVALINK_PASSWORD = "from-env";
      const { config } = await import("../src/index");
      expect(config.lavalinkPassword).toBe("from-env");
    });
  });
  ```
- [ ] **Step 2: Run** `pnpm --filter @fluxcore/config test` — expect failure (current code falls back to `youshallnotpass`).
- [ ] **Step 3: Apply fix.** Edit `packages/config/src/index.ts:59`:
  ```typescript
  -  const lavalinkPassword = process.env.LAVALINK_PASSWORD || "youshallnotpass";
  +  const lavalinkPassword = process.env.LAVALINK_PASSWORD;
  +  if (!lavalinkPassword) {
  +    throw new Error("Missing required environment variable: LAVALINK_PASSWORD");
  +  }
  ```
- [ ] **Step 4: Verify.** `pnpm --filter @fluxcore/config test` passes; `pnpm typecheck` passes.
- [ ] **Step 5: Commit.** `fix(config): require LAVALINK_PASSWORD instead of falling back to default`

### Task 5: End-to-end smoke test

- [ ] **Step 1: Write verification check.** Spin up the bot profile with a real password:
  ```bash
  LAVALINK_PASSWORD=$(openssl rand -base64 32) docker compose --profile bot up -d lavalink
  docker compose ps lavalink
  docker compose logs lavalink | tail -50
  ```
- [ ] **Step 2: Run** — confirm container reports `healthy` within 60s and logs show `Started Lavalink` with no `youshallnotpass` reference.
- [ ] **Step 3: Apply fix.** (No-op — verification only.)
- [ ] **Step 4: Verify.** `docker compose --profile bot down`. Then run with the env var unset:
  ```bash
  unset LAVALINK_PASSWORD; docker compose --profile bot config 2>&1 | grep -i required
  ```
  Must print the `LAVALINK_PASSWORD is required` error from the `:?` guard.
- [ ] **Step 5: Commit.** No commit needed if Tasks 1–4 are clean. Otherwise create `fix(lavalink): smoke-test follow-up` with any tweaks.
