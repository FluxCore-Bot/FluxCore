import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    dashboardSessionSecret: "session-secret",
    logLevel: "info",
  },
}));

const mockGetSession = vi.fn().mockResolvedValue(null);
vi.mock("../../src/server/session.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

const mockIsBotInGuild = vi.fn().mockResolvedValue(true);
vi.mock("../../src/server/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerGuildRoutes } from "../../src/server/routes/guilds.js";

const MANAGE_GUILD = BigInt(0x20);

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerGuildRoutes(app);
  await app.ready();
  return app;
}

describe("guild routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  describe("GET /api/guilds", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await app.inject({ method: "GET", url: "/api/guilds" });
      expect(res.statusCode).toBe(401);
    });

    it("returns guilds where user has MANAGE_GUILD and bot is present", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        username: "testuser",
        guilds: [
          { id: "g1", name: "Guild 1", icon: "abc", permissions: MANAGE_GUILD.toString() },
          { id: "g2", name: "Guild 2", icon: null, permissions: "0" },
          { id: "g3", name: "Guild 3", icon: "def", permissions: MANAGE_GUILD.toString() },
        ],
      });
      mockIsBotInGuild.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds",
        cookies: { session: "valid-id" },
      });

      expect(res.statusCode).toBe(200);
      const guilds = res.json();
      expect(guilds).toHaveLength(1);
      expect(guilds[0].id).toBe("g1");
      expect(guilds[0].name).toBe("Guild 1");
    });

    it("returns empty array when user has no manageable guilds", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        guilds: [{ id: "g1", name: "Guild", permissions: "0" }],
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds",
        cookies: { session: "valid-id" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });
});
