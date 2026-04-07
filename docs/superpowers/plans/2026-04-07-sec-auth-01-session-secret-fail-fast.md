# Session Secret Per-Process Fallback — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** CRITICAL
**Goal:** Hard-fail at config load when `DASHBOARD_SESSION_SECRET` is missing in production; warn (and generate ephemeral) in development.
**Architecture:** Move the production guard from `apps/dashboard/src/server/index.ts` (which fires after `config` is already loaded with a random value) into `loadConfig()` itself, so `config.dashboardSessionSecret` is never silently randomized in production. Multi-process deployments will then refuse to boot rather than diverge in cookie-signing keys.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`packages/config/src/index.ts:48-50` reads `DASHBOARD_SESSION_SECRET` from env and falls back to `randomBytes(32).toString("hex")` per process. In multi-instance production deployments each process generates its own secret, so cookies signed by one instance fail validation on another (DoS / forced re-login storms). Even on a single instance, the secret rotates on every restart, invalidating all live sessions.

## Files
- Modify: `packages/config/src/index.ts:48-50`
- Test: `packages/config/tests/index.test.ts` (new file)

## Tasks

### Task 1: Fail-fast in production, warn in dev

- [ ] **Step 1: Write the failing test**

Create `packages/config/tests/index.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("loadConfig — DASHBOARD_SESSION_SECRET", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.DISCORD_TOKEN = "test-token";
    process.env.CLIENT_ID = "test-client-id";
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.resetModules();
  });

  it("throws in production when DASHBOARD_SESSION_SECRET is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DASHBOARD_SESSION_SECRET;
    await expect(import("../src/index.js")).rejects.toThrow(
      /DASHBOARD_SESSION_SECRET/,
    );
  });

  it("uses provided DASHBOARD_SESSION_SECRET in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DASHBOARD_SESSION_SECRET = "a".repeat(64);
    const mod = await import("../src/index.js");
    expect(mod.config.dashboardSessionSecret).toBe("a".repeat(64));
  });

  it("generates an ephemeral secret in development with a warning", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.DASHBOARD_SESSION_SECRET;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import("../src/index.js");
    expect(mod.config.dashboardSessionSecret).toMatch(/^[0-9a-f]{64}$/);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("DASHBOARD_SESSION_SECRET"),
    );
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fluxcore/config test`
Expected: FAIL — production case currently does not throw (config silently generates a random secret).

- [ ] **Step 3: Implement fix**

Edit `packages/config/src/index.ts` lines 48-50:

```typescript
  const dashboardSessionSecret = process.env.DASHBOARD_SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";
  let resolvedSessionSecret: string;
  if (dashboardSessionSecret && dashboardSessionSecret.length >= 32) {
    resolvedSessionSecret = dashboardSessionSecret;
  } else if (isProduction) {
    throw new Error(
      "DASHBOARD_SESSION_SECRET is required in production and must be at least 32 characters. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  } else {
    resolvedSessionSecret = randomBytes(32).toString("hex");
    console.warn(
      "[config] DASHBOARD_SESSION_SECRET not set — generated an ephemeral secret for development. " +
        "All sessions will be invalidated on restart.",
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fluxcore/config test`
Expected: PASS (all 3 cases).

Also verify the dashboard server still typechecks: `pnpm typecheck`.

- [ ] **Step 5: Commit**

```bash
git add packages/config/src/index.ts packages/config/tests/index.test.ts
git commit -m "fix(security): hard-fail in production when DASHBOARD_SESSION_SECRET missing"
```
