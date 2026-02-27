import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    dashboardClientSecret: "test-secret",
    dashboardCallbackUrl: "http://localhost:3000/auth/callback",
    dashboardSessionSecret: "session-secret",
    logLevel: "info",
  },
}));

const mockGetAuthorizationUrl = vi.fn().mockReturnValue("https://discord.com/oauth2/authorize?...");
const mockExchangeCode = vi.fn().mockResolvedValue({ access_token: "test-access-token" });
const mockFetchUser = vi.fn().mockResolvedValue({ id: "user-1", username: "testuser", avatar: "abc" });
const mockFetchGuilds = vi.fn().mockResolvedValue([{ id: "g1", name: "Guild", icon: null, permissions: "8" }]);
vi.mock("../../src/server/auth.js", () => ({
  getAuthorizationUrl: () => mockGetAuthorizationUrl(),
  exchangeCode: (...args: unknown[]) => mockExchangeCode(...args),
  fetchUser: (...args: unknown[]) => mockFetchUser(...args),
  fetchGuilds: (...args: unknown[]) => mockFetchGuilds(...args),
}));

const mockCreateSession = vi.fn().mockResolvedValue("session-id-123");
const mockDeleteSession = vi.fn().mockResolvedValue(undefined);
const mockGetSession = vi.fn().mockResolvedValue(null);
vi.mock("../../src/server/session.js", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerAuthRoutes } from "../../src/server/routes/auth.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerAuthRoutes(app);
  await app.ready();
  return app;
}

describe("auth routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  describe("GET /auth/login", () => {
    it("redirects to Discord OAuth2 URL", async () => {
      const res = await app.inject({ method: "GET", url: "/auth/login" });
      expect(res.statusCode).toBe(302);
    });
  });

  describe("GET /auth/callback", () => {
    it("returns 400 when code is missing", async () => {
      const res = await app.inject({ method: "GET", url: "/auth/callback" });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Missing code parameter");
    });

    it("creates session and redirects on success", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/callback?code=test-code",
      });
      expect(res.statusCode).toBe(302);
      expect(mockExchangeCode).toHaveBeenCalledWith("test-code");
      expect(mockCreateSession).toHaveBeenCalled();
    });

    it("returns 500 on OAuth failure", async () => {
      mockExchangeCode.mockRejectedValueOnce(new Error("OAuth failed"));
      const res = await app.inject({
        method: "GET",
        url: "/auth/callback?code=bad-code",
      });
      expect(res.statusCode).toBe(500);
      expect(res.json().error).toBe("Authentication failed");
    });
  });

  describe("GET /auth/logout", () => {
    it("clears session and redirects", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/logout",
        cookies: { session: "session-id-123" },
      });
      expect(res.statusCode).toBe(302);
      expect(mockDeleteSession).toHaveBeenCalledWith("session-id-123");
    });

    it("redirects even without session", async () => {
      const res = await app.inject({ method: "GET", url: "/auth/logout" });
      expect(res.statusCode).toBe(302);
      expect(mockDeleteSession).not.toHaveBeenCalled();
    });
  });

  describe("GET /auth/me", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await app.inject({ method: "GET", url: "/auth/me" });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when session expired", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
        cookies: { session: "expired-id" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns user info when authenticated", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        username: "testuser",
        avatar: "abc",
        guilds: [],
      });
      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
        cookies: { session: "valid-id" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().username).toBe("testuser");
    });
  });
});
