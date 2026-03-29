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
vi.mock("../../src/server/session.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  touchSession: (...args: unknown[]) => mockTouchSession(...args),
}));

const mockIsBotInGuild = vi.fn().mockResolvedValue(true);
vi.mock("../../src/server/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
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
});
vi.mock("@fluxcore/systems/welcome/config", () => ({
  getWelcomeConfig: (...args: unknown[]) => mockGetWelcomeConfig(...args),
  upsertWelcomeConfig: (...args: unknown[]) => mockUpsertWelcomeConfig(...args),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerWelcomeRoutes } from "../../src/server/routes/welcome.js";

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

    it("returns default config when none exists", async () => {
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

    it("rejects invalid body fields", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/welcome",
        cookies: { session: app.signCookie("valid") },
        payload: {
          invalidField: true,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 403 when user lacks guild permissions", async () => {
      mockGetSession.mockResolvedValueOnce({
        ...mockSession,
        guilds: [{ id: "guild-1", name: "Test", permissions: "0" }],
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
});
