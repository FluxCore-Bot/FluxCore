# Vite Dev Server Binds 0.0.0.0 — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** LOW
**Goal:** Default the Vite dev server to `127.0.0.1`. Only bind to `0.0.0.0` when an explicit `VITE_HOST=0.0.0.0` env var is set (needed for Docker, where the container's loopback isn't reachable from the host).
**Architecture:** Vite's `server.host` accepts a string. Inside the dashboard Docker container we already control the env (`docker-compose.yml`), so we can set `VITE_HOST=0.0.0.0` only there. Developers running Vite on the host bare-metal then get safe `127.0.0.1` by default.
**Tech Stack:** Docker, docker-compose, Caddy, PostgreSQL, Lavalink, Vite

---

## Vulnerability

`apps/dashboard/vite.config.ts:21` hardcodes `host: "0.0.0.0"`. When a developer runs `pnpm --filter @fluxcore/dashboard dev` directly on their laptop (not via the docker compose stack), the Vite dev server is reachable from any other host on the network. The dev server includes:

- Source maps and full source tree
- HMR websocket that can run arbitrary plugin code in some Vite advisories
- The `/api` proxy that forwards to the local Fastify on port 3000 (which may be running with dev session secrets)

This is a hostile-network exposure. Defaulting to loopback removes the risk while preserving the Docker workflow via an opt-in env var.

## Files

- `apps/dashboard/vite.config.ts`
- `docker-compose.yml` (dashboard service)

## Tasks

### Task 1: Default Vite to loopback, opt-in to all-interfaces

- [ ] **Step 1: Write verification test.** Add `apps/dashboard/tests/vite-config.test.ts`:
  ```typescript
  import { describe, it, expect, beforeEach } from "vitest";

  async function loadConfig() {
    // vite.config.ts uses defineConfig which returns the object directly
    const mod = await import("../vite.config");
    return mod.default as { server: { host: string } };
  }

  describe("vite.config server.host", () => {
    beforeEach(() => {
      delete process.env.VITE_HOST;
      // bust import cache
      const key = require.resolve("../vite.config");
      delete require.cache?.[key];
    });

    it("defaults to 127.0.0.1", async () => {
      const cfg = await loadConfig();
      expect(cfg.server.host).toBe("127.0.0.1");
    });

    it("uses VITE_HOST when set", async () => {
      process.env.VITE_HOST = "0.0.0.0";
      const cfg = await loadConfig();
      expect(cfg.server.host).toBe("0.0.0.0");
    });
  });
  ```
- [ ] **Step 2: Run** `pnpm --filter @fluxcore/dashboard test vite-config` — expect failure (current host is `0.0.0.0`).
- [ ] **Step 3: Apply fix.** Edit `apps/dashboard/vite.config.ts:19–22`:
  ```typescript
  -  server: {
  -    port: 5173,
  -    host: "0.0.0.0",
  +  server: {
  +    port: 5173,
  +    host: process.env.VITE_HOST || "127.0.0.1",
  ```
- [ ] **Step 4: Verify.** `pnpm --filter @fluxcore/dashboard test vite-config` passes.
- [ ] **Step 5: Commit.** `fix(dashboard): default Vite dev server to 127.0.0.1, opt in via VITE_HOST`

### Task 2: Set `VITE_HOST=0.0.0.0` inside the docker compose dashboard service

- [ ] **Step 1: Write verification check.**
  ```bash
  grep -n VITE_HOST docker-compose.yml
  ```
- [ ] **Step 2: Run** — expect no match.
- [ ] **Step 3: Apply fix.** Edit `docker-compose.yml` dashboard service (lines 43–65) and preview-dashboard (lines 92–113), adding to each `environment:` block (create the block if absent):
  ```yaml
     dashboard:
       build:
         context: .
         target: development
       command: sh -c "pnpm install --frozen-lockfile && pnpm turbo run dev --filter=@fluxcore/dashboard"
  +    environment:
  +      VITE_HOST: "0.0.0.0"
       volumes:
         - ./packages:/app/packages
         - ./apps:/app/apps
         - ./turbo.json:/app/turbo.json
       ports:
         - "3000:3000"
         - "5173:5173"
       env_file:
         - .env.dev
  ```
- [ ] **Step 4: Verify.**
  ```bash
  docker compose --profile dashboard config | grep -A1 VITE_HOST
  ```
  Expect `VITE_HOST: 0.0.0.0` under the dashboard service.
- [ ] **Step 5: Commit.** `fix(docker): set VITE_HOST=0.0.0.0 inside dashboard container`

### Task 3: Smoke test loopback default

- [ ] **Step 1: Write verification check.** Run Vite directly on the host and confirm it binds loopback:
  ```bash
  cd apps/dashboard
  timeout 8 pnpm exec vite --port 5173 &
  sleep 4
  ss -tlnp | grep ':5173 '
  ```
- [ ] **Step 2: Run** — expect `127.0.0.1:5173` (NOT `0.0.0.0:5173` or `*:5173`).
- [ ] **Step 3: Apply fix.** No-op.
- [ ] **Step 4: Verify.** `kill %1` and `ss -tlnp | grep 5173` (expect nothing).
- [ ] **Step 5: Commit.** No commit.
