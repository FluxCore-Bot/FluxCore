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
vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));

const mockIsBotInGuild = vi.fn().mockResolvedValue(true);
const mockChannelExistsInGuild = vi.fn().mockResolvedValue(true);
const mockGetGuildOwnerId = vi.fn().mockResolvedValue("owner-1");
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
  channelExistsInGuild: (...args: unknown[]) => mockChannelExistsInGuild(...args),
  getGuildOwnerId: (...args: unknown[]) => mockGetGuildOwnerId(...args),
}));

vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: vi.fn().mockResolvedValue({ permissions: new Set(["*"]), isOwner: false }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockGetGuildConfigs = vi.fn().mockReturnValue([]);
const mockAddGuildConfig = vi.fn().mockResolvedValue({
  id: 1,
  hubChannelId: "ch-1",
  categoryId: null,
  nameTemplate: "{user}'s Channel",
});
const mockUpdateGuildConfig = vi.fn().mockResolvedValue({
  id: 1,
  hubChannelId: "ch-1",
  categoryId: null,
  nameTemplate: "{user}'s Room",
});
const mockRemoveGuildConfig = vi.fn().mockResolvedValue(true);
const mockGetConfigByHubChannel = vi.fn().mockReturnValue(undefined);
vi.mock("@fluxcore/systems/tempVoice/config", () => ({
  getGuildConfigs: (...args: unknown[]) => mockGetGuildConfigs(...args),
  addGuildConfig: (...args: unknown[]) => mockAddGuildConfig(...args),
  updateGuildConfig: (...args: unknown[]) => mockUpdateGuildConfig(...args),
  removeGuildConfig: (...args: unknown[]) => mockRemoveGuildConfig(...args),
  getConfigByHubChannel: (...args: unknown[]) => mockGetConfigByHubChannel(...args),
}));

vi.mock("@fluxcore/systems/tempVoice/constants", () => ({
  MAX_TEMPVOICE_CONFIGS_PER_GUILD: 10,
}));

const mockNotifyCacheInvalidation = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/actions/persistence", () => ({
  notifyCacheInvalidation: (...args: unknown[]) =>
    mockNotifyCacheInvalidation(...args),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerTempVoiceRoutes } from "../../../../src/server/features/tempvoice/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerTempVoiceRoutes(app);
  await app.ready();
  return app;
}

describe("tempvoice routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    mockGetGuildConfigs.mockReturnValue([]);
    mockGetConfigByHubChannel.mockReturnValue(undefined);
    app = await buildApp();
  });

  describe("GET /api/guilds/:guildId/tempvoice", () => {
    it("returns empty array when no configs exist", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: app.signCookie("valid") },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns array of configs when they exist", async () => {
      mockGetGuildConfigs.mockReturnValueOnce([
        { id: 1, hubChannelId: "ch-1", nameTemplate: "{user}'s Room", categoryId: null },
        { id: 2, hubChannelId: "ch-2", nameTemplate: "{user}'s Gaming", categoryId: "cat-1" },
      ]);
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: app.signCookie("valid") },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json).toHaveLength(2);
      expect(json[0].hubChannelId).toBe("ch-1");
      expect(json[1].hubChannelId).toBe("ch-2");
    });
  });

  describe("POST /api/guilds/:guildId/tempvoice", () => {
    it("creates config successfully", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: app.signCookie("valid") },
        payload: { hubChannelId: "ch-1", nameTemplate: "{user}'s Room" },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().id).toBe(1);
      expect(mockAddGuildConfig).toHaveBeenCalled();
      expect(mockNotifyCacheInvalidation).toHaveBeenCalledWith(
        "guild-1",
        "reloadTempVoice",
      );
    });

    it("returns 400 when hubChannelId missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: app.signCookie("valid") },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when hub channel doesn't exist in guild", async () => {
      mockChannelExistsInGuild.mockResolvedValueOnce(false);
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: app.signCookie("valid") },
        payload: { hubChannelId: "bad-channel" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Invalid hub channel");
    });

    it("returns 400 when hub channel already configured", async () => {
      mockGetConfigByHubChannel.mockReturnValueOnce({
        id: 1,
        hubChannelId: "ch-1",
        categoryId: null,
        nameTemplate: "{user}'s Channel",
      });
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: app.signCookie("valid") },
        payload: { hubChannelId: "ch-1" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("already a temp voice hub");
    });

    it("returns 400 when config limit reached", async () => {
      mockGetGuildConfigs.mockReturnValueOnce(
        Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          hubChannelId: `hub-${i}`,
          categoryId: null,
          nameTemplate: "{user}'s Channel",
        })),
      );
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: app.signCookie("valid") },
        payload: { hubChannelId: "ch-new" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("limit");
    });

    it("returns 400 when name template too long", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: app.signCookie("valid") },
        payload: { hubChannelId: "ch-1", nameTemplate: "x".repeat(101) },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("too long");
    });
  });

  describe("PUT /api/guilds/:guildId/tempvoice/:configId", () => {
    it("updates config successfully", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/tempvoice/1",
        cookies: { session: app.signCookie("valid") },
        payload: { nameTemplate: "{user}'s Room" },
      });
      expect(res.statusCode).toBe(200);
      expect(mockUpdateGuildConfig).toHaveBeenCalledWith("guild-1", 1, {
        nameTemplate: "{user}'s Room",
      });
      expect(mockNotifyCacheInvalidation).toHaveBeenCalledWith(
        "guild-1",
        "reloadTempVoice",
      );
    });

    it("returns 400 when changing hub to already-used channel", async () => {
      mockGetConfigByHubChannel.mockReturnValueOnce({
        id: 2,
        hubChannelId: "ch-other",
        categoryId: null,
        nameTemplate: "{user}'s Channel",
      });
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/tempvoice/1",
        cookies: { session: app.signCookie("valid") },
        payload: { hubChannelId: "ch-other" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("already a temp voice hub");
    });

    it("returns 404 when config not found", async () => {
      mockUpdateGuildConfig.mockRejectedValueOnce(new Error("Not found"));
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/tempvoice/999",
        cookies: { session: app.signCookie("valid") },
        payload: { nameTemplate: "test" },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/guilds/:guildId/tempvoice/:configId", () => {
    it("removes config successfully", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/tempvoice/1",
        cookies: { session: app.signCookie("valid") },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockRemoveGuildConfig).toHaveBeenCalledWith("guild-1", 1);
      expect(mockNotifyCacheInvalidation).toHaveBeenCalledWith(
        "guild-1",
        "reloadTempVoice",
      );
    });

    it("returns success false when config not found", async () => {
      mockRemoveGuildConfig.mockResolvedValueOnce(false);
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/tempvoice/999",
        cookies: { session: app.signCookie("valid") },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(false);
      expect(mockNotifyCacheInvalidation).not.toHaveBeenCalled();
    });
  });
});
