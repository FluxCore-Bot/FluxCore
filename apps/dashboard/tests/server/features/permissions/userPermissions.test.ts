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
const callerSession = {
  userId: "caller-1",
  username: "caller",
  guilds: [{ id: "guild-1", name: "Test", permissions: MANAGE_GUILD.toString() }],
};

const mockGetSession = vi.fn().mockResolvedValue(callerSession);
vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));

const mockGetGuildOwnerId = vi.fn().mockResolvedValue("owner-1");
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: vi.fn().mockResolvedValue(true),
  getGuildOwnerId: (...args: unknown[]) => mockGetGuildOwnerId(...args),
}));

const mockResolveUserPermissions = vi.fn();
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: (...args: unknown[]) => mockResolveUserPermissions(...args),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = {
  dashboardUserPermission: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  dashboardAuditLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

vi.mock("@fluxcore/database", () => ({ getPrisma: () => mockPrisma }));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerDashboardPermissionRoutes } from "../../../../src/server/features/permissions/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerDashboardPermissionRoutes(app);
  await app.ready();
  return app;
}

describe("PUT /api/guilds/:guildId/user-permissions/:userId — escalation guards", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(callerSession);
    mockGetGuildOwnerId.mockResolvedValue("owner-1");
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["dashboard.roles.manage"]),
      isOwner: false,
      isGuildAdmin: true,
    });
    app = await buildApp();
  });

  it("rejects self-grant with 403", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/user-permissions/caller-1",
      cookies: { session: app.signCookie("valid") },
      payload: { permissions: ["dashboard.roles.view"] },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/own/i);
  });

  it("rejects non-owner attempting to grant a wildcard they do not literally hold", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/user-permissions/target-1",
      cookies: { session: app.signCookie("valid") },
      payload: { permissions: ["dashboard.*"] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects non-owner attempting to grant the global wildcard", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/user-permissions/target-1",
      cookies: { session: app.signCookie("valid") },
      payload: { permissions: ["*"] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects when caller does not literally hold the requested key", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/user-permissions/target-1",
      cookies: { session: app.signCookie("valid") },
      payload: { permissions: ["actions.rules.manage"] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows owner to grant any permission, including self", async () => {
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["*"]),
      isOwner: true,
      isGuildAdmin: true,
    });
    mockGetSession.mockResolvedValue({ ...callerSession, userId: "owner-1" });
    mockGetGuildOwnerId.mockResolvedValue("owner-2");
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/user-permissions/target-1",
      cookies: { session: app.signCookie("valid") },
      payload: { permissions: ["actions.rules.manage"] },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("PUT /user-permissions — error response does not leak key", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(callerSession);
    mockGetGuildOwnerId.mockResolvedValue("owner-1");
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["dashboard.roles.manage"]),
      isOwner: false,
      isGuildAdmin: true,
    });
    app = await buildApp();
  });

  it("does not echo the failed permission key in the error body", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/user-permissions/target-1",
      cookies: { session: app.signCookie("valid") },
      payload: { permissions: ["actions.rules.manage"] },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body).not.toHaveProperty("permission");
    expect(JSON.stringify(body)).not.toContain("actions.rules.manage");
  });
});
