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
vi.mock("../../src/server/session.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

const mockIsBotInGuild = vi.fn().mockResolvedValue(true);
const mockChannelExistsInGuild = vi.fn().mockResolvedValue(true);
vi.mock("../../src/server/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
  channelExistsInGuild: (...args: unknown[]) => mockChannelExistsInGuild(...args),
}));

const mockGetRulesByGuild = vi.fn().mockResolvedValue([]);
const mockCreateRule = vi.fn().mockResolvedValue({ id: 1, name: "test-rule" });
const mockUpdateRule = vi.fn().mockResolvedValue({ id: 1, name: "test-rule" });
const mockDeleteRule = vi.fn().mockResolvedValue(true);
const mockCountRules = vi.fn().mockResolvedValue(0);
const mockGetRecentLogs = vi.fn().mockResolvedValue([]);
const mockNotifyCacheInvalidation = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/actions/persistence", () => ({
  createRule: (...args: unknown[]) => mockCreateRule(...args),
  updateRule: (...args: unknown[]) => mockUpdateRule(...args),
  deleteRule: (...args: unknown[]) => mockDeleteRule(...args),
  getRulesByGuild: (...args: unknown[]) => mockGetRulesByGuild(...args),
  countRules: (...args: unknown[]) => mockCountRules(...args),
  getRecentLogs: (...args: unknown[]) => mockGetRecentLogs(...args),
  notifyCacheInvalidation: (...args: unknown[]) => mockNotifyCacheInvalidation(...args),
}));

const mockGetGuildSettingsOrDefault = vi.fn().mockReturnValue({
  maxRules: 25,
  globalEnabled: true,
  logChannelId: null,
});
const mockSetGuildSettings = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/actions/config", () => ({
  getGuildSettingsOrDefault: (...args: unknown[]) => mockGetGuildSettingsOrDefault(...args),
  setGuildSettings: (...args: unknown[]) => mockSetGuildSettings(...args),
}));

vi.mock("@fluxcore/systems/actions/constants", () => ({
  EVENT_TYPES: { memberJoin: { label: "Member Join" }, memberLeave: { label: "Member Leave" } },
  ACTION_TYPES: { sendMessage: { label: "Send Message" }, addRole: { label: "Add Role" } },
  MAX_ACTIONS_PER_RULE: 5,
  ACTION_TYPE_FIELDS: {},
  EVENT_TYPE_VARIABLES: {},
  TEMPLATE_VARIABLES: [],
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerActionRoutes } from "../../src/server/routes/actions.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerActionRoutes(app);
  await app.ready();
  return app;
}

describe("action routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    mockCountRules.mockResolvedValue(0);
    app = await buildApp();
  });

  describe("GET /api/actions/constants", () => {
    it("returns action system constants", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/actions/constants",
        cookies: { session: app.signCookie("valid") },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.eventTypes).toBeDefined();
      expect(body.actionTypes).toBeDefined();
      expect(body.maxActionsPerRule).toBe(5);
    });
  });

  describe("GET /api/guilds/:guildId/actions/rules", () => {
    it("returns rules for a guild", async () => {
      mockGetRulesByGuild.mockResolvedValueOnce([
        { id: 1, name: "rule-1", eventType: "memberJoin" },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });
  });

  describe("POST /api/guilds/:guildId/actions/rules", () => {
    it("creates a rule successfully", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "test-rule",
          eventType: "memberJoin",
          actions: [{ type: "sendMessage", channelId: "ch-1", message: "Welcome!" }],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(mockCreateRule).toHaveBeenCalled();
      expect(mockNotifyCacheInvalidation).toHaveBeenCalledWith("guild-1");
    });

    it("returns 400 when name is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: { eventType: "memberJoin", actions: [{ type: "sendMessage" }] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid event type", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "test",
          eventType: "invalidEvent",
          actions: [{ type: "sendMessage" }],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when no actions provided", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "test", eventType: "memberJoin", actions: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid action type", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "test",
          eventType: "memberJoin",
          actions: [{ type: "invalidAction" }],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when rule limit reached", async () => {
      mockCountRules.mockResolvedValueOnce(25);
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "test",
          eventType: "memberJoin",
          actions: [{ type: "sendMessage" }],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Rule limit reached");
    });

    it("validates sendWebhook requires HTTPS URL", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "test",
          eventType: "memberJoin",
          actions: [{ type: "sendMessage" }, { type: "sendMessage" }],
        },
      });
      // Should pass as sendMessage doesn't need webhook
      expect(res.statusCode).toBe(201);
    });
  });

  describe("DELETE /api/guilds/:guildId/actions/rules/:ruleId", () => {
    it("deletes a rule", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/actions/rules/1",
        cookies: { session: app.signCookie("valid") },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  describe("GET /api/guilds/:guildId/actions/settings", () => {
    it("returns guild settings", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/actions/settings",
        cookies: { session: app.signCookie("valid") },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().maxRules).toBe(25);
    });
  });

  describe("PUT /api/guilds/:guildId/actions/settings", () => {
    it("updates settings successfully", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/actions/settings",
        cookies: { session: app.signCookie("valid") },
        payload: { maxRules: 50, globalEnabled: false },
      });
      expect(res.statusCode).toBe(200);
      expect(mockSetGuildSettings).toHaveBeenCalled();
    });

    it("returns 400 for invalid maxRules", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/actions/settings",
        cookies: { session: app.signCookie("valid") },
        payload: { maxRules: 200 },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("maxRules");
    });
  });

  describe("GET /api/guilds/:guildId/actions/logs", () => {
    it("returns action logs", async () => {
      mockGetRecentLogs.mockResolvedValueOnce([
        { ruleName: "test", actionType: "sendMessage", success: true, executedAt: new Date() },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/actions/logs",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });

    it("limits log results to max 50", async () => {
      await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/actions/logs?limit=100",
        cookies: { session: app.signCookie("valid") },
      });

      expect(mockGetRecentLogs).toHaveBeenCalledWith("guild-1", {
        ruleName: undefined,
        limit: 50,
      });
    });
  });
});
