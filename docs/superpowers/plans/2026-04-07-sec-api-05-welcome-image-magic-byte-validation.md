# Welcome Image base64 / Magic-Byte Validation — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** HIGH
**Goal:** Reject welcome background uploads whose base64 payload, decoded bytes, or content-type/magic-byte combination is malformed or mismatched.
**Architecture:** Add a strict base64 character regex, decode with `Buffer.from(data, "base64")`, then sniff the first bytes to confirm a real PNG (`89 50 4E 47`) / JPEG (`FF D8 FF`) / WebP (`52 49 46 46 .. 57 45 42 50`) header. The detected format must match the claimed `contentType`. Reject otherwise.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/welcome/routes.ts:217-224` blindly trusts the supplied `data` and `contentType`. `Buffer.from(<garbage>, "base64")` produces a buffer of length 0+ from any string, so attackers can store arbitrary binary blobs (e.g. HTML, SVG with scripts, executables) under filenames like `xyz.png`. Combined with the lenient MIME check, a stored XSS or content-type-confusion attack against the storage backend / CDN is possible.

## Files
- Modify: `apps/dashboard/src/server/features/welcome/routes.ts:206-233`
- Test: `apps/dashboard/tests/server/features/welcome/imageUpload.test.ts` (new file)

## Tasks

### Task 1: Validate base64, decode, then verify magic bytes match contentType

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/features/welcome/imageUpload.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", dashboardSessionSecret: "s", logLevel: "info" },
}));

const session = {
  userId: "user-1",
  username: "u",
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

const mockUpload = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/welcome/image", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@fluxcore/systems/welcome/image");
  return {
    ...actual,
    createStorageAdapter: () => ({
      upload: mockUpload,
      delete: vi.fn().mockResolvedValue(undefined),
    }),
    MAX_BACKGROUND_SIZE: 5 * 1024 * 1024,
    ALLOWED_BACKGROUND_TYPES: ["image/png", "image/jpeg", "image/webp"],
    PRESET_BACKGROUNDS: [],
    DEFAULT_WELCOME_IMAGE_SETTINGS: {},
    DEFAULT_FAREWELL_IMAGE_SETTINGS: {},
    welcomeImageSettingsSchema: { safeParse: () => ({ success: true, data: {} }) },
    generateWelcomeImage: vi.fn(),
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

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

describe("POST /api/guilds/:guildId/welcome/image/background — magic byte validation", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("rejects invalid base64 with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/welcome/image/background",
      cookies: { session: app.signCookie("valid") },
      payload: { data: "@@@not-base64@@@", contentType: "image/png" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects payload whose magic bytes do not match contentType", async () => {
    const fakePng = Buffer.from("hello world").toString("base64");
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/welcome/image/background",
      cookies: { session: app.signCookie("valid") },
      payload: { data: fakePng, contentType: "image/png" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/png|magic|content/i);
  });

  it("rejects mismatched contentType vs header (jpeg sent as png)", async () => {
    const data = JPEG_HEADER.toString("base64");
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/welcome/image/background",
      cookies: { session: app.signCookie("valid") },
      payload: { data, contentType: "image/png" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("accepts a valid PNG header", async () => {
    const data = Buffer.concat([PNG_HEADER, Buffer.alloc(16)]).toString("base64");
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/welcome/image/background",
      cookies: { session: app.signCookie("valid") },
      payload: { data, contentType: "image/png" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockUpload).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
pnpm --filter @fluxcore/dashboard test -- imageUpload
```

Expected: the three rejection tests FAIL (current handler returns 200 for any base64-shaped string).

- [ ] **Step 3: Implement the fix**

Edit `apps/dashboard/src/server/features/welcome/routes.ts` — replace the body of the POST `/welcome/image/background` handler (lines 206-233):

```typescript
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const { data, contentType } = request.body as { data: string; contentType: string };

      if (!ALLOWED_BACKGROUND_TYPES.includes(contentType)) {
        reply.code(400).send({
          error: `Invalid file type. Allowed: ${ALLOWED_BACKGROUND_TYPES.join(", ")}`,
        });
        return;
      }

      // Strict base64 validation (RFC 4648, optional padding)
      const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
      if (data.length === 0 || data.length % 4 !== 0 || !base64Regex.test(data)) {
        reply.code(400).send({ error: "Invalid base64 payload" });
        return;
      }

      const buffer = Buffer.from(data, "base64");
      if (buffer.length === 0) {
        reply.code(400).send({ error: "Empty payload" });
        return;
      }

      if (buffer.length > MAX_BACKGROUND_SIZE) {
        reply.code(400).send({
          error: `File too large. Maximum size: ${MAX_BACKGROUND_SIZE / 1024 / 1024} MB`,
        });
        return;
      }

      // Magic byte sniffing — must match contentType
      const detected = detectImageType(buffer);
      if (!detected || detected !== contentType) {
        reply.code(400).send({
          error: "File content does not match the declared image type",
        });
        return;
      }

      const ext = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1];
      const key = `backgrounds/${guildId}/${randomUUID()}.${ext}`;

      await storage.upload(key, buffer, contentType);

      reply.send({ key });
    },
```

Add this helper at the bottom of the file (outside `registerWelcomeRoutes`):

```typescript
function detectImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm --filter @fluxcore/dashboard test -- imageUpload
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/welcome/routes.ts apps/dashboard/tests/server/features/welcome/imageUpload.test.ts
git commit -m "fix(welcome): validate base64 and magic bytes for background uploads"
```
