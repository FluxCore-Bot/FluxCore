# Image Preview X-Content-Type-Options nosniff — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** LOW
**Goal:** Ensure browsers do not MIME-sniff the welcome image preview response, eliminating the residual XSS-via-content-sniffing risk if a future bug allowed non-PNG bytes to be served from the preview endpoint.
**Architecture:** Add the `X-Content-Type-Options: nosniff` header to the reply chain in the POST `/welcome/image/preview` route. This is a one-line defense-in-depth fix.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/welcome/routes.ts:183-186` sets `Content-Type: image/png` and `Cache-Control: no-cache` but omits `X-Content-Type-Options: nosniff`. If a future bug ever caused `imageBuffer` to contain HTML or SVG, browsers might sniff and execute it. Adding `nosniff` is a cheap defense-in-depth control.

## Files
- Modify: `apps/dashboard/src/server/features/welcome/routes.ts:183-186`
- Test: `apps/dashboard/tests/server/features/welcome/imagePreviewHeaders.test.ts` (new file)

## Tasks

### Task 1: Add nosniff header to image preview

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/features/welcome/imagePreviewHeaders.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", dashboardSessionSecret: "s", logLevel: "info" },
}));

const session = {
  userId: "user-1",
  username: "u",
  avatar: null,
  guilds: [{ id: "guild-1", name: "T", permissions: BigInt(0x20).toString() }],
};

vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: vi.fn().mockResolvedValue(session),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: vi.fn().mockResolvedValue(true),
  getGuildOwnerId: vi.fn().mockResolvedValue("owner-1"),
}));
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: vi.fn().mockResolvedValue({ permissions: new Set(["*"]), isOwner: true }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@fluxcore/systems/welcome/image", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@fluxcore/systems/welcome/image");
  return {
    ...actual,
    createStorageAdapter: () => ({
      upload: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }),
    welcomeImageSettingsSchema: { safeParse: () => ({ success: true, data: {} }) },
    DEFAULT_WELCOME_IMAGE_SETTINGS: {},
    DEFAULT_FAREWELL_IMAGE_SETTINGS: {},
    MAX_BACKGROUND_SIZE: 5 * 1024 * 1024,
    ALLOWED_BACKGROUND_TYPES: ["image/png"],
    PRESET_BACKGROUNDS: [],
    generateWelcomeImage: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    getAllTemplates: () => [],
    getAvailableFonts: () => [],
  };
});
vi.mock("@fluxcore/systems/welcome/config", () => ({
  getWelcomeConfig: vi.fn(),
  upsertWelcomeConfig: vi.fn(),
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerWelcomeRoutes } from "../../../../src/server/features/welcome/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerWelcomeRoutes(app);
  await app.ready();
  return app;
}

describe("POST /welcome/image/preview — security headers", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/welcome/image/preview",
      cookies: { session: app.signCookie("valid") },
      payload: { settings: {}, type: "welcome" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
pnpm --filter @fluxcore/dashboard test -- imagePreviewHeaders
```

Expected: header is `undefined`, test FAILS.

- [ ] **Step 3: Implement the fix**

Edit `apps/dashboard/src/server/features/welcome/routes.ts` lines 183-186 — add the nosniff header:

```typescript
      reply
        .header("Content-Type", "image/png")
        .header("Cache-Control", "no-cache")
        .header("X-Content-Type-Options", "nosniff")
        .send(imageBuffer);
```

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm --filter @fluxcore/dashboard test -- imagePreviewHeaders
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/welcome/routes.ts apps/dashboard/tests/server/features/welcome/imagePreviewHeaders.test.ts
git commit -m "fix(welcome): add X-Content-Type-Options nosniff to image preview"
```
