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

const mockGetScheduledMessages = vi.fn().mockResolvedValue({ messages: [], total: 0 });
const mockGetScheduledMessageById = vi.fn().mockResolvedValue(null);
const mockCreateScheduledMessage = vi.fn().mockResolvedValue({
  id: 1,
  guildId: "guild-1",
  channelId: "ch-1",
  name: "Daily Announcement",
  message: { type: "text", content: "Hello!" },
  cronExpr: "0 9 * * *",
  timezone: "UTC",
  enabled: true,
  lastRunAt: null,
  nextRunAt: new Date().toISOString(),
  createdBy: "user-1",
  createdAt: new Date(),
});
const mockUpdateScheduledMessage = vi.fn().mockResolvedValue({
  id: 1,
  guildId: "guild-1",
  channelId: "ch-1",
  name: "Updated",
  message: { type: "text", content: "Updated!" },
  cronExpr: "0 9 * * *",
  timezone: "UTC",
  enabled: false,
  lastRunAt: null,
  nextRunAt: null,
  createdBy: "user-1",
  createdAt: new Date(),
});
const mockDeleteScheduledMessage = vi.fn().mockResolvedValue(true);

vi.mock("@fluxcore/systems/scheduled-messages/persistence", () => ({
  getScheduledMessages: (...args: unknown[]) => mockGetScheduledMessages(...args),
  getScheduledMessageById: (...args: unknown[]) => mockGetScheduledMessageById(...args),
  createScheduledMessage: (...args: unknown[]) => mockCreateScheduledMessage(...args),
  updateScheduledMessage: (...args: unknown[]) => mockUpdateScheduledMessage(...args),
  deleteScheduledMessage: (...args: unknown[]) => mockDeleteScheduledMessage(...args),
}));

