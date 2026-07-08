import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", dashboardSessionSecret: "s", logLevel: "info" },
}));

vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: "user-1",
    username: "u",
    guilds: [{ id: "guild-1", name: "T", permissions: BigInt(0x20).toString() }],
  }),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: vi.fn().mockResolvedValue(true),
  channelExistsInGuild: vi.fn().mockResolvedValue(true),
  getGuildOwnerId: vi.fn().mockResolvedValue("owner-1"),
}));
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: vi
    .fn()
    .mockResolvedValue({ permissions: new Set(["*"]), isOwner: true }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { mockUpdateRule } = vi.hoisted(() => ({ mockUpdateRule: vi.fn() }));
vi.mock("@fluxcore/systems/actions/persistence", () => ({
  notifyCacheInvalidation: vi.fn().mockResolvedValue(undefined),
  listRules: vi.fn().mockResolvedValue([]),
  getRule: vi.fn(),
  createRule: vi.fn(),
  updateRule: (...args: unknown[]) => mockUpdateRule(...args),
  deleteRule: vi.fn(),
  bulkUpdateRules: vi.fn(),
  bulkDeleteRules: vi.fn(),
  getRuleAnalytics: vi.fn(),
  getActionLogs: vi.fn(),
  getGuildSettings: vi.fn(),
  upsertGuildSettings: vi.fn(),
  getRulesByGuild: vi.fn().mockResolvedValue([]),
  countRules: vi.fn().mockResolvedValue(0),
  getRecentLogs: vi.fn().mockResolvedValue([]),
  getAnalytics: vi.fn().mockResolvedValue({}),
  getLastFiredByGuild: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("@fluxcore/systems/actions/config", () => ({
  getGuildSettingsOrDefault: vi
    .fn()
    .mockReturnValue({ maxRules: 25, globalEnabled: true, logChannelId: null }),
  setGuildSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@fluxcore/systems/actions/constants", () => ({
  EVENT_TYPES: { memberJoin: { label: "Member Join" } },
  ACTION_TYPES: { sendMessage: { label: "Send Message" } },
  MAX_ACTIONS_PER_RULE: 5,
  ACTION_TYPE_FIELDS: {},
  EVENT_TYPE_VARIABLES: {},
  TEMPLATE_VARIABLES: [],
}));

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@fluxcore/utils", () => ({ logger: mockLogger }));

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

describe("PUT /actions/rules/:ruleId — error handling", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("returns 404 when Prisma throws P2025", async () => {
    const err = Object.assign(new Error("Record not found"), { code: "P2025" });
    mockUpdateRule.mockRejectedValue(err);
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/actions/rules/123",
      cookies: { session: app.signCookie("valid") },
      payload: { name: "x" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 500 and logs when an unexpected error occurs", async () => {
    mockUpdateRule.mockRejectedValue(new Error("DB connection refused"));
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/actions/rules/123",
      cookies: { session: app.signCookie("valid") },
      payload: { name: "x" },
    });
    expect(res.statusCode).toBe(500);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
