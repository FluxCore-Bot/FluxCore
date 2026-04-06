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

const mockGetLevelSettings = vi.fn().mockResolvedValue({
  guildId: "guild-1",
  enabled: true,
  xpPerMessage: 15,
  xpCooldownSeconds: 60,
  voiceXpPerMinute: 5,
  voiceXpEnabled: true,
  announceChannel: null,
  announceMessage: "{user} just reached **Level {level}**!",
  announceEnabled: true,
  noXpChannels: [],
  noXpRoles: [],
  xpMultipliers: {},
});
const mockUpsertLevelSettings = vi.fn().mockResolvedValue({
  guildId: "guild-1",
  enabled: false,
  xpPerMessage: 20,
  xpCooldownSeconds: 30,
  voiceXpPerMinute: 5,
  voiceXpEnabled: true,
  announceChannel: null,
  announceMessage: "{user} just reached **Level {level}**!",
  announceEnabled: true,
  noXpChannels: [],
  noXpRoles: [],
  xpMultipliers: {},
});
const mockGetLevelRewards = vi.fn().mockResolvedValue([]);
const mockAddLevelReward = vi.fn().mockResolvedValue({ id: 1, guildId: "guild-1", level: 5, roleId: "role-1" });
const mockRemoveLevelReward = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/leveling/config", () => ({
  getLevelSettings: (...args: unknown[]) => mockGetLevelSettings(...args),
  upsertLevelSettings: (...args: unknown[]) => mockUpsertLevelSettings(...args),
  getLevelRewards: (...args: unknown[]) => mockGetLevelRewards(...args),
  addLevelReward: (...args: unknown[]) => mockAddLevelReward(...args),
  removeLevelReward: (...args: unknown[]) => mockRemoveLevelReward(...args),
}));

const mockGetLeaderboard = vi.fn().mockResolvedValue({ entries: [], total: 0 });
const mockGetUserLevel = vi.fn().mockResolvedValue(null);
const mockSetXp = vi.fn().mockResolvedValue({ leveledUp: false, newLevel: 0, oldLevel: 0, totalXp: 0 });
const mockGetUserRank = vi.fn().mockResolvedValue(0);
vi.mock("@fluxcore/systems/leveling/persistence", () => ({
  getLeaderboard: (...args: unknown[]) => mockGetLeaderboard(...args),
  getUserLevel: (...args: unknown[]) => mockGetUserLevel(...args),
  setXp: (...args: unknown[]) => mockSetXp(...args),
  getUserRank: (...args: unknown[]) => mockGetUserRank(...args),
}));

vi.mock("@fluxcore/systems/leveling/xp", () => ({
  levelFromXp: (xp: number) => Math.floor(xp / 100),
}));

vi.mock("@fluxcore/systems/leveling/constants", () => ({
  LEADERBOARD_PAGE_SIZE: 10,
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerLevelingRoutes } from "../../../../src/server/features/leveling/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerLevelingRoutes(app);
  await app.ready();
  return app;
}

describe("leveling routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    app = await buildApp();
  });

  // --- Leaderboard ---
  describe("GET /api/guilds/:guildId/leaderboard", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/leaderboard",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns leaderboard on success", async () => {
      mockGetLeaderboard.mockResolvedValueOnce({
        entries: [{ userId: "u1", xp: 500, level: 3 }],
        total: 1,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/leaderboard",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entries).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it("passes page and limit query params", async () => {
      await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/leaderboard?page=2&limit=5",
        cookies: { session: app.signCookie("valid") },
      });

      expect(mockGetLeaderboard).toHaveBeenCalledWith("guild-1", 2, 5);
    });
  });

  // --- User Level ---
  describe("GET /api/guilds/:guildId/levels/:userId", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/levels/user-1",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns default level for unknown user", async () => {
      mockGetUserLevel.mockResolvedValueOnce(null);
      mockGetUserRank.mockResolvedValueOnce(0);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/levels/user-1",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.xp).toBe(0);
      expect(body.level).toBe(0);
    });

    it("returns user level data", async () => {
      mockGetUserLevel.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-1",
        userId: "user-1",
        xp: 500,
        level: 3,
        messageCount: 42,
        voiceMinutes: 10,
      });
      mockGetUserRank.mockResolvedValueOnce(5);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/levels/user-1",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.xp).toBe(500);
      expect(body.rank).toBe(5);
    });
  });

  // --- Set XP ---
  describe("PUT /api/guilds/:guildId/levels/:userId", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/levels/user-1",
        payload: { xp: 100 },
      });
      expect(res.statusCode).toBe(401);
    });

    it("sets XP on valid request", async () => {
      mockSetXp.mockResolvedValueOnce({
        leveledUp: false,
        newLevel: 1,
        oldLevel: 0,
        totalXp: 100,
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/levels/user-1",
        cookies: { session: app.signCookie("valid") },
        payload: { xp: 100 },
      });

      expect(res.statusCode).toBe(200);
      expect(mockSetXp).toHaveBeenCalledWith("guild-1", "user-1", 100);
    });

    it("returns 400 for missing xp", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/levels/user-1",
        cookies: { session: app.signCookie("valid") },
        payload: {},
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
        url: "/api/guilds/guild-1/levels/user-1",
        cookies: { session: app.signCookie("valid") },
        payload: { xp: 100 },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // --- Settings ---
  describe("GET /api/guilds/:guildId/level-settings", () => {
    it("returns settings on success", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/level-settings",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.guildId).toBe("guild-1");
      expect(body.enabled).toBe(true);
    });
  });

  describe("PUT /api/guilds/:guildId/level-settings", () => {
    it("updates settings on valid request", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/level-settings",
        cookies: { session: app.signCookie("valid") },
        payload: { enabled: false, xpPerMessage: 20 },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpsertLevelSettings).toHaveBeenCalledWith(
        "guild-1",
        expect.objectContaining({ enabled: false, xpPerMessage: 20 }),
      );
    });
  });

  // --- Rewards ---
  describe("GET /api/guilds/:guildId/level-rewards", () => {
    it("returns rewards on success", async () => {
      mockGetLevelRewards.mockResolvedValueOnce([
        { id: 1, guildId: "guild-1", level: 5, roleId: "role-1" },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/level-rewards",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
    });
  });

  describe("POST /api/guilds/:guildId/level-rewards", () => {
    it("adds reward on valid request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/level-rewards",
        cookies: { session: app.signCookie("valid") },
        payload: { level: 5, roleId: "role-1" },
      });

      expect(res.statusCode).toBe(201);
      expect(mockAddLevelReward).toHaveBeenCalledWith("guild-1", 5, "role-1");
    });

    it("returns 400 for missing level", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/level-rewards",
        cookies: { session: app.signCookie("valid") },
        payload: { roleId: "role-1" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for duplicate reward", async () => {
      mockAddLevelReward.mockRejectedValueOnce(new Error("Unique constraint"));

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/level-rewards",
        cookies: { session: app.signCookie("valid") },
        payload: { level: 5, roleId: "role-1" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/guilds/:guildId/level-rewards/:id", () => {
    it("removes reward on valid request", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/level-rewards/1",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(mockRemoveLevelReward).toHaveBeenCalledWith(1, "guild-1");
    });

    it("returns 400 for invalid reward ID", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/level-rewards/invalid",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
