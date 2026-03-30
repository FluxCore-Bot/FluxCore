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
const mockGetGuildOwnerId = vi.fn().mockResolvedValue("owner-1");
vi.mock("../../src/server/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
  getGuildOwnerId: (...args: unknown[]) => mockGetGuildOwnerId(...args),
}));

vi.mock("../../src/server/permissions.js", () => ({
  resolveUserPermissions: vi.fn().mockResolvedValue({ permissions: new Set(["*"]), isOwner: false }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockPanel = {
  id: 1,
  guildId: "guild-1",
  channelId: "ch-1",
  messageId: null,
  name: "Test Panel",
  type: "button",
  mode: "toggle",
  embed: "{}",
  roles: [{ roleId: "role-1", label: "Red" }],
  maxRoles: null,
  minRoles: null,
  createdBy: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockGetRolePanels = vi.fn().mockResolvedValue([]);
const mockGetRolePanel = vi.fn().mockResolvedValue(null);
const mockCreateRolePanel = vi.fn().mockResolvedValue(mockPanel);
const mockUpdateRolePanel = vi.fn().mockResolvedValue(mockPanel);
const mockDeleteRolePanel = vi.fn().mockResolvedValue(true);
vi.mock("@fluxcore/systems/rolePanel/persistence", () => ({
  getRolePanels: (...args: unknown[]) => mockGetRolePanels(...args),
  getRolePanel: (...args: unknown[]) => mockGetRolePanel(...args),
  createRolePanel: (...args: unknown[]) => mockCreateRolePanel(...args),
  updateRolePanel: (...args: unknown[]) => mockUpdateRolePanel(...args),
  deleteRolePanel: (...args: unknown[]) => mockDeleteRolePanel(...args),
}));

vi.mock("@fluxcore/systems/rolePanel/constants", () => ({
  MAX_ROLES_PER_PANEL: 25,
  VALID_PANEL_TYPES: ["reaction", "button", "dropdown"],
  VALID_PANEL_MODES: ["toggle", "unique", "verify"],
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerRolePanelRoutes } from "../../src/server/routes/rolePanel.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerRolePanelRoutes(app);
  await app.ready();
  return app;
}

describe("rolePanel routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    app = await buildApp();
  });

  describe("GET /api/guilds/:guildId/role-panels", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/role-panels",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns panels on success", async () => {
      mockGetRolePanels.mockResolvedValueOnce([mockPanel]);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/role-panels",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Test Panel");
    });

    it("returns 403 when user lacks guild permissions", async () => {
      mockGetSession.mockResolvedValueOnce({
        ...mockSession,
        guilds: [{ id: "guild-1", name: "Test", permissions: "0" }],
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/role-panels",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("POST /api/guilds/:guildId/role-panels", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/role-panels",
        payload: { name: "Test", type: "button", channelId: "ch-1" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("creates a panel on valid request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/role-panels",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "Test Panel",
          type: "button",
          mode: "toggle",
          channelId: "ch-1",
          roles: [{ roleId: "role-1", label: "Red" }],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(mockCreateRolePanel).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: "guild-1",
          name: "Test Panel",
          type: "button",
          mode: "toggle",
          channelId: "ch-1",
          createdBy: "user-1",
        }),
      );
    });

    it("returns 400 on invalid type", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/role-panels",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "Test",
          type: "invalid",
          channelId: "ch-1",
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when name is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/role-panels",
        cookies: { session: app.signCookie("valid") },
        payload: {
          type: "button",
          channelId: "ch-1",
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PUT /api/guilds/:guildId/role-panels/:panelId", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/role-panels/1",
        payload: { name: "Updated" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("updates a panel on valid request", async () => {
      mockUpdateRolePanel.mockResolvedValueOnce({ ...mockPanel, name: "Updated" });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/role-panels/1",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "Updated" },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpdateRolePanel).toHaveBeenCalledWith(1, "guild-1", expect.objectContaining({ name: "Updated" }));
    });

    it("returns 400 for invalid panel ID", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/role-panels/abc",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "Updated" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 404 when panel not found", async () => {
      mockUpdateRolePanel.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/role-panels/999",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "Updated" },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/guilds/:guildId/role-panels/:panelId", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/role-panels/1",
      });
      expect(res.statusCode).toBe(401);
    });

    it("deletes a panel on valid request", async () => {
      mockDeleteRolePanel.mockResolvedValueOnce(true);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/role-panels/1",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
    });

    it("returns 404 when panel not found", async () => {
      mockDeleteRolePanel.mockResolvedValueOnce(false);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/role-panels/999",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for invalid panel ID", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/role-panels/abc",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/guilds/:guildId/role-panels/:panelId/send", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/role-panels/1/send",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns panel data for sending", async () => {
      mockGetRolePanel.mockResolvedValueOnce(mockPanel);

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/role-panels/1/send",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("returns 404 when panel not found", async () => {
      mockGetRolePanel.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/role-panels/999/send",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when panel has no roles", async () => {
      mockGetRolePanel.mockResolvedValueOnce({ ...mockPanel, roles: [] });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/role-panels/1/send",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
