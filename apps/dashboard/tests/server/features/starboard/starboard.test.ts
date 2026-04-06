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

vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: vi.fn().mockResolvedValue({ permissions: new Set(["*"]), isOwner: false }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockGetStarboardSettings = vi.fn().mockResolvedValue({
  guildId: "guild-1",
  enabled: true,
  channelId: null,
  emoji: "\u2B50",
  threshold: 3,
  selfStar: false,
  ignoredChannels: [],
  nsfwHandling: "ignore",
});
const mockUpsertStarboardSettings = vi.fn().mockResolvedValue({
  guildId: "guild-1",
  enabled: true,
  channelId: "ch-1",
  emoji: "\u2B50",
  threshold: 5,
  selfStar: false,
  ignoredChannels: [],
  nsfwHandling: "ignore",
});
vi.mock("@fluxcore/systems/starboard/config", () => ({
  getStarboardSettings: (...args: unknown[]) => mockGetStarboardSettings(...args),
  upsertStarboardSettings: (...args: unknown[]) => mockUpsertStarboardSettings(...args),
}));

const mockGetStarboardEntries = vi.fn().mockResolvedValue({ entries: [], total: 0 });
vi.mock("@fluxcore/systems/starboard/persistence", () => ({
  getStarboardEntries: (...args: unknown[]) => mockGetStarboardEntries(...args),
}));

vi.mock("@fluxcore/systems/starboard/constants", () => ({
  STARBOARD_PAGE_SIZE: 20,
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerStarboardRoutes } from "../../../../src/server/features/starboard/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerStarboardRoutes(app);
  await app.ready();
  return app;
}

describe("starboard routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    app = await buildApp();
  });

  describe("GET /api/guilds/:guildId/starboard-settings", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/starboard-settings",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns default settings", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/starboard-settings",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.guildId).toBe("guild-1");
      expect(body.enabled).toBe(true);
      expect(body.threshold).toBe(3);
    });

    it("returns 403 when user lacks guild permissions", async () => {
      mockGetSession.mockResolvedValueOnce({
        ...mockSession,
        guilds: [{ id: "guild-1", name: "Test", permissions: "0" }],
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/starboard-settings",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("PUT /api/guilds/:guildId/starboard-settings", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/starboard-settings",
        payload: { enabled: true },
      });
      expect(res.statusCode).toBe(401);
    });

    it("updates settings on valid request", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/starboard-settings",
        cookies: { session: app.signCookie("valid") },
        payload: {
          enabled: true,
          channelId: "ch-1",
          threshold: 5,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpsertStarboardSettings).toHaveBeenCalledWith(
        "guild-1",
        expect.objectContaining({
          enabled: true,
          channelId: "ch-1",
          threshold: 5,
        }),
      );
    });

    it("rejects invalid body fields", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/starboard-settings",
        cookies: { session: app.signCookie("valid") },
        payload: {
          invalidField: true,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects threshold below 1", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/starboard-settings",
        cookies: { session: app.signCookie("valid") },
        payload: {
          threshold: 0,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid nsfwHandling value", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/starboard-settings",
        cookies: { session: app.signCookie("valid") },
        payload: {
          nsfwHandling: "invalid",
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
        url: "/api/guilds/guild-1/starboard-settings",
        cookies: { session: app.signCookie("valid") },
        payload: { enabled: true },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("GET /api/guilds/:guildId/starboard", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/starboard",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns empty entries list", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/starboard",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entries).toEqual([]);
      expect(body.total).toBe(0);
    });

    it("returns entries with pagination", async () => {
      mockGetStarboardEntries.mockResolvedValueOnce({
        entries: [
          {
            id: 1,
            guildId: "guild-1",
            originalMessageId: "msg-1",
            originalChannelId: "ch-1",
            starboardMessageId: "star-msg-1",
            authorId: "user-1",
            starCount: 5,
            createdAt: new Date(),
          },
        ],
        total: 1,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/starboard?page=1",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].starCount).toBe(5);
      expect(body.total).toBe(1);
    });

    it("returns 403 when user lacks guild permissions", async () => {
      mockGetSession.mockResolvedValueOnce({
        ...mockSession,
        guilds: [{ id: "guild-1", name: "Test", permissions: "0" }],
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/starboard",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
