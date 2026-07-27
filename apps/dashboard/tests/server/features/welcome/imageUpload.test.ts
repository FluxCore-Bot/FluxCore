import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", dashboardSessionSecret: "s", logLevel: "info" },
}));

vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: "user-1",
    username: "u",
    guilds: [{ id: "guild-1", name: "T", permissions: BigInt(0x20).toString() }],
  }),
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

const { mockUpload } = vi.hoisted(() => ({ mockUpload: vi.fn().mockResolvedValue(undefined) }));
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

describe("POST /api/guilds/:guildId/welcome/image/background — body limit", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("accepts a 2MB image rather than rejecting it at the transport layer", async () => {
    // Well under the mocked 5MB MAX_BACKGROUND_SIZE, but its base64 form is
    // ~2.7MB — over Fastify's 1MB default bodyLimit, which would 413 before
    // the handler ever runs.
    const twoMb = Buffer.concat([PNG_HEADER, Buffer.alloc(2 * 1024 * 1024)]);
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/welcome/image/background",
      cookies: { session: app.signCookie("valid") },
      payload: { data: twoMb.toString("base64"), contentType: "image/png" },
    });

    expect(res.statusCode).toBe(200);
  });

  it("rejects a payload over the maximum with the handler's own 400, not a transport 413", async () => {
    // 5MB + 4KB: just over the mocked 5MB MAX_BACKGROUND_SIZE, but its base64
    // form (~6.67MB of JSON) still fits inside BACKGROUND_BODY_LIMIT
    // (ceil(MAX * 4/3) + 8KB), so the request must reach the handler and get
    // the friendly, size-naming 400.
    //
    // Accepting "400 or 413" here would pass with bodyLimit deleted — Fastify's
    // 1MB default would 413 this long before the handler ran. Pinning the exact
    // status AND the handler's message is what makes this test protect the fix.
    const overMax = Buffer.concat([
      PNG_HEADER,
      Buffer.alloc(5 * 1024 * 1024 + 4096 - PNG_HEADER.length),
    ]);
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/welcome/image/background",
      cookies: { session: app.signCookie("valid") },
      payload: { data: overMax.toString("base64"), contentType: "image/png" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/Maximum size: 5 MB/);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("rejects a payload beyond the body limit at the transport layer", async () => {
    // Far past BACKGROUND_BODY_LIMIT — raising the limit must not mean removing
    // the ceiling, so an absurd body is still refused before it is buffered.
    const tooBig = Buffer.concat([PNG_HEADER, Buffer.alloc(16 * 1024 * 1024)]);
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/welcome/image/background",
      cookies: { session: app.signCookie("valid") },
      payload: { data: tooBig.toString("base64"), contentType: "image/png" },
    });

    expect(res.statusCode).toBe(413);
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
