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

const mockListGiveaways = vi.fn().mockResolvedValue({ giveaways: [], total: 0 });
const mockCreateGiveaway = vi.fn().mockResolvedValue({
  id: 1,
  guildId: "guild-1",
  channelId: "ch-1",
  messageId: null,
  hostId: "user-1",
  prize: "Test Prize",
  winners: 1,
  endsAt: new Date(Date.now() + 3600000),
  ended: false,
  winnerIds: [],
  entrantIds: [],
  requiredRoleIds: [],
  createdAt: new Date(),
});
const mockGetGiveaway = vi.fn();
const mockEndGiveaway = vi.fn();
const mockGetActiveGiveawayCount = vi.fn().mockResolvedValue(0);
vi.mock("@fluxcore/systems/giveaways/persistence", () => ({
  listGiveaways: (...args: unknown[]) => mockListGiveaways(...args),
  createGiveaway: (...args: unknown[]) => mockCreateGiveaway(...args),
  getGiveaway: (...args: unknown[]) => mockGetGiveaway(...args),
  endGiveaway: (...args: unknown[]) => mockEndGiveaway(...args),
  getActiveGiveawayCount: (...args: unknown[]) => mockGetActiveGiveawayCount(...args),
}));

const mockSelectWinners = vi.fn().mockReturnValue(["winner-1"]);
const mockRerollWinners = vi.fn().mockReturnValue(["winner-2"]);
vi.mock("@fluxcore/systems/giveaways/winner", () => ({
  selectWinners: (...args: unknown[]) => mockSelectWinners(...args),
  rerollWinners: (...args: unknown[]) => mockRerollWinners(...args),
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
import { registerGiveawayRoutes } from "../../src/server/routes/giveaways.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerGiveawayRoutes(app);
  await app.ready();
  return app;
}

describe("giveaway routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    app = await buildApp();
  });

  // --- List ---
  describe("GET /api/guilds/:guildId/giveaways", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/giveaways",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns giveaways on success", async () => {
      mockListGiveaways.mockResolvedValueOnce({
        giveaways: [{ id: 1, prize: "Test" }],
        total: 1,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/giveaways",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.giveaways).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it("passes active filter", async () => {
      await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/giveaways?active=true",
        cookies: { session: app.signCookie("valid") },
      });

      expect(mockListGiveaways).toHaveBeenCalledWith(
        "guild-1",
        expect.objectContaining({ active: true }),
      );
    });

    it("returns 403 when user lacks permissions", async () => {
      mockGetSession.mockResolvedValueOnce({
        ...mockSession,
        guilds: [{ id: "guild-1", name: "Test", permissions: "0" }],
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/giveaways",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // --- Create ---
  describe("POST /api/guilds/:guildId/giveaways", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/giveaways",
        payload: {
          channelId: "ch-1",
          prize: "Test",
          winners: 1,
          durationMs: 3600000,
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it("creates giveaway on valid request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/giveaways",
        cookies: { session: app.signCookie("valid") },
        payload: {
          channelId: "ch-1",
          prize: "Nitro",
          winners: 2,
          durationMs: 3600000,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(mockCreateGiveaway).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: "guild-1",
          prize: "Nitro",
          winners: 2,
        }),
      );
    });

    it("returns 400 for missing prize", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/giveaways",
        cookies: { session: app.signCookie("valid") },
        payload: {
          channelId: "ch-1",
          winners: 1,
          durationMs: 3600000,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when max active giveaways reached", async () => {
      mockGetActiveGiveawayCount.mockResolvedValueOnce(25);

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/giveaways",
        cookies: { session: app.signCookie("valid") },
        payload: {
          channelId: "ch-1",
          prize: "Test",
          winners: 1,
          durationMs: 3600000,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- End ---
  describe("PUT /api/guilds/:guildId/giveaways/:id/end", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/giveaways/1/end",
      });
      expect(res.statusCode).toBe(401);
    });

    it("ends giveaway on valid request", async () => {
      mockGetGiveaway.mockResolvedValueOnce({
        id: 1,
        ended: false,
        entrantIds: ["u1"],
        winnerIds: [],
        winners: 1,
      });
      mockEndGiveaway.mockResolvedValueOnce({
        id: 1,
        ended: true,
        winnerIds: ["winner-1"],
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/giveaways/1/end",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(mockEndGiveaway).toHaveBeenCalled();
    });

    it("returns 404 for non-existent giveaway", async () => {
      mockGetGiveaway.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/giveaways/999/end",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for already ended giveaway", async () => {
      mockGetGiveaway.mockResolvedValueOnce({
        id: 1,
        ended: true,
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/giveaways/1/end",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid giveaway ID", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/giveaways/invalid/end",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- Reroll ---
  describe("POST /api/guilds/:guildId/giveaways/:id/reroll", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/giveaways/1/reroll",
      });
      expect(res.statusCode).toBe(401);
    });

    it("rerolls giveaway on valid request", async () => {
      mockGetGiveaway.mockResolvedValueOnce({
        id: 1,
        ended: true,
        entrantIds: ["u1", "u2"],
        winnerIds: ["u1"],
        winners: 1,
      });
      mockEndGiveaway.mockResolvedValueOnce({
        id: 1,
        ended: true,
        winnerIds: ["winner-2"],
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/giveaways/1/reroll",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(mockRerollWinners).toHaveBeenCalled();
    });

    it("returns 400 for not-ended giveaway", async () => {
      mockGetGiveaway.mockResolvedValueOnce({
        id: 1,
        ended: false,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/giveaways/1/reroll",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when no eligible entrants", async () => {
      mockGetGiveaway.mockResolvedValueOnce({
        id: 1,
        ended: true,
        entrantIds: ["u1"],
        winnerIds: ["u1"],
        winners: 1,
      });
      mockRerollWinners.mockReturnValueOnce([]);

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/giveaways/1/reroll",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
