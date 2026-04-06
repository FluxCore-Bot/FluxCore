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
const mockGetGuildChannels = vi.fn().mockResolvedValue([]);
const mockGetGuildRoles = vi.fn().mockResolvedValue([]);
const mockGetGuildOwnerId = vi.fn().mockResolvedValue("owner-1");
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
  getGuildChannels: (...args: unknown[]) => mockGetGuildChannels(...args),
  getGuildRoles: (...args: unknown[]) => mockGetGuildRoles(...args),
  getGuildOwnerId: (...args: unknown[]) => mockGetGuildOwnerId(...args),
  invalidateGuildCache: vi.fn(),
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
import { registerDiscordRoutes } from "../../../../src/server/features/discord/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerDiscordRoutes(app);
  await app.ready();
  return app;
}

describe("discord routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    app = await buildApp();
  });

  describe("GET /api/guilds/:guildId/channels", () => {
    it("returns filtered channels sorted by name", async () => {
      mockGetGuildChannels.mockResolvedValueOnce([
        { id: "ch-1", name: "general", type: 0 },
        { id: "ch-2", name: "voice", type: 2 },
        { id: "ch-3", name: "category", type: 4 },
        { id: "ch-4", name: "announcement", type: 5 }, // Should be filtered out
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/channels",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const channels = res.json();
      expect(channels).toHaveLength(3);
      // Should be sorted alphabetically
      expect(channels[0].name).toBe("category");
      expect(channels[1].name).toBe("general");
      expect(channels[2].name).toBe("voice");
    });

    it("returns empty array when no channels", async () => {
      mockGetGuildChannels.mockResolvedValueOnce([]);
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/channels",
        cookies: { session: app.signCookie("valid") },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  describe("GET /api/guilds/:guildId/roles", () => {
    it("returns roles excluding @everyone, sorted by name", async () => {
      mockGetGuildRoles.mockResolvedValueOnce([
        { id: "guild-1", name: "@everyone", color: 0 }, // Should be excluded
        { id: "r-1", name: "Admin", color: 0xff0000 },
        { id: "r-2", name: "Member", color: 0x00ff00 },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/roles",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const roles = res.json();
      expect(roles).toHaveLength(2);
      expect(roles[0].name).toBe("Admin");
      expect(roles[0].color).toBe("#ff0000");
      expect(roles[1].name).toBe("Member");
    });

    it("returns empty array when only @everyone role exists", async () => {
      mockGetGuildRoles.mockResolvedValueOnce([
        { id: "guild-1", name: "@everyone", color: 0 },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/roles",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });
});
