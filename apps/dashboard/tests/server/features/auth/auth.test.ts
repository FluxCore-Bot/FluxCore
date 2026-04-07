import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    dashboardClientSecret: "test-secret",
    dashboardCallbackUrl: "http://localhost:3000/auth/callback",
    dashboardPublicUrl: "http://localhost:3000",
    dashboardSessionSecret: "session-secret",
    logLevel: "info",
  },
}));

const mockState = "mock-state-token";
const mockGetAuthorizationUrl = vi
  .fn()
  .mockReturnValue({ url: "https://discord.com/oauth2/authorize?...", state: mockState });
const mockExchangeCode = vi.fn().mockResolvedValue({ access_token: "test-access-token" });
const mockFetchUser = vi.fn().mockResolvedValue({ id: "user-1", username: "testuser", avatar: "abc" });
const mockFetchGuilds = vi.fn().mockResolvedValue([{ id: "g1", name: "Guild", icon: null, permissions: "8" }]);
vi.mock("../../../../src/server/shared/auth.js", () => ({
  getAuthorizationUrl: () => mockGetAuthorizationUrl(),
  exchangeCode: (...args: unknown[]) => mockExchangeCode(...args),
  fetchUser: (...args: unknown[]) => mockFetchUser(...args),
  fetchGuilds: (...args: unknown[]) => mockFetchGuilds(...args),
}));

const mockCreateSession = vi.fn().mockResolvedValue("session-id-123");
const mockDeleteSession = vi.fn().mockResolvedValue(undefined);
const mockGetSession = vi.fn().mockResolvedValue(null);
vi.mock("../../../../src/server/shared/session.js", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerAuthRoutes } from "../../../../src/server/features/auth/routes.js";

const COOKIE_SECRET = "test-secret";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: COOKIE_SECRET });
  registerAuthRoutes(app);
  await app.ready();
  return app;
}

function getSignedCookies(app: FastifyInstance, res: { cookies: Array<{ name: string; value: string }> }) {
  const cookies: Record<string, string> = {};
  for (const c of res.cookies) {
    cookies[c.name] = c.value;
  }
  return cookies;
}

async function getStateCookie(app: FastifyInstance): Promise<string> {
  const loginRes = await app.inject({ method: "GET", url: "/auth/login" });
  const stateCookie = loginRes.cookies.find((c) => c.name === "oauth_state");
  return stateCookie!.value;
}

describe("auth routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  describe("GET /auth/login", () => {
    it("redirects to Discord OAuth2 URL and sets state cookie", async () => {
      const res = await app.inject({ method: "GET", url: "/auth/login" });
      expect(res.statusCode).toBe(302);
      const stateCookie = res.cookies.find((c) => c.name === "oauth_state");
      expect(stateCookie).toBeDefined();
    });
  });

  describe("GET /auth/callback", () => {
    it("returns 400 when code is missing", async () => {
      const res = await app.inject({ method: "GET", url: "/auth/callback" });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Missing code parameter");
    });

    it("returns 403 when state is missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/callback?code=test-code",
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 403 when state does not match", async () => {
      const signedStateCookie = await getStateCookie(app);
      const res = await app.inject({
        method: "GET",
        url: "/auth/callback?code=test-code&state=wrong-state",
        cookies: { oauth_state: signedStateCookie },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("Invalid state parameter");
    });

    it("creates session and redirects on success with valid state", async () => {
      const signedStateCookie = await getStateCookie(app);
      const res = await app.inject({
        method: "GET",
        url: `/auth/callback?code=test-code&state=${mockState}`,
        cookies: { oauth_state: signedStateCookie },
      });
      expect(res.statusCode).toBe(302);
      expect(mockExchangeCode).toHaveBeenCalledWith(
        "test-code",
        "http://localhost:3000/auth/callback",
      );
      expect(mockCreateSession).toHaveBeenCalled();

      const sessionCookie = res.cookies.find((c) => c.name === "session");
      expect(sessionCookie).toBeDefined();
    });

    it("returns 500 on OAuth failure", async () => {
      mockExchangeCode.mockRejectedValueOnce(new Error("OAuth failed"));
      const signedStateCookie = await getStateCookie(app);
      const res = await app.inject({
        method: "GET",
        url: `/auth/callback?code=bad-code&state=${mockState}`,
        cookies: { oauth_state: signedStateCookie },
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
        cookies: { session: app.signCookie("session-id-123") },
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
        cookies: { session: app.signCookie("expired-id") },
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
        cookies: { session: app.signCookie("valid-id") },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().username).toBe("testuser");
    });
  });
});
