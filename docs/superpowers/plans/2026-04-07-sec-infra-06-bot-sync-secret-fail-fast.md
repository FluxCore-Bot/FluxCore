# `BOT_SYNC_SECRET` Production Fail-Fast — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** MEDIUM
**Goal:** Make the bot ↔ dashboard cache-sync HMAC secret a hard requirement in production. Today it silently auto-generates if unset, which breaks every restart in two ways: (1) the dashboard and bot end up with different secrets and sync requests fail, (2) operators have no signal that they forgot to provision the secret.
**Architecture:** `packages/config/src/index.ts:53–54` calls `randomBytes(32).toString("hex")` when `BOT_SYNC_SECRET` is unset. This must throw in production. Coordinate with the auth-agent plan `2026-04-07-sec-auth-01-session-secret-fail-fast.md` which addresses `DASHBOARD_SESSION_SECRET` similarly — keep both fixes consistent (same error format, same NODE_ENV check).
**Tech Stack:** Docker, docker-compose, Caddy, PostgreSQL, Lavalink, Vite

---

## Vulnerability

`packages/config/src/index.ts:52–54`:

```typescript
const botSyncPort = Number(process.env.BOT_SYNC_PORT) || 3001;
const botSyncSecret =
  process.env.BOT_SYNC_SECRET || randomBytes(32).toString("hex");
```

Failure modes:

- **Split brain.** Bot container and dashboard container each generate a different random secret, so HMACs never validate. Cache-sync requests are silently rejected (dashboard config changes never propagate to the bot).
- **No signal.** Nothing is logged when the fallback fires; operators discover the problem only when a feature toggle "doesn't work."
- **Dev sloppiness in prod.** A `.env.prod` that simply omits the var ships happily, with no fail-closed behavior.

The dev story (auto-generate when missing) is fine and should remain.

## Files

- `packages/config/src/index.ts`
- `packages/config/tests/index.test.ts` (create or extend)

## Tasks

### Task 1: Add a failing Vitest case for prod-mode fail-fast

- [ ] **Step 1: Write verification test.** Create `packages/config/tests/bot-sync-secret.test.ts`:
  ```typescript
  import { describe, it, expect, beforeEach, vi } from "vitest";

  describe("BOT_SYNC_SECRET", () => {
    beforeEach(() => {
      vi.resetModules();
      process.env.DISCORD_TOKEN = "x";
      process.env.CLIENT_ID = "y";
      process.env.LAVALINK_PASSWORD = "z";
      delete process.env.BOT_SYNC_SECRET;
    });

    it("auto-generates in development", async () => {
      process.env.NODE_ENV = "development";
      const { config } = await import("../src/index");
      expect(config.botSyncSecret).toMatch(/^[0-9a-f]{64}$/);
    });

    it("throws in production when unset", async () => {
      process.env.NODE_ENV = "production";
      await expect(import("../src/index")).rejects.toThrow(/BOT_SYNC_SECRET/);
    });

    it("uses provided value in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.BOT_SYNC_SECRET = "a".repeat(64);
      const { config } = await import("../src/index");
      expect(config.botSyncSecret).toBe("a".repeat(64));
    });

    it("rejects too-short values in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.BOT_SYNC_SECRET = "tooshort";
      await expect(import("../src/index")).rejects.toThrow(/at least 32/);
    });
  });
  ```
- [ ] **Step 2: Run** `pnpm --filter @fluxcore/config test bot-sync-secret` — expect failures (current code doesn't throw and doesn't validate length).
- [ ] **Step 3: Apply fix.** Edit `packages/config/src/index.ts:52–54`:
  ```typescript
  -  const botSyncPort = Number(process.env.BOT_SYNC_PORT) || 3001;
  -  const botSyncSecret =
  -    process.env.BOT_SYNC_SECRET || randomBytes(32).toString("hex");
  +  const botSyncPort = Number(process.env.BOT_SYNC_PORT) || 3001;
  +  const isProd = process.env.NODE_ENV === "production";
  +  const rawBotSyncSecret = process.env.BOT_SYNC_SECRET;
  +  if (isProd) {
  +    if (!rawBotSyncSecret) {
  +      throw new Error(
  +        "BOT_SYNC_SECRET is required in production. Generate with: openssl rand -hex 32",
  +      );
  +    }
  +    if (rawBotSyncSecret.length < 32) {
  +      throw new Error(
  +        "BOT_SYNC_SECRET must be at least 32 characters in production",
  +      );
  +    }
  +  }
  +  const botSyncSecret =
  +    rawBotSyncSecret || randomBytes(32).toString("hex");
  ```
- [ ] **Step 4: Verify.** `pnpm --filter @fluxcore/config test` — all four cases green. `pnpm typecheck` clean.
- [ ] **Step 5: Commit.** `fix(config): require BOT_SYNC_SECRET in production with min length 32`

### Task 2: Cross-check the auth-agent's session-secret fix uses the same pattern

- [ ] **Step 1: Write verification check.**
  ```bash
  cat docs/superpowers/plans/2026-04-07-sec-auth-01-session-secret-fail-fast.md | grep -A2 'NODE_ENV'
  ```
- [ ] **Step 2: Run** — confirm the auth plan also keys off `process.env.NODE_ENV === "production"` and uses the same error message style. If they diverge, raise a comment in PR review so both PRs land with consistent UX.
- [ ] **Step 3: Apply fix.** No code change. If the auth plan diverges, file a one-line follow-up in the auth PR.
- [ ] **Step 4: Verify.** Both plan files mention `NODE_ENV === "production"` and `openssl rand -hex 32`.
- [ ] **Step 5: Commit.** No commit.

### Task 3: Update `.env.example` to flag the requirement

- [ ] **Step 1: Write verification check.** `grep -n BOT_SYNC_SECRET .env.example` — expect line 28 with empty value and a comment "generate a random string".
- [ ] **Step 2: Run** above command.
- [ ] **Step 3: Apply fix.** Edit `.env.example` lines 27–28:
  ```
  -# Shared secret for cache sync authentication (generate a random string)
  -BOT_SYNC_SECRET=
  +# Shared secret for cache sync authentication.
  +# REQUIRED in production (NODE_ENV=production); auto-generated in development.
  +# Must be at least 32 characters. Generate with: openssl rand -hex 32
  +BOT_SYNC_SECRET=
  ```
- [ ] **Step 4: Verify.** `grep -A3 BOT_SYNC_SECRET .env.example` shows the new comment.
- [ ] **Step 5: Commit.** `docs(env): document BOT_SYNC_SECRET production requirement`
