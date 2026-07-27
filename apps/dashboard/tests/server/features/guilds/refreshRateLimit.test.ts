import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", dashboardSessionSecret: "s", logLevel: "info" },
}));

vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: "user-1",
    username: "u",
    guilds: [],
  }),
  touchSession: vi.fn().mockResolvedValue(undefined),
  // An empty refreshed list keeps the handler cheap: no Discord bot-presence
  // fanout, just the tier boundary under test.
  forceRefreshSessionGuilds: vi.fn().mockResolvedValue([]),
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
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import { registerGuildRoutes } from "../../../../src/server/features/guilds/routes.js";
import { globalRateLimitOptions } from "../../../../src/server/shared/rateLimit.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  // Mirror index.ts so the real key generator and error builder are exercised.
  await app.register(fastifyRateLimit, globalRateLimitOptions);
  registerGuildRoutes(app);
  await app.ready();
  return app;
}

function refreshRequest(app: Awaited<ReturnType<typeof buildApp>>, session: string) {
  return app.inject({
    method: "POST",
    url: "/api/guilds/refresh",
    cookies: { session: app.signCookie(session) },
  });
}

// Boundary test for the `external` tier wiring on the route: dropping
// `config: rateLimits.external` from the route would fall back to the 300/min
// global ceiling, which the tier-value pins alone cannot catch.
describe("guilds refresh endpoint — rate limiting", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("allows 5 refreshes then rejects the 6th with the shared error body", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await refreshRequest(app, "session-a");
      expect(res.statusCode).toBe(200);
    }
    const blocked = await refreshRequest(app, "session-a");
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ errorKey: string }>().errorKey).toBe("errors:server.rateLimited");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });
});
