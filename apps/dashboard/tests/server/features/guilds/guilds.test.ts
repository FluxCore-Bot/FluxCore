import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    dashboardSessionSecret: "session-secret",
    logLevel: "info",
  },
}));

const mockGetSession = vi.fn().mockResolvedValue(null);
const mockForceRefreshSessionGuilds = vi.fn().mockResolvedValue([]);
vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  touchSession: vi.fn().mockResolvedValue(undefined),
  forceRefreshSessionGuilds: (...args: unknown[]) =>
    mockForceRefreshSessionGuilds(...args),
}));

const mockIsBotInGuild = vi.fn().mockResolvedValue(true);
const mockGetGuildOwnerId = vi.fn().mockResolvedValue("owner-1");
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
  getGuildOwnerId: (...args: unknown[]) => mockGetGuildOwnerId(...args),
}));

vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: vi.fn().mockResolvedValue({ permissions: new Set(["*"]), isOwner: false }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerGuildRoutes } from "../../../../src/server/features/guilds/routes.js";

const MANAGE_GUILD = BigInt(0x20);
const ADMINISTRATOR = BigInt(0x8);

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerGuildRoutes(app);
  await app.ready();
  return app;
}

describe("guild routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  describe("GET /api/guilds", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await app.inject({ method: "GET", url: "/api/guilds" });
      expect(res.statusCode).toBe(401);
    });

    it("returns guilds where user has MANAGE_GUILD and bot is present", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        username: "testuser",
        guilds: [
          { id: "g1", name: "Guild 1", icon: "abc", permissions: MANAGE_GUILD.toString() },
          { id: "g2", name: "Guild 2", icon: null, permissions: "0" },
          { id: "g3", name: "Guild 3", icon: "def", permissions: MANAGE_GUILD.toString() },
        ],
      });
      mockIsBotInGuild.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds",
        cookies: { session: app.signCookie("valid-id") },
      });

      expect(res.statusCode).toBe(200);
      const guilds = res.json();
      expect(guilds).toHaveLength(1);
      expect(guilds[0].id).toBe("g1");
      expect(guilds[0].name).toBe("Guild 1");
    });

    it("returns guilds where user has only the Administrator permission", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        guilds: [
          { id: "g1", name: "Admin Guild", icon: null, permissions: ADMINISTRATOR.toString() },
        ],
      });
      mockIsBotInGuild.mockResolvedValueOnce(true);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds",
        cookies: { session: app.signCookie("valid-id") },
      });

      expect(res.statusCode).toBe(200);
      const guilds = res.json();
      expect(guilds).toHaveLength(1);
      expect(guilds[0].id).toBe("g1");
    });

    it("returns guilds the user owns even without a manage permission", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        guilds: [
          { id: "g1", name: "Owned Guild", icon: null, permissions: "0", owner: true },
        ],
      });
      mockIsBotInGuild.mockResolvedValueOnce(true);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds",
        cookies: { session: app.signCookie("valid-id") },
      });

      expect(res.statusCode).toBe(200);
      const guilds = res.json();
      expect(guilds).toHaveLength(1);
      expect(guilds[0].id).toBe("g1");
    });

    it("returns empty array when user has no manageable guilds", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        guilds: [{ id: "g1", name: "Guild", permissions: "0" }],
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds",
        cookies: { session: app.signCookie("valid-id") },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  describe("POST /api/guilds/refresh", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await app.inject({ method: "POST", url: "/api/guilds/refresh" });
      expect(res.statusCode).toBe(401);
      expect(mockForceRefreshSessionGuilds).not.toHaveBeenCalled();
    });

    it("re-fetches the session guilds and returns the manageable list", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        guilds: [],
      });
      // Simulate a freshly-granted admin role appearing after the refresh.
      mockForceRefreshSessionGuilds.mockResolvedValueOnce([
        { id: "g9", name: "Newly Admin", icon: null, permissions: ADMINISTRATOR.toString() },
      ]);
      mockIsBotInGuild.mockResolvedValueOnce(true);

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/refresh",
        cookies: { session: app.signCookie("valid-id") },
      });

      expect(res.statusCode).toBe(200);
      expect(mockForceRefreshSessionGuilds).toHaveBeenCalledWith("valid-id");
      const guilds = res.json();
      expect(guilds).toHaveLength(1);
      expect(guilds[0].id).toBe("g9");
    });
  });
});
