# OAuth Open Redirect via x-forwarded-host — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** HIGH
**Goal:** Build the OAuth callback URL from a trusted, server-configured `DASHBOARD_PUBLIC_URL` instead of attacker-controllable proxy headers.
**Architecture:** Add `dashboardPublicUrl` to `@fluxcore/config` (required in production, defaulted in dev). Replace the header-derived `origin` in both `/auth/login` and `/auth/callback` with this trusted value, so the registered OAuth callback can never be redirected to an attacker host.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/auth/routes.ts:21-37` and `:62-66` build `origin` from `request.headers["x-forwarded-proto"]` and `request.headers["x-forwarded-host"]`. These headers are set by any upstream client when Fastify is not configured with `trustProxy`, allowing an attacker to make `/auth/login` issue a Discord authorization URL whose `redirect_uri` points at `https://evil.example/auth/callback`. Once a victim follows the link, Discord will redirect their `code` to the attacker (provided the attacker registered the URL with Discord, or in the case of phishing — to a look-alike host).

## Files
- Modify: `packages/config/src/index.ts` (add `dashboardPublicUrl`)
- Modify: `apps/dashboard/src/server/features/auth/routes.ts:21-37`, `:62-66`
- Test: `apps/dashboard/tests/server/features/auth/routes.test.ts` (extend or create)

## Tasks

### Task 1: Add DASHBOARD_PUBLIC_URL to config

- [ ] **Step 1: Write the failing test**

Add to `packages/config/tests/index.test.ts`:

```typescript
describe("loadConfig — DASHBOARD_PUBLIC_URL", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.DISCORD_TOKEN = "t";
    process.env.CLIENT_ID = "c";
    process.env.DASHBOARD_SESSION_SECRET = "x".repeat(64);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.resetModules();
  });

  it("throws in production when DASHBOARD_PUBLIC_URL is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DASHBOARD_PUBLIC_URL;
    await expect(import("../src/index.js")).rejects.toThrow(
      /DASHBOARD_PUBLIC_URL/,
    );
  });

  it("rejects DASHBOARD_PUBLIC_URL without https in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DASHBOARD_PUBLIC_URL = "http://example.com";
    await expect(import("../src/index.js")).rejects.toThrow(/https/);
  });

  it("accepts a valid https URL", async () => {
    process.env.NODE_ENV = "production";
    process.env.DASHBOARD_PUBLIC_URL = "https://dash.example.com";
    const mod = await import("../src/index.js");
    expect(mod.config.dashboardPublicUrl).toBe("https://dash.example.com");
  });

  it("defaults to http://localhost:PORT in development", async () => {
    process.env.NODE_ENV = "development";
    process.env.DASHBOARD_PORT = "3000";
    delete process.env.DASHBOARD_PUBLIC_URL;
    const mod = await import("../src/index.js");
    expect(mod.config.dashboardPublicUrl).toBe("http://localhost:3000");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fluxcore/config test`
Expected: FAIL — `dashboardPublicUrl` is not defined on `Config`.

- [ ] **Step 3: Implement fix**

In `packages/config/src/index.ts`, add `dashboardPublicUrl: string;` to the `Config` interface and inside `loadConfig()`:

```typescript
  const isProduction = process.env.NODE_ENV === "production";
  const rawPublicUrl = process.env.DASHBOARD_PUBLIC_URL;
  let dashboardPublicUrl: string;
  if (rawPublicUrl) {
    let parsed: URL;
    try {
      parsed = new URL(rawPublicUrl);
    } catch {
      throw new Error(
        `Invalid DASHBOARD_PUBLIC_URL: "${rawPublicUrl}" is not a valid URL`,
      );
    }
    if (isProduction && parsed.protocol !== "https:") {
      throw new Error(
        "DASHBOARD_PUBLIC_URL must use https:// in production",
      );
    }
    // Strip trailing slash for predictable concatenation
    dashboardPublicUrl = rawPublicUrl.replace(/\/$/, "");
  } else if (isProduction) {
    throw new Error(
      "DASHBOARD_PUBLIC_URL is required in production (e.g. https://dashboard.example.com)",
    );
  } else {
    dashboardPublicUrl = `http://localhost:${dashboardPort}`;
  }
```

Add `dashboardPublicUrl` to the returned config object.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fluxcore/config test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/config/src/index.ts packages/config/tests/index.test.ts
git commit -m "feat(config): add DASHBOARD_PUBLIC_URL trusted origin"
```

### Task 2: Use dashboardPublicUrl in auth routes

- [ ] **Step 1: Write the failing test**

Create or extend `apps/dashboard/tests/server/features/auth/routes.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";

vi.mock("@fluxcore/config", () => ({
  config: {
    dashboardClientSecret: "secret",
    dashboardSessionSecret: "x".repeat(64),
    dashboardPublicUrl: "https://dash.example.com",
    clientId: "client-id",
  },
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../../../src/server/shared/auth.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../src/server/shared/auth.js")
  >("../../../../src/server/shared/auth.js");
  return {
    ...actual,
    getAuthorizationUrl: vi.fn((callbackUrl: string) => ({
      url: `https://discord.com/oauth2/authorize?redirect_uri=${encodeURIComponent(callbackUrl)}`,
      state: "state-123",
    })),
  };
});

import { registerAuthRoutes } from "../../../../src/server/features/auth/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "x".repeat(64) });
  registerAuthRoutes(app);
  return app;
}

describe("/auth/login redirect_uri", () => {
  it("ignores x-forwarded-host and uses DASHBOARD_PUBLIC_URL", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/auth/login",
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "evil.example.com",
      },
    });
    expect(res.statusCode).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain(
      encodeURIComponent("https://dash.example.com/auth/callback"),
    );
    expect(location).not.toContain("evil.example.com");
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/dashboard/tests/server/features/auth/routes.test.ts`
Expected: FAIL — current code constructs origin from `x-forwarded-host`, so the callback contains `evil.example.com`.

- [ ] **Step 3: Implement fix**

Edit `apps/dashboard/src/server/features/auth/routes.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { config } from "@fluxcore/config";
import {
  buildCallbackUrl,
  getAuthorizationUrl,
  exchangeCode,
  fetchUser,
  fetchGuilds,
} from "../../shared/auth.js";
import { createSession, deleteSession, getSession } from "../../shared/session.js";
import { logger } from "@fluxcore/utils";

const isProduction = process.env.NODE_ENV === "production";

const authRateLimit = {
  config: {
    rateLimit: { max: 10, timeWindow: "1 minute" },
  },
};

export function registerAuthRoutes(app: FastifyInstance): void {
  app.get("/auth/login", { ...authRateLimit }, async (_request, reply) => {
    const callbackUrl = buildCallbackUrl(config.dashboardPublicUrl);
    const { url, state } = getAuthorizationUrl(callbackUrl);
    reply
      .setCookie("oauth_state", state, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        signed: true,
        maxAge: 300,
      })
      .redirect(url);
  });
```

Replace the equivalent block at lines 62-66 in the callback handler with:

```typescript
      const callbackUrl = buildCallbackUrl(config.dashboardPublicUrl);
      const token = await exchangeCode(code, callbackUrl);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/dashboard/tests/server/features/auth/routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/auth/routes.ts apps/dashboard/tests/server/features/auth/routes.test.ts
git commit -m "fix(security): use trusted DASHBOARD_PUBLIC_URL for OAuth callback"
```
