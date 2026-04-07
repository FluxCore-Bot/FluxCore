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

vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: vi.fn().mockResolvedValue(true),
  getGuildOwnerId: vi.fn().mockResolvedValue("owner-1"),
}));

const mockResolveUserPermissions = vi.fn();
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: (...args: unknown[]) => mockResolveUserPermissions(...args),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockFindMany = vi.fn().mockResolvedValue([]);
const mockCount = vi.fn().mockResolvedValue(0);
vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({
    dashboardAuditLog: { findMany: mockFindMany, count: mockCount },
    dashboardUserPermission: { findMany: vi.fn() },
  }),
}));
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

describe("GET /api/guilds/:guildId/dashboard-audit — userId filter", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(callerSession);
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["dashboard.audit.view"]),
      isOwner: false,
    });
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    app = await buildApp();
  });

  it("forces userId filter to caller for non-owner", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?userId=other-user",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ guildId: "guild-1", userId: "caller-1" }),
      }),
    );
  });

  it("allows owner to filter by any userId", async () => {
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["*"]),
      isOwner: true,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?userId=other-user",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "other-user" }),
      }),
    );
  });
});

describe("GET /api/guilds/:guildId/dashboard-audit — date validation", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(callerSession);
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["*"]),
      isOwner: true,
    });
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    app = await buildApp();
  });

  it("returns 400 when from is not a valid date", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?from=not-a-date",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/from/i);
  });

  it("returns 400 when to is not a valid date", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?to=garbage",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/to/i);
  });

  it("accepts valid ISO dates", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?from=2026-01-01T00:00:00Z&to=2026-04-01T00:00:00Z",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /dashboard-audit — action filter is exact-match", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(callerSession);
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["*"]),
      isOwner: true,
    });
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    app = await buildApp();
  });

  it("uses exact match (not contains) when action is allowlisted", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?action=dashboard.permissions.update",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: "dashboard.permissions.update" }),
      }),
    );
  });

  it("returns 400 when action is not in the allowlist", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/dashboard-audit?action=permissions",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(400);
  });
});
