import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    dashboardSessionSecret: "session-secret",
    logLevel: "info",
  },
}));

const MANAGE_GUILD = BigInt(0x20);
const mockSession = {
  userId: "user-1",
  username: "testuser",
  guilds: [{ id: "guild-1", name: "Test", permissions: MANAGE_GUILD.toString() }],
};

const mockGetSession = vi.fn().mockResolvedValue(mockSession);
const mockTouchSession = vi.fn().mockResolvedValue(undefined);
vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  touchSession: (...args: unknown[]) => mockTouchSession(...args),
}));

const mockIsBotInGuild = vi.fn().mockResolvedValue(true);
const mockGetGuildOwnerId = vi.fn().mockResolvedValue("owner-1");
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
  getGuildOwnerId: (...args: unknown[]) => mockGetGuildOwnerId(...args),
}));

const mockResolveUserPermissions = vi.fn().mockResolvedValue({
  permissions: new Set(["*"]),
  isOwner: false,
  isGuildAdmin: true,
});
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: (...args: unknown[]) => mockResolveUserPermissions(...args),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockGetWelcomeConfig = vi.fn().mockResolvedValue(null);
const mockUpsertWelcomeConfig = vi.fn().mockResolvedValue({
  guildId: "guild-1",
  welcomeEnabled: false,
  welcomeChannelId: null,
  welcomeMessage: {},
  farewellEnabled: false,
  farewellChannelId: null,
  farewellMessage: {},
  dmEnabled: false,
  dmMessage: {},
  autoRoleIds: [],
  welcomeImageEnabled: false,
  welcomeImageConfig: {},
  farewellImageEnabled: false,
  farewellImageConfig: {},
});
vi.mock("@fluxcore/systems/welcome/config", () => ({
  getWelcomeConfig: (...args: unknown[]) => mockGetWelcomeConfig(...args),
  upsertWelcomeConfig: (...args: unknown[]) => mockUpsertWelcomeConfig(...args),
}));

