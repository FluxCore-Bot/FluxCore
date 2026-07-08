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

const defaultConfig = {
  guildId: "guild-1",
  enabled: false,
  joinThreshold: 10,
  joinWindow: 10,
  joinAction: "kick",
  accountAgeMinDays: 0,
  accountAgeAction: "kick",
  antiNukeEnabled: false,
  antiNukeThreshold: 3,
  lockdownOnRaid: false,
  whitelistedRoleIds: [],
  logChannelId: null,
};

const mockGetAntiRaidConfig = vi.fn().mockResolvedValue(defaultConfig);
const mockUpsertAntiRaidConfig = vi.fn().mockResolvedValue(defaultConfig);
vi.mock("@fluxcore/systems/antiraid/config", () => ({
  getAntiRaidConfig: (...args: unknown[]) => mockGetAntiRaidConfig(...args),
  upsertAntiRaidConfig: (...args: unknown[]) => mockUpsertAntiRaidConfig(...args),
}));

const mockGetRaidEvents = vi.fn().mockResolvedValue({ events: [], total: 0 });
vi.mock("@fluxcore/systems/antiraid/persistence", () => ({
  getRaidEvents: (...args: unknown[]) => mockGetRaidEvents(...args),
}));

vi.mock("@fluxcore/systems/antiraid/constants", () => ({
  VALID_RAID_ACTIONS: ["kick", "ban", "timeout"],
  RAID_EVENT_PAGE_SIZE: 20,
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerAntiRaidRoutes } from "../../../../src/server/features/security/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerAntiRaidRoutes(app);
  await app.ready();
  return app;
}

describe("anti-raid routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    app = await buildApp();
  });

  describe("GET /api/guilds/:guildId/antiraid-config", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/antiraid-config",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns config for authenticated user", async () => {
      mockGetAntiRaidConfig.mockResolvedValueOnce(defaultConfig);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/antiraid-config",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.guildId).toBe("guild-1");
      expect(body.enabled).toBe(false);
      expect(body.joinThreshold).toBe(10);
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
        url: "/api/guilds/guild-1/antiraid-config",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("PUT /api/guilds/:guildId/antiraid-config", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/antiraid-config",
        payload: { enabled: true },
      });
      expect(res.statusCode).toBe(401);
    });

    it("updates config on valid request", async () => {
      const updated = { ...defaultConfig, enabled: true, joinThreshold: 5 };
      mockUpsertAntiRaidConfig.mockResolvedValueOnce(updated);

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/antiraid-config",
        cookies: { session: app.signCookie("valid") },
        payload: {
          enabled: true,
          joinThreshold: 5,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpsertAntiRaidConfig).toHaveBeenCalledWith(
        "guild-1",
        expect.objectContaining({
          enabled: true,
          joinThreshold: 5,
        }),
      );
    });

    it("rejects invalid body fields", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/antiraid-config",
        cookies: { session: app.signCookie("valid") },
        payload: {
          invalidField: true,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid action values", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/antiraid-config",
        cookies: { session: app.signCookie("valid") },
        payload: {
          joinAction: "nuke",
        },
      });

      expect(res.statusCode).toBe(400);
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
        url: "/api/guilds/guild-1/antiraid-config",
        cookies: { session: app.signCookie("valid") },
        payload: { enabled: true },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("GET /api/guilds/:guildId/raid-events", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/raid-events",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns paginated events", async () => {
      mockGetRaidEvents.mockResolvedValueOnce({
        events: [
          {
            id: 1,
            guildId: "guild-1",
            eventType: "join_spike",
            details: { action: "kick", count: 10 },
            triggeredAt: new Date(),
          },
        ],
        total: 1,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/raid-events?page=1",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.events).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it("returns empty events when none exist", async () => {
      mockGetRaidEvents.mockResolvedValueOnce({ events: [], total: 0 });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/raid-events",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.events).toEqual([]);
      expect(body.total).toBe(0);
    });
  });
});
