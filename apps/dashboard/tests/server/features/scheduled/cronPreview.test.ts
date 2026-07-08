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

let slowMode = false;
vi.mock("@fluxcore/systems/scheduled-messages/cron", () => ({
  validateCronExpression: () => null,
  getNextCronRun: () => {
    if (slowMode) {
      const start = Date.now();
      while (Date.now() - start < 100) {
        /* spin */
      }
    }
    return new Date();
  },
}));
vi.mock("@fluxcore/systems/scheduled-messages/persistence", () => ({
  getScheduledMessages: vi.fn(),
  getScheduledMessageById: vi.fn(),
  createScheduledMessage: vi.fn(),
  updateScheduledMessage: vi.fn(),
  deleteScheduledMessage: vi.fn(),
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import { registerScheduledMessageRoutes } from "../../../../src/server/features/scheduled/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  await app.register(fastifyRateLimit, { global: false });
  registerScheduledMessageRoutes(app);
  await app.ready();
  return app;
}

describe("GET /scheduled-messages/preview-cron — DoS guards", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    slowMode = false;
    app = await buildApp();
  });

  it("returns 429 after exceeding 5 requests per 10 seconds", async () => {
    const cookie = { session: app.signCookie("valid") };
    let lastStatus = 0;
    for (let i = 0; i < 7; i++) {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/scheduled-messages/preview-cron?cronExpr=*+*+*+*+*",
        cookies: cookie,
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
  });

  it("returns 400 when cron evaluation exceeds time budget", async () => {
    slowMode = true;
    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/scheduled-messages/preview-cron?cronExpr=*+*+*+*+*",
      cookies: { session: app.signCookie("valid") },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/slow|budget|timeout/i);
  });
});
