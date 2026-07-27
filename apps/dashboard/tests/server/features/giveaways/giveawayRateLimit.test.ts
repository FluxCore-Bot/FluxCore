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
  resolveUserPermissions: vi.fn().mockResolvedValue({ permissions: new Set(["*"]), isOwner: true }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@fluxcore/systems/giveaways/persistence", () => ({
  listGiveaways: vi.fn().mockResolvedValue({ giveaways: [], total: 0 }),
  createGiveaway: vi.fn().mockResolvedValue({ id: 1 }),
  getGiveaway: vi.fn(),
  endGiveaway: vi.fn(),
  getActiveGiveawayCount: vi.fn().mockResolvedValue(0),
}));
vi.mock("@fluxcore/systems/giveaways/winner", () => ({
  selectWinners: vi.fn(),
  rerollWinners: vi.fn(),
}));
vi.mock("@fluxcore/systems/giveaways/constants", () => ({
  GIVEAWAY_PAGE_SIZE: 10,
  MAX_WINNERS: 20,
  MAX_PRIZE_LENGTH: 256,
  MAX_ACTIVE_GIVEAWAYS: 25,
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import { registerGiveawayRoutes } from "../../../../src/server/features/giveaways/routes.js";
import { globalRateLimitOptions } from "../../../../src/server/shared/rateLimit.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  // Mirror index.ts so the real key generator and error builder are exercised.
  await app.register(fastifyRateLimit, globalRateLimitOptions);
  registerGiveawayRoutes(app);
  await app.ready();
  return app;
}

function createRequest(app: Awaited<ReturnType<typeof buildApp>>, session: string) {
  return app.inject({
    method: "POST",
    url: "/api/guilds/guild-1/giveaways",
    cookies: { session: app.signCookie(session) },
    payload: { channelId: "ch-1", prize: "Test Prize", winners: 1, durationMs: 60000 },
  });
}

// Boundary test for the `create` tier wiring on the route: dropping
// `config: rateLimits.create` from the route would fall back to the 300/min
// global ceiling, which the tier-value pins alone cannot catch.
describe("giveaway create endpoint — rate limiting", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("allows 10 creates then rejects the 11th with the shared error body", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await createRequest(app, "session-a");
      expect(res.statusCode).toBe(201);
    }
    const blocked = await createRequest(app, "session-a");
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ errorKey: string }>().errorKey).toBe("errors:server.rateLimited");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });
});
