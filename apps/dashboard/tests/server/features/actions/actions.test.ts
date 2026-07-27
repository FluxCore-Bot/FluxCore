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
const mockChannelExistsInGuild = vi.fn().mockResolvedValue(true);
const mockGetGuildOwnerId = vi.fn().mockResolvedValue("owner-1");
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
  channelExistsInGuild: (...args: unknown[]) => mockChannelExistsInGuild(...args),
  getGuildOwnerId: (...args: unknown[]) => mockGetGuildOwnerId(...args),
}));

vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: vi.fn().mockResolvedValue({ permissions: new Set(["*"]), isOwner: false }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockGetRulesByGuild = vi.fn().mockResolvedValue([]);
const mockCreateRule = vi.fn().mockResolvedValue({ id: 1, name: "test-rule" });
const mockUpdateRule = vi.fn().mockResolvedValue({ id: 1, name: "test-rule" });
const mockDeleteRule = vi.fn().mockResolvedValue(true);
const mockCountRules = vi.fn().mockResolvedValue(0);
const mockGetRecentLogs = vi.fn().mockResolvedValue([]);
const mockNotifyCacheInvalidation = vi.fn().mockResolvedValue(undefined);
const mockGetLastFiredByGuild = vi.fn().mockResolvedValue(new Map());
const mockGetAnalytics = vi.fn().mockResolvedValue({});
const mockGetRuleAnalytics = vi.fn().mockResolvedValue({});
const mockBulkUpdateRules = vi.fn().mockResolvedValue(0);
const mockBulkDeleteRules = vi.fn().mockResolvedValue(0);
vi.mock("@fluxcore/systems/actions/persistence", () => ({
  createRule: (...args: unknown[]) => mockCreateRule(...args),
  updateRule: (...args: unknown[]) => mockUpdateRule(...args),
  deleteRule: (...args: unknown[]) => mockDeleteRule(...args),
  getRulesByGuild: (...args: unknown[]) => mockGetRulesByGuild(...args),
  countRules: (...args: unknown[]) => mockCountRules(...args),
  getRecentLogs: (...args: unknown[]) => mockGetRecentLogs(...args),
  notifyCacheInvalidation: (...args: unknown[]) => mockNotifyCacheInvalidation(...args),
  getLastFiredByGuild: (...args: unknown[]) => mockGetLastFiredByGuild(...args),
  getAnalytics: (...args: unknown[]) => mockGetAnalytics(...args),
  getRuleAnalytics: (...args: unknown[]) => mockGetRuleAnalytics(...args),
  bulkUpdateRules: (...args: unknown[]) => mockBulkUpdateRules(...args),
  bulkDeleteRules: (...args: unknown[]) => mockBulkDeleteRules(...args),
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

// `@fluxcore/systems/actions/constants` is deliberately NOT mocked. It is pure
// data with no I/O, and it is the single source of truth the route validates
// against — a stubbed ACTION_TYPE_FIELDS would make these tests assert a
// fiction (it previously did: the required-field contract was invisible, and
// half the action types read as "invalid action type").

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerActionRoutes } from "../../../../src/server/features/actions/routes.js";

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

    // Filters fail closed, so the editor must know which of them a given
    // trigger can actually satisfy — otherwise it lets users build a rule that
    // silently never fires.
    it("exposes which filter subjects each event type supports", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/actions/constants",
        cookies: { session: app.signCookie("valid") },
      });
      const body = res.json();

      expect(body.eventConditionSupport).toBeDefined();
      expect(body.eventConditionSupport.memberJoin).toEqual(
        expect.arrayContaining(["user", "role"]),
      );
      expect(body.eventConditionSupport.memberJoin).not.toContain("channel");
      expect(body.eventConditionSupport.memberBanned).not.toContain("role");
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
          actions: [{ type: "sendMessage", channelId: "1", message: "hi" }],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Rule limit reached");
    });

    it("rejects sendWebhook over plain HTTP", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "test",
          eventType: "memberJoin",
          actions: [{ type: "sendWebhook", webhook: { url: "http://example.com/hook" } }],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("HTTPS");
    });

    it("accepts sendWebhook over HTTPS", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "test",
          eventType: "memberJoin",
          actions: [{ type: "sendWebhook", webhook: { url: "https://example.com/hook" } }],
        },
      });
      expect(res.statusCode).toBe(201);
    });
  });

  // The client's Save button is only one gate, and it is not the one that
  // matters: the Undo-delete and Duplicate paths in rules.tsx re-POST a stored
  // action list without revalidating, and the API is public to any script. A
  // rule missing a required field can never execute, so the server must be the
  // one that refuses it.
  describe("POST /api/guilds/:guildId/actions/rules — required action fields", () => {
    it.each([
      ["sendMessage without a channel", { type: "sendMessage", message: "hi" }, "Channel"],
      ["sendMessage without a message", { type: "sendMessage", channelId: "1" }, "Message"],
      ["addRole without a role", { type: "addRole" }, "Role"],
      ["setNickname without a nickname", { type: "setNickname" }, "Nickname"],
      ["createThread without a thread name", { type: "createThread", channelId: "1" }, "Thread Name"],
      ["addReaction without an emoji", { type: "addReaction" }, "Emoji"],
    ])("rejects %s", async (_label, action, expectedField) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: { name: "test", eventType: "memberJoin", actions: [action] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain(expectedField);
    });

    it("accepts an action with every required field filled", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "test",
          eventType: "memberJoin",
          actions: [{ type: "sendMessage", channelId: "1", message: "hi" }],
        },
      });
      expect(res.statusCode).toBe(201);
    });

    it("treats a whitespace-only required field as missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "test",
          eventType: "memberJoin",
          actions: [{ type: "sendMessage", channelId: "1", message: "   " }],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    // The bot executes `steps` in preference to `actions` (executor.ts:274),
    // so validating only `actions` leaves the path that actually runs unchecked.
    it("rejects an action step whose required field is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "test",
          eventType: "memberJoin",
          actions: [{ type: "sendMessage", channelId: "1", message: "hi" }],
          entryStepId: "step_0",
          steps: [{ id: "step_0", type: "action", action: { type: "addRole" }, next: null }],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Role");
    });

    it("rejects an unknown action type inside a step", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "test",
          eventType: "memberJoin",
          actions: [{ type: "sendMessage", channelId: "1", message: "hi" }],
          entryStepId: "step_0",
          steps: [{ id: "step_0", type: "action", action: { type: "nope" }, next: null }],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts a valid step graph", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/actions/rules",
        cookies: { session: app.signCookie("valid") },
        payload: {
          name: "test",
          eventType: "memberJoin",
          actions: [{ type: "addRole", roleId: "7" }],
          entryStepId: "step_0",
          steps: [{ id: "step_0", type: "action", action: { type: "addRole", roleId: "7" }, next: null }],
        },
      });
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
