import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "t",
    clientId: "c",
    dashboardSessionSecret: "s",
    logLevel: "info",
  },
}));

vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: "user-1",
    username: "user",
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

vi.mock("@fluxcore/systems/music/library", () => ({
  getAlbums: vi.fn().mockResolvedValue([]),
  getAlbumById: vi.fn(),
  addAlbum: vi.fn().mockResolvedValue({ id: 1, name: "x" }),
  removeAlbum: vi.fn(),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  getAlbumTracks: vi.fn(),
  getAlbumCount: vi.fn().mockResolvedValue(0),
  getTrackCount: vi.fn().mockResolvedValue(0),
  getTrackById: vi.fn(),
}));
vi.mock("@fluxcore/systems/music/config", () => ({
  fetchMusicSettings: vi.fn(),
  upsertMusicSettings: vi.fn(),
}));
vi.mock("@fluxcore/systems/actions/persistence", () => ({
  notifyCacheInvalidation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import { registerMusicRoutes } from "../../../../src/server/features/music/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  await app.register(fastifyRateLimit, { global: false });
  registerMusicRoutes(app);
  await app.ready();
  return app;
}

describe("POST /api/guilds/:guildId/music/library — rate limit", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("returns 429 after exceeding 10 requests/minute", async () => {
    const cookie = { session: app.signCookie("valid") };
    let lastStatus = 0;
    for (let i = 0; i < 12; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/music/library",
        cookies: cookie,
        payload: { name: `album-${i}` },
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
  });
});