const mockGenerateWelcomeImage = vi.fn().mockResolvedValue(Buffer.from("fake-png"));
vi.mock("@fluxcore/systems/welcome/image", () => ({
  generateWelcomeImage: (...args: unknown[]) => mockGenerateWelcomeImage(...args),
  getAllTemplates: () => [
    { name: "starter", displayName: "Starter", description: "Classic", canvas: { width: 1024, height: 450 } },
  ],
  getAvailableFonts: () => [
    { name: "Inter", displayName: "Inter", category: "sans-serif", file: "Inter.ttf", weight: 600 },
  ],
  createStorageAdapter: () => ({
    upload: vi.fn().mockResolvedValue("key"),
    delete: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(Buffer.from("")),
    exists: vi.fn().mockResolvedValue(false),
    getUrl: vi.fn().mockReturnValue("/uploads/test"),
  }),
  welcomeImageSettingsSchema: {
    safeParse: (data: unknown) => ({ success: true, data }),
  },
  DEFAULT_WELCOME_IMAGE_SETTINGS: {},
  DEFAULT_FAREWELL_IMAGE_SETTINGS: {},
  MAX_BACKGROUND_SIZE: 3 * 1024 * 1024,
  ALLOWED_BACKGROUND_TYPES: ["image/jpeg", "image/png", "image/webp"],
  PRESET_BACKGROUNDS: ["midnight", "ocean"],
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

describe("welcome routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    app = await buildApp();
  });

  describe("GET /api/guilds/:guildId/welcome", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/welcome",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns default config with image fields when none exists", async () => {
      mockGetWelcomeConfig.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/welcome",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.guildId).toBe("guild-1");
      expect(body.welcomeEnabled).toBe(false);
      expect(body.autoRoleIds).toEqual([]);
      expect(body.welcomeImageEnabled).toBe(false);
      expect(body.farewellImageEnabled).toBe(false);
    });

    it("returns existing config", async () => {
      mockGetWelcomeConfig.mockResolvedValueOnce({
        guildId: "guild-1",
        welcomeEnabled: true,
        welcomeChannelId: "ch-1",
        welcomeMessage: { title: "Hello" },
        farewellEnabled: false,
        farewellChannelId: null,
        farewellMessage: {},
        dmEnabled: false,
        dmMessage: {},
        autoRoleIds: ["role-1"],
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/welcome",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.welcomeEnabled).toBe(true);
      expect(body.welcomeChannelId).toBe("ch-1");
      expect(body.autoRoleIds).toEqual(["role-1"]);
    });

    it("returns 403 when user lacks guild permissions", async () => {
      mockGetSession.mockResolvedValueOnce({
        ...mockSession,
        guilds: [{ id: "guild-1", name: "Test", permissions: "0" }],
      });
      mockResolveUserPermissions.mockResolvedValueOnce({
        permissions: new Set(),
        isOwner: false,
        isGuildAdmin: false,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/welcome",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("PUT /api/guilds/:guildId/welcome", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/welcome",
        payload: { welcomeEnabled: true },
      });
      expect(res.statusCode).toBe(401);
    });

    it("updates config on valid request", async () => {
      mockUpsertWelcomeConfig.mockResolvedValueOnce({
        guildId: "guild-1",
        welcomeEnabled: true,
        welcomeChannelId: "ch-1",
        welcomeMessage: { title: "Welcome!" },
        farewellEnabled: false,
        farewellChannelId: null,
        farewellMessage: {},
        dmEnabled: false,
        dmMessage: {},
        autoRoleIds: [],
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/welcome",
        cookies: { session: app.signCookie("valid") },
        payload: {
          welcomeEnabled: true,
          welcomeChannelId: "ch-1",
          welcomeMessage: { title: "Welcome!" },
        },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpsertWelcomeConfig).toHaveBeenCalledWith(
        "guild-1",
        expect.objectContaining({
          welcomeEnabled: true,
          welcomeChannelId: "ch-1",
        }),
      );
    });

    it("ignores unknown body fields and succeeds", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/welcome",
        cookies: { session: app.signCookie("valid") },
        payload: {
          invalidField: true,
        },
      });

      // additionalProperties: false strips unknown keys — empty update still succeeds
      expect(res.statusCode).toBe(200);
    });

    it("returns 403 when user lacks guild permissions", async () => {
      mockGetSession.mockResolvedValueOnce({
        ...mockSession,
        guilds: [{ id: "guild-1", name: "Test", permissions: "0" }],
      });
      mockResolveUserPermissions.mockResolvedValueOnce({
        permissions: new Set(),
        isOwner: false,
        isGuildAdmin: false,
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/welcome",
        cookies: { session: app.signCookie("valid") },
        payload: { welcomeEnabled: true },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("POST /api/guilds/:guildId/welcome/test", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/welcome/test",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when welcome is not enabled", async () => {
      mockGetWelcomeConfig.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/welcome/test",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("not enabled");
    });

    it("returns 400 when no channel configured", async () => {
      mockGetWelcomeConfig.mockResolvedValueOnce({
        welcomeEnabled: true,
        welcomeChannelId: null,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/welcome/test",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("No welcome channel");
    });

    it("returns success when config is valid", async () => {
      mockGetWelcomeConfig.mockResolvedValueOnce({
        welcomeEnabled: true,
        welcomeChannelId: "ch-1",
        welcomeMessage: { title: "Welcome!" },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/welcome/test",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().channelId).toBe("ch-1");
    });
  });

  describe("POST /api/guilds/:guildId/welcome/image/preview", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/welcome/image/preview",
        payload: { settings: {} },
      });
      expect(res.statusCode).toBe(401);
    });

    it("generates a preview image", async () => {
      mockGetSession.mockResolvedValueOnce({
        ...mockSession,
        avatar: "abc123",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/welcome/image/preview",
        cookies: { session: app.signCookie("valid") },
        payload: {
          settings: { template: "starter" },
          type: "welcome",
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("image/png");
      expect(mockGenerateWelcomeImage).toHaveBeenCalled();
    });
  });

  describe("POST /api/guilds/:guildId/welcome/image/background", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/welcome/image/background",
        payload: { data: "abc", contentType: "image/png" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("rejects invalid content type", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/welcome/image/background",
        cookies: { session: app.signCookie("valid") },
        payload: { data: btoa("test"), contentType: "application/pdf" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Invalid file type");
    });

    it("accepts valid image upload", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/welcome/image/background",
        cookies: { session: app.signCookie("valid") },
        payload: { data: Buffer.from("fake-png").toString("base64"), contentType: "image/png" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().key).toContain("backgrounds/guild-1/");
    });
  });

  describe("DELETE /api/guilds/:guildId/welcome/image/background", () => {
    it("rejects cross-guild deletion", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/welcome/image/background",
        cookies: { session: app.signCookie("valid") },
        payload: { key: "backgrounds/guild-2/evil.png" },
      });

      expect(res.statusCode).toBe(403);
    });

    it("deletes own guild background", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/welcome/image/background",
        cookies: { session: app.signCookie("valid") },
        payload: { key: "backgrounds/guild-1/image.png" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  describe("GET /api/welcome/templates", () => {
    it("returns available templates", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/welcome/templates",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.templates).toBeDefined();
      expect(Array.isArray(body.templates)).toBe(true);
    });
  });

  describe("GET /api/welcome/fonts", () => {
    it("returns available fonts", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/welcome/fonts",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().fonts).toBeDefined();
    });
  });

  describe("GET /api/welcome/presets", () => {
    it("returns preset background names", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/welcome/presets",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().backgrounds).toBeDefined();
    });
  });

  describe("PUT /api/guilds/:guildId/welcome with image config", () => {
    it("saves image settings alongside text config", async () => {
      mockUpsertWelcomeConfig.mockResolvedValueOnce({
        guildId: "guild-1",
        welcomeEnabled: true,
        welcomeImageEnabled: true,
        welcomeImageConfig: { template: "neon" },
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/welcome",
        cookies: { session: app.signCookie("valid") },
        payload: {
          welcomeEnabled: true,
          welcomeImageEnabled: true,
          welcomeImageConfig: { template: "neon" },
        },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpsertWelcomeConfig).toHaveBeenCalledWith(
        "guild-1",
        expect.objectContaining({
          welcomeImageEnabled: true,
          welcomeImageConfig: expect.objectContaining({ template: "neon" }),
        }),
      );
    });
  });
});
