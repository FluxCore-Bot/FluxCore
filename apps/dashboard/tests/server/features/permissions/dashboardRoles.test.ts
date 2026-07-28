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
const mockGetGuildOwnerId = vi.fn().mockResolvedValue("owner-1");
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
  getGuildOwnerId: (...args: unknown[]) => mockGetGuildOwnerId(...args),
}));

const mockResolveUserPermissions = vi.fn();
vi.mock("../../../../src/server/shared/permissions.js", async (importOriginal) => {
  // safeParsePermissions is kept real (rather than re-stubbed) so the
  // isDefault-promotion and role-assignment escalation guards — which parse
  // a role's persisted `permissions` column via this helper — behave exactly
  // as they do outside tests.
  const actual =
    await importOriginal<typeof import("../../../../src/server/shared/permissions.js")>();
  return {
    safeParsePermissions: actual.safeParsePermissions,
    resolveUserPermissions: (...args: unknown[]) => mockResolveUserPermissions(...args),
    hasPermission: vi.fn().mockReturnValue(true),
    invalidatePermissionCache: vi.fn(),
    createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
  };
});

const mockPrisma = {
  dashboardRole: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _max: { position: 0 } }),
  },
  dashboardRoleAssignment: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    delete: vi.fn(),
  },
  dashboardAuditLog: {
    create: vi.fn().mockResolvedValue(undefined),
  },
  $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockPrisma)),
};

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerDashboardRoleRoutes } from "../../../../src/server/features/permissions/roles-routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerDashboardRoleRoutes(app);
  await app.ready();
  return app;
}