const mockValidateCronExpression = vi.fn().mockReturnValue(null);
const mockGetNextCronRun = vi.fn().mockReturnValue(new Date("2026-04-01T09:00:00Z"));
vi.mock("@fluxcore/systems/scheduled-messages/cron", () => ({
  validateCronExpression: (...args: unknown[]) => mockValidateCronExpression(...args),
  getNextCronRun: (...args: unknown[]) => mockGetNextCronRun(...args),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerScheduledMessageRoutes } from "../../src/server/routes/scheduled-messages.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerScheduledMessageRoutes(app);
  await app.ready();
  return app;
}

describe("scheduled-messages routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    mockValidateCronExpression.mockReturnValue(null);
    app = await buildApp();
  });

  // --- List ---
  describe("GET /api/guilds/:guildId/scheduled-messages", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/scheduled-messages",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns messages list on success", async () => {
      mockGetScheduledMessages.mockResolvedValueOnce({
        messages: [
          {
            id: 1,
            guildId: "guild-1",
            name: "Test",
            channelId: "ch-1",
            cronExpr: "0 9 * * *",
            timezone: "UTC",
            enabled: true,
            message: { type: "text", content: "Hello" },
            lastRunAt: null,
            nextRunAt: new Date().toISOString(),
            createdBy: "user-1",
            createdAt: new Date(),
          },
        ],
        total: 1,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/scheduled-messages",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.messages).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it("passes page and limit query params", async () => {
      await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/scheduled-messages?page=2&limit=5",
        cookies: { session: app.signCookie("valid") },
      });

      expect(mockGetScheduledMessages).toHaveBeenCalledWith("guild-1", 2, 5);
    });
  });

  // --- Create ---
  describe("POST /api/guilds/:guildId/scheduled-messages", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/scheduled-messages",
        payload: {
          channelId: "ch-1",
          name: "Test",
          message: { type: "text", content: "Hello" },
          cronExpr: "0 9 * * *",
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it("creates message on valid request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/scheduled-messages",
        cookies: { session: app.signCookie("valid") },
        payload: {
          channelId: "ch-1",
          name: "Daily Announcement",
          message: { type: "text", content: "Hello!" },
          cronExpr: "0 9 * * *",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(mockCreateScheduledMessage).toHaveBeenCalledWith("guild-1", {
        channelId: "ch-1",
        name: "Daily Announcement",
        message: { type: "text", content: "Hello!" },
        cronExpr: "0 9 * * *",
        timezone: undefined,
        enabled: undefined,
        createdBy: "user-1",
      });
    });

    it("returns 400 for invalid cron expression", async () => {
      mockValidateCronExpression.mockReturnValueOnce("Invalid cron");

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/scheduled-messages",
        cookies: { session: app.signCookie("valid") },
        payload: {
          channelId: "ch-1",
          name: "Bad Cron",
          message: { type: "text", content: "Hello" },
          cronExpr: "invalid",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toContain("Invalid cron");
    });

    it("returns 400 for missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/scheduled-messages",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "Test" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when guild limit reached", async () => {
      mockCreateScheduledMessage.mockRejectedValueOnce(new Error("Maximum of 25 scheduled messages per guild"));

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/scheduled-messages",
        cookies: { session: app.signCookie("valid") },
        payload: {
          channelId: "ch-1",
          name: "Over Limit",
          message: { type: "text", content: "test" },
          cronExpr: "0 9 * * *",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toContain("Maximum");
    });

    it("returns 400 for duplicate name", async () => {
      mockCreateScheduledMessage.mockRejectedValueOnce(new Error("Unique constraint failed"));

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/scheduled-messages",
        cookies: { session: app.signCookie("valid") },
        payload: {
          channelId: "ch-1",
          name: "Duplicate",
          message: { type: "text", content: "test" },
          cronExpr: "0 9 * * *",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toContain("already exists");
    });

    it("returns 403 when user lacks guild permissions", async () => {
      mockGetSession.mockResolvedValueOnce({
        ...mockSession,
        guilds: [{ id: "guild-1", name: "Test", permissions: "0" }],
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/scheduled-messages",
        cookies: { session: app.signCookie("valid") },
        payload: {
          channelId: "ch-1",
          name: "No Perms",
          message: { type: "text", content: "test" },
          cronExpr: "0 9 * * *",
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // --- Update ---
  describe("PUT /api/guilds/:guildId/scheduled-messages/:id", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/scheduled-messages/1",
        payload: { enabled: false },
      });
      expect(res.statusCode).toBe(401);
    });

    it("updates message on valid request", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/scheduled-messages/1",
        cookies: { session: app.signCookie("valid") },
        payload: { enabled: false, name: "Updated" },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpdateScheduledMessage).toHaveBeenCalledWith(1, "guild-1", {
        enabled: false,
        name: "Updated",
      });
    });

    it("returns 404 when message not found", async () => {
      mockUpdateScheduledMessage.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/scheduled-messages/999",
        cookies: { session: app.signCookie("valid") },
        payload: { enabled: false },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for invalid message ID", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/scheduled-messages/invalid",
        cookies: { session: app.signCookie("valid") },
        payload: { enabled: false },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid cron in update", async () => {
      mockValidateCronExpression.mockReturnValueOnce("Bad cron");

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/scheduled-messages/1",
        cookies: { session: app.signCookie("valid") },
        payload: { cronExpr: "bad" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- Delete ---
  describe("DELETE /api/guilds/:guildId/scheduled-messages/:id", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/scheduled-messages/1",
      });
      expect(res.statusCode).toBe(401);
    });

    it("deletes message on valid request", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/scheduled-messages/1",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(mockDeleteScheduledMessage).toHaveBeenCalledWith(1, "guild-1");
    });

    it("returns 404 when message not found", async () => {
      mockDeleteScheduledMessage.mockResolvedValueOnce(false);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/scheduled-messages/999",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for invalid message ID", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/scheduled-messages/invalid",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- Test Send ---
  describe("POST /api/guilds/:guildId/scheduled-messages/:id/test", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/scheduled-messages/1/test",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns message data for test send", async () => {
      mockGetScheduledMessageById.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-1",
        channelId: "ch-1",
        name: "Test",
        message: { type: "text", content: "Hello" },
        cronExpr: "0 9 * * *",
        timezone: "UTC",
        enabled: true,
        lastRunAt: null,
        nextRunAt: new Date(),
        createdBy: "user-1",
        createdAt: new Date(),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/scheduled-messages/1/test",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.channelId).toBe("ch-1");
    });

    it("returns 404 when message not found", async () => {
      mockGetScheduledMessageById.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/scheduled-messages/999/test",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // --- Cron Preview ---
  describe("GET /api/guilds/:guildId/scheduled-messages/preview-cron", () => {
    it("returns 400 without cronExpr parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/scheduled-messages/preview-cron",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns next run times on valid cron", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/scheduled-messages/preview-cron?cronExpr=0+9+*+*+*",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.nextRuns).toBeDefined();
      expect(body.nextRuns.length).toBeGreaterThan(0);
    });

    it("returns 400 for invalid cron in preview", async () => {
      mockValidateCronExpression.mockReturnValueOnce("Invalid");

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/scheduled-messages/preview-cron?cronExpr=bad",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
