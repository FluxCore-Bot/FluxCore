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

const mockGetCustomCommands = vi.fn().mockResolvedValue([]);
const mockGetCustomCommandById = vi.fn().mockResolvedValue(null);
const mockGetCustomCommandCount = vi.fn().mockResolvedValue(0);
const mockCreateCustomCommand = vi.fn().mockResolvedValue({
  id: 1,
  guildId: "guild-1",
  name: "hello",
  triggerType: "command",
  response: { type: "text", content: "Hi!" },
  actions: [],
  enabled: true,
  cooldown: 0,
  allowedRoles: [],
  allowedChannels: [],
  deletesTrigger: false,
  dmResponse: false,
  createdBy: "user-1",
  createdAt: new Date().toISOString(),
});
const mockUpdateCustomCommand = vi.fn().mockResolvedValue({
  id: 1,
  guildId: "guild-1",
  name: "hello",
  triggerType: "command",
  response: { type: "text", content: "Updated!" },
  actions: [],
  enabled: true,
  cooldown: 0,
  allowedRoles: [],
  allowedChannels: [],
  deletesTrigger: false,
  dmResponse: false,
  createdBy: "user-1",
  createdAt: new Date().toISOString(),
});
const mockDeleteCustomCommand = vi.fn().mockResolvedValue(true);

vi.mock("@fluxcore/systems/customCommands/persistence", () => ({
  getCustomCommands: (...args: unknown[]) => mockGetCustomCommands(...args),
  getCustomCommandById: (...args: unknown[]) => mockGetCustomCommandById(...args),
  getCustomCommandCount: (...args: unknown[]) => mockGetCustomCommandCount(...args),
  createCustomCommand: (...args: unknown[]) => mockCreateCustomCommand(...args),
  updateCustomCommand: (...args: unknown[]) => mockUpdateCustomCommand(...args),
  deleteCustomCommand: (...args: unknown[]) => mockDeleteCustomCommand(...args),
}));

vi.mock("@fluxcore/systems/customCommands/constants", () => ({
  MAX_COMMANDS_PER_GUILD: 50,
  TRIGGER_TYPES: ["command", "keyword", "startsWith", "regex"],
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerCustomCommandRoutes } from "../../../../src/server/features/commands/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerCustomCommandRoutes(app);
  await app.ready();
  return app;
}

describe("custom command routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    app = await buildApp();
  });

  // --- List ---
  describe("GET /api/guilds/:guildId/custom-commands", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/custom-commands",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns commands on success", async () => {
      mockGetCustomCommands.mockResolvedValueOnce([
        {
          id: 1,
          guildId: "guild-1",
          name: "hello",
          triggerType: "command",
          response: { type: "text", content: "Hi!" },
          actions: [],
          enabled: true,
          cooldown: 0,
          allowedRoles: [],
          allowedChannels: [],
          deletesTrigger: false,
          dmResponse: false,
          createdBy: "user-1",
          createdAt: new Date().toISOString(),
        },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/custom-commands",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("hello");
    });

    it("returns 403 when user lacks guild permissions", async () => {
      mockGetSession.mockResolvedValueOnce({
        ...mockSession,
        guilds: [{ id: "guild-1", name: "Test", permissions: "0" }],
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/custom-commands",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // --- Create ---
  describe("POST /api/guilds/:guildId/custom-commands", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/custom-commands",
        payload: { name: "hello", triggerType: "command" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("creates command on valid request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/custom-commands",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "hello",
          triggerType: "command",
          response: { type: "text", content: "Hi there!" },
        },
      });

      expect(res.statusCode).toBe(201);
      expect(mockCreateCustomCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: "guild-1",
          name: "hello",
          triggerType: "command",
          createdBy: "user-1",
        }),
      );
    });

    it("returns 400 when at guild limit", async () => {
      mockGetCustomCommandCount.mockResolvedValueOnce(50);

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/custom-commands",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "hello", triggerType: "command" },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toContain("Maximum");
    });

    it("returns 400 for missing name", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/custom-commands",
        cookies: { session: app.signCookie("valid") },
        payload: { triggerType: "command" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid trigger type", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/custom-commands",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "hello", triggerType: "invalid" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid regex pattern", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/custom-commands",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "[invalid", triggerType: "regex" },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toContain("regex");
    });

    it("returns 400 for duplicate command name", async () => {
      mockCreateCustomCommand.mockRejectedValueOnce(new Error("Unique constraint"));

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/custom-commands",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "hello", triggerType: "command" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- Update ---
  describe("PUT /api/guilds/:guildId/custom-commands/:id", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/custom-commands/1",
        payload: { enabled: false },
      });
      expect(res.statusCode).toBe(401);
    });

    it("updates command on valid request", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/custom-commands/1",
        cookies: { session: app.signCookie("valid") },
        payload: { enabled: false, cooldown: 30 },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpdateCustomCommand).toHaveBeenCalledWith(
        1,
        "guild-1",
        expect.objectContaining({ enabled: false, cooldown: 30 }),
      );
    });

    it("returns 400 for invalid ID", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/custom-commands/invalid",
        cookies: { session: app.signCookie("valid") },
        payload: { enabled: false },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 404 when command not found", async () => {
      mockUpdateCustomCommand.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/custom-commands/999",
        cookies: { session: app.signCookie("valid") },
        payload: { enabled: false },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // --- Delete ---
  describe("DELETE /api/guilds/:guildId/custom-commands/:id", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/custom-commands/1",
      });
      expect(res.statusCode).toBe(401);
    });

    it("deletes command on valid request", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/custom-commands/1",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(mockDeleteCustomCommand).toHaveBeenCalledWith(1, "guild-1");
    });

    it("returns 400 for invalid ID", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/custom-commands/invalid",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 404 when command not found", async () => {
      mockDeleteCustomCommand.mockResolvedValueOnce(false);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/custom-commands/999",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
