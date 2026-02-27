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

const mockGetGuildConfig = vi.fn().mockReturnValue(null);
const mockSetGuildConfig = vi.fn().mockResolvedValue(undefined);
const mockRemoveGuildConfig = vi.fn().mockResolvedValue(true);
vi.mock("@fluxcore/systems/tempVoice/config", () => ({
  getGuildConfig: (...args: unknown[]) => mockGetGuildConfig(...args),
  setGuildConfig: (...args: unknown[]) => mockSetGuildConfig(...args),
  removeGuildConfig: (...args: unknown[]) => mockRemoveGuildConfig(...args),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerTempVoiceRoutes } from "../../src/server/routes/tempvoice.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerTempVoiceRoutes(app);
  await app.ready();
  return app;
}

describe("tempvoice routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    app = await buildApp();
  });

  describe("GET /api/guilds/:guildId/tempvoice", () => {
    it("returns null when no config exists", async () => {
      mockGetGuildConfig.mockReturnValueOnce(null);
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: "valid" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toBeNull();
    });

    it("returns config when it exists", async () => {
      const config = { hubChannelId: "ch-1", nameTemplate: "{user}'s Room", categoryId: null };
      mockGetGuildConfig.mockReturnValueOnce(config);
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: "valid" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().hubChannelId).toBe("ch-1");
    });
  });

  describe("PUT /api/guilds/:guildId/tempvoice", () => {
    it("sets config successfully", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: "valid" },
        payload: { hubChannelId: "ch-1", nameTemplate: "{user}'s Room" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockSetGuildConfig).toHaveBeenCalled();
    });

    it("returns 400 when hubChannelId missing", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: "valid" },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when hub channel doesn't exist in guild", async () => {
      mockChannelExistsInGuild.mockResolvedValueOnce(false);
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: "valid" },
        payload: { hubChannelId: "bad-channel" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Invalid hub channel");
    });

    it("returns 400 when name template too long", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: "valid" },
        payload: { hubChannelId: "ch-1", nameTemplate: "x".repeat(101) },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("too long");
    });
  });

  describe("DELETE /api/guilds/:guildId/tempvoice", () => {
    it("removes config successfully", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: "valid" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("returns success false when no config to remove", async () => {
      mockRemoveGuildConfig.mockResolvedValueOnce(false);
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/tempvoice",
        cookies: { session: "valid" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(false);
    });
  });
});