describe("dashboard role routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["*"]),
      isOwner: true,
      isGuildAdmin: true,
      isGuildMember: true,
    });
    mockPrisma.dashboardRole.count.mockResolvedValue(0);
    mockPrisma.dashboardRole.aggregate.mockResolvedValue({ _max: { position: 0 } });
    app = await buildApp();
  });

  describe("GET /api/guilds/:guildId/dashboard-roles", () => {
    it("returns empty array when no roles", async () => {
      mockPrisma.dashboardRole.findMany.mockResolvedValue([]);
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/dashboard-roles",
        cookies: { session: app.signCookie("valid") },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns 401 without session", async () => {
      mockGetSession.mockResolvedValue(null);
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/dashboard-roles",
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/guilds/:guildId/dashboard-roles", () => {
    it("creates a role successfully", async () => {
      mockPrisma.dashboardRole.create.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Moderator",
        color: "#ff6e84",
        position: 1,
        isDefault: false,
        permissions: '["moderation.*"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "Moderator", color: "#ff6e84", permissions: ["moderation.*"] },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().name).toBe("Moderator");
      expect(mockPrisma.dashboardRole.create).toHaveBeenCalled();
    });

    it("returns 400 when name is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles",
        cookies: { session: app.signCookie("valid") },
        payload: { permissions: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when role limit reached", async () => {
      mockPrisma.dashboardRole.count.mockResolvedValue(25);
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "New Role", permissions: [] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("limit");
    });

    it("returns 400 for invalid permission key", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "Bad Role", permissions: ["not.a.real.permission.key"] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Invalid permission");
    });

    it("returns 400 for invalid color format", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "Bad Color", color: "not-a-color", permissions: [] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("color");
    });
  });

  describe("DELETE /api/guilds/:guildId/dashboard-roles/:roleId", () => {
    it("deletes a role successfully", async () => {
      mockPrisma.dashboardRole.findUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Test",
      });
      mockPrisma.dashboardRole.delete.mockResolvedValue({});

      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/dashboard-roles/role-1",
        cookies: { session: app.signCookie("valid") },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("returns 404 for non-existent role", async () => {
      mockPrisma.dashboardRole.findUnique.mockResolvedValue(null);
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/dashboard-roles/nonexistent",
        cookies: { session: app.signCookie("valid") },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/guilds/:guildId/dashboard-roles/from-preset", () => {
    it("creates role from moderator preset", async () => {
      mockPrisma.dashboardRole.create.mockResolvedValue({
        id: "role-2",
        guildId: "guild-1",
        name: "Moderator",
        color: "#ff6e84",
        position: 1,
        isDefault: false,
        permissions: '["moderation.*"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles/from-preset",
        cookies: { session: app.signCookie("valid") },
        payload: { preset: "moderator" },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().name).toBe("Moderator");
    });

    it("returns 400 for unknown preset", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles/from-preset",
        cookies: { session: app.signCookie("valid") },
        payload: { preset: "nonexistent" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("PUT /api/guilds/:guildId/dashboard-roles/:roleId", () => {
    it("refuses to promote a role to default when the caller lacks the role's permissions", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["dashboard.roles.manage", "tickets.list.view"]),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      mockPrisma.dashboardRole.findUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Full Admin",
        permissions: JSON.stringify(["*"]),
        isDefault: false,
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/dashboard-roles/role-1",
        cookies: { session: app.signCookie("valid") },
        payload: { isDefault: true },
      });

      expect(res.statusCode).toBe(403);
      expect(mockPrisma.dashboardRole.update).not.toHaveBeenCalled();
    });

    it("lets the owner promote any role to default", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["*"]),
        isOwner: true,
        isGuildAdmin: true,
        isGuildMember: true,
      });
      mockPrisma.dashboardRole.findUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Full Admin",
        permissions: JSON.stringify(["*"]),
        isDefault: false,
      });
      mockPrisma.dashboardRole.update.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Full Admin",
        color: null,
        position: 1,
        isDefault: true,
        permissions: JSON.stringify(["*"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/dashboard-roles/role-1",
        cookies: { session: app.signCookie("valid") },
        payload: { isDefault: true },
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.dashboardRole.update).toHaveBeenCalled();
    });

    it("lets a caller holding the role's permissions promote it to default", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["dashboard.roles.manage", "tickets.*"]),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      mockPrisma.dashboardRole.findUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Ticket Staff",
        permissions: JSON.stringify(["tickets.list.view"]),
        isDefault: false,
      });
      mockPrisma.dashboardRole.update.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Ticket Staff",
        color: null,
        position: 1,
        isDefault: true,
        permissions: JSON.stringify(["tickets.list.view"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/dashboard-roles/role-1",
        cookies: { session: app.signCookie("valid") },
        payload: { isDefault: true },
      });

      expect(res.statusCode).toBe(200);
    });

    it("does not block demoting a role from default (isDefault: false)", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["dashboard.roles.manage", "tickets.list.view"]),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      mockPrisma.dashboardRole.findUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Full Admin",
        permissions: JSON.stringify(["*"]),
        isDefault: true,
      });
      mockPrisma.dashboardRole.update.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Full Admin",
        color: null,
        position: 1,
        isDefault: false,
        permissions: JSON.stringify(["*"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/dashboard-roles/role-1",
        cookies: { session: app.signCookie("valid") },
        payload: { isDefault: false },
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.dashboardRole.update).toHaveBeenCalled();
    });
  });

  describe("POST /api/guilds/:guildId/dashboard-roles/:roleId/members", () => {
    it("refuses to assign a role holding permissions the caller lacks", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["dashboard.roles.manage"]),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      mockPrisma.dashboardRole.findUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Full Admin",
        permissions: JSON.stringify(["*"]),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles/role-1/members",
        cookies: { session: app.signCookie("valid") },
        payload: { userId: "user-2" },
      });

      expect(res.statusCode).toBe(403);
      expect(mockPrisma.dashboardRoleAssignment.create).not.toHaveBeenCalled();
    });

    it("refuses to assign any role to yourself", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["dashboard.roles.manage", "tickets.list.view"]),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      mockPrisma.dashboardRole.findUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Ticket Staff",
        permissions: JSON.stringify(["tickets.list.view"]),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles/role-1/members",
        cookies: { session: app.signCookie("valid") },
        payload: { userId: "user-1" },
      });

      expect(res.statusCode).toBe(403);
      expect(mockPrisma.dashboardRoleAssignment.create).not.toHaveBeenCalled();
    });

    it("lets the owner assign anything, including to themselves", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["*"]),
        isOwner: true,
        isGuildAdmin: true,
        isGuildMember: true,
      });
      mockPrisma.dashboardRole.findUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Full Admin",
        permissions: JSON.stringify(["*"]),
      });
      mockPrisma.dashboardRoleAssignment.create.mockResolvedValue({
        id: "assignment-1",
        userId: "user-1",
        assignedBy: "user-1",
        createdAt: new Date(),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles/role-1/members",
        cookies: { session: app.signCookie("valid") },
        payload: { userId: "user-1" },
      });

      expect(res.statusCode).toBe(201);
    });

    it("allows assigning a role whose permissions the caller holds", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["dashboard.roles.manage", "tickets.*"]),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      mockPrisma.dashboardRole.findUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Ticket Staff",
        permissions: JSON.stringify(["tickets.list.view"]),
      });
      mockPrisma.dashboardRoleAssignment.create.mockResolvedValue({
        id: "assignment-2",
        userId: "user-2",
        assignedBy: "user-1",
        createdAt: new Date(),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles/role-1/members",
        cookies: { session: app.signCookie("valid") },
        payload: { userId: "user-2" },
      });

      expect(res.statusCode).toBe(201);
    });
  });
});
