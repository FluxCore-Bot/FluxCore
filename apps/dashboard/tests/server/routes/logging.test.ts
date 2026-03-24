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
vi.mock("../../src/server/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
}));

const mockLoadLogConfigs = vi.fn().mockResolvedValue([]);
const mockGetLogConfig = vi.fn().mockResolvedValue(null);
const mockUpsertLogConfig = vi.fn().mockResolvedValue({
  id: 1,
  guildId: "guild-1",
  category: "message",
  channelId: "ch-1",
  enabled: true,
  ignoredChannels: [],
  ignoredRoles: [],
  enabledEvents: [],
});
vi.mock("@fluxcore/systems/logging/config", () => ({
  loadLogConfigs: (...args: unknown[]) => mockLoadLogConfigs(...args),
  getLogConfig: (...args: unknown[]) => mockGetLogConfig(...args),
  upsertLogConfig: (...args: unknown[]) => mockUpsertLogConfig(...args),
}));

const mockGetLogEntries = vi.fn().mockResolvedValue({ entries: [], total: 0 });
const mockCleanOldLogEntries = vi.fn().mockResolvedValue(5);
vi.mock("@fluxcore/systems/logging/persistence", () => ({
  getLogEntries: (...args: unknown[]) => mockGetLogEntries(...args),
  cleanOldLogEntries: (...args: unknown[]) => mockCleanOldLogEntries(...args),
}));

vi.mock("@fluxcore/systems/logging/constants", () => ({
  LOG_CATEGORIES: ["message", "member", "voice", "channel", "role", "server", "moderation"],
  EVENT_TYPES_BY_CATEGORY: {
    message: ["messageDelete", "messageUpdate"],
    member: ["memberJoin", "memberLeave"],
    voice: ["voiceJoin", "voiceLeave"],
    channel: ["channelCreate"],
    role: ["roleCreate"],
    server: ["serverUpdate"],
    moderation: ["modWarn"],
  },
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerLoggingRoutes } from "../../src/server/routes/logging.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerLoggingRoutes(app);
  await app.ready();
  return app;
}

describe("logging routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    app = await buildApp();
  });

  describe("GET /api/guilds/:guildId/logs", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/logs",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns log entries on success", async () => {
      mockGetLogEntries.mockResolvedValueOnce({
        entries: [{ id: 1, guildId: "guild-1", category: "message", eventType: "messageDelete" }],
        total: 1,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/logs",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entries).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it("passes query filters to getLogEntries", async () => {
      await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/logs?category=message&page=2&limit=10",
        cookies: { session: app.signCookie("valid") },
      });

      expect(mockGetLogEntries).toHaveBeenCalledWith(
        "guild-1",
        expect.objectContaining({
          category: "message",
          page: 2,
          limit: 10,
        }),
      );
    });
  });

  describe("GET /api/guilds/:guildId/log-config", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/log-config",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns configs and metadata on success", async () => {
      mockLoadLogConfigs.mockResolvedValueOnce([
        { id: 1, guildId: "guild-1", category: "message", channelId: "ch-1", enabled: true },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/log-config",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.configs).toHaveLength(1);
      expect(body.categories).toBeDefined();
      expect(body.eventTypes).toBeDefined();
    });
  });

  describe("PUT /api/guilds/:guildId/log-config/:category", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/log-config/message",
        payload: { channelId: "ch-1" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 for invalid category", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/log-config/invalid-category",
        cookies: { session: app.signCookie("valid") },
        payload: { channelId: "ch-1" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Invalid log category");
    });

    it("upserts config on valid request", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/log-config/message",
        cookies: { session: app.signCookie("valid") },
        payload: {
          channelId: "ch-1",
          enabled: true,
          ignoredChannels: ["ch-2"],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpsertLogConfig).toHaveBeenCalledWith(
        "guild-1",
        "message",
        expect.objectContaining({
          channelId: "ch-1",
          enabled: true,
          ignoredChannels: ["ch-2"],
        }),
      );
    });

    it("returns 403 when user lacks guild permissions", async () => {
      mockGetSession.mockResolvedValueOnce({
        ...mockSession,
        guilds: [{ id: "guild-1", name: "Test", permissions: "0" }],
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/log-config/message",
        cookies: { session: app.signCookie("valid") },
        payload: { channelId: "ch-1" },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/guilds/:guildId/logs", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/logs",
      });
      expect(res.statusCode).toBe(401);
    });

    it("purges old logs and returns count", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/logs",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().purged).toBe(5);
      expect(mockCleanOldLogEntries).toHaveBeenCalled();
    });
  });
});
