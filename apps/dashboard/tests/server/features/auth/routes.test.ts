import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    clientId: "client-id",
    dashboardClientSecret: "secret",
    dashboardCallbackUrl: "",
    dashboardPublicUrl: "https://dash.example.com",
    dashboardSessionSecret: "x".repeat(64),
  },
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const mockExchangeCode = vi.fn();
const mockFetchUser = vi.fn();
const mockFetchGuilds = vi.fn();

vi.mock("../../../../src/server/shared/auth.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../src/server/shared/auth.js")
  >("../../../../src/server/shared/auth.js");
  return {
    ...actual,
    exchangeCode: (...args: unknown[]) => mockExchangeCode(...args),
    fetchUser: (...args: unknown[]) => mockFetchUser(...args),
    fetchGuilds: (...args: unknown[]) => mockFetchGuilds(...args),
  };
});

vi.mock("../../../../src/server/shared/session.js", () => ({
  createSession: vi.fn().mockResolvedValue("session-id"),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn().mockResolvedValue(null),
}));

import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerAuthRoutes } from "../../../../src/server/features/auth/routes.js";

const COOKIE_SECRET = "x".repeat(64);

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: COOKIE_SECRET });
  registerAuthRoutes(app);
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExchangeCode.mockReset();
  mockFetchUser.mockReset();
  mockFetchGuilds.mockReset();
});

describe("/auth/login redirect_uri", () => {
  it("ignores x-forwarded-host and uses DASHBOARD_PUBLIC_URL", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/auth/login",
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "evil.example.com",
      },
    });
    expect(res.statusCode).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain(
      encodeURIComponent("https://dash.example.com/auth/callback"),
    );
    expect(location).not.toContain("evil.example.com");
    await app.close();
  });
});

describe("/auth/login oauth_state cookie attributes", () => {
  it("sets SameSite=Strict on the oauth_state cookie", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/auth/login" });
    const setCookies = res.headers["set-cookie"];
    const cookieList = Array.isArray(setCookies)
      ? setCookies
      : [setCookies ?? ""];
    const stateCookie = cookieList.find((c) => c.startsWith("oauth_state="));
    expect(stateCookie).toBeDefined();
    expect(stateCookie!.toLowerCase()).toContain("samesite=strict");
    await app.close();
  });
});

describe("/auth/callback failure cleanup", () => {
  it("clears oauth_state cookie even when token exchange fails", async () => {
    mockExchangeCode.mockRejectedValueOnce(new Error("Discord 500"));

    const app = await buildApp();

    // First hit /auth/login to obtain a signed state cookie + the corresponding state value
    const loginRes = await app.inject({ method: "GET", url: "/auth/login" });
    const stateCookieObj = loginRes.cookies.find((c) => c.name === "oauth_state");
    expect(stateCookieObj).toBeDefined();
    const signedStateValue = stateCookieObj!.value;

    // Extract the unsigned state value from the redirect URL
    const location = loginRes.headers.location as string;
    const stateMatch = /[?&]state=([^&]+)/.exec(location);
    expect(stateMatch).toBeTruthy();
    const stateParam = decodeURIComponent(stateMatch![1]);

    const res = await app.inject({
      method: "GET",
      url: `/auth/callback?code=abc&state=${encodeURIComponent(stateParam)}`,
      cookies: { oauth_state: signedStateValue },
    });

    expect(res.statusCode).toBe(500);
    const cleared = res.headers["set-cookie"];
    const clearedStr = Array.isArray(cleared)
      ? cleared.join("; ")
      : (cleared ?? "");
    expect(clearedStr).toMatch(/oauth_state=;/);
    await app.close();
  });
});

describe("/auth/csrf", () => {
  it("issues a csrf_token cookie and matching body token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/auth/csrf" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { token: string };
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    const setCookie = res.headers["set-cookie"];
    const cookieStr = Array.isArray(setCookie)
      ? setCookie.join("; ")
      : (setCookie ?? "");
    expect(cookieStr).toContain(`csrf_token=${body.token}`);
    await app.close();
  });
});
