import { describe, it, expect, vi, beforeEach } from "vitest";

// In production index.ts hands config.dashboardSessionSecret to @fastify/cookie,
// so the cookie signing key and the session secret are one value. The
// oauth_state regression test below only means anything if the test app mirrors
// that, hence one constant feeding both.
const { SESSION_SECRET } = vi.hoisted(() => ({ SESSION_SECRET: "x".repeat(64) }));

// The three mocks below are load-bearing for the oauth_state regression test,
// which registers the real auth routes: @fluxcore/config is eagerly evaluated at
// import, routes.ts imports the logger, and session.ts drags in @fluxcore/database.
vi.mock("@fluxcore/config", () => ({
  config: {
    token: "t",
    clientId: "c",
    dashboardCallbackUrl: "",
    dashboardPublicUrl: "https://dash.example.com",
    dashboardSessionSecret: SESSION_SECRET,
    logLevel: "info",
  },
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../src/server/shared/session.js", () => ({
  createSession: vi.fn().mockResolvedValue("session-id"),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn().mockResolvedValue(null),
}));

const { mockGetTranslation, mockDetectLanguage } = vi.hoisted(() => ({
  mockGetTranslation: vi.fn(),
  mockDetectLanguage: vi.fn((header?: string) => (header ? header.split(",")[0] : "en")),
}));
vi.mock("@fluxcore/i18n/server", () => ({
  getTranslation: mockGetTranslation,
  detectLanguage: mockDetectLanguage,
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import {
  rateLimitKey,
  rateLimitErrorResponse,
  rateLimits,
  globalRateLimitOptions,
  RATE_LIMITED_ERROR_KEY,
} from "../../../src/server/shared/rateLimit.js";
import { registerAuthRoutes } from "../../../src/server/features/auth/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: SESSION_SECRET });
  // Probe routes let both functions run against a genuine FastifyRequest,
  // so no part of this file needs a hand-rolled fake or a cast.
  app.get("/probe", async (request) => ({ key: rateLimitKey(request) }));
  app.get("/error-body", async (request) =>
    rateLimitErrorResponse(request, { after: "30 seconds" }),
  );
  // The real, public /auth/login — so the regression test mints its cookie the
  // exact way an unauthenticated attacker would, not through a stand-in.
  registerAuthRoutes(app);
  await app.ready();
  return app;
}

async function keyFor(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookies?: Record<string, string>,
): Promise<string> {
  const res = await app.inject({ method: "GET", url: "/probe", cookies });
  return res.json<{ key: string }>().key;
}

describe("rateLimitKey", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("derives a session key from a validly signed cookie", async () => {
    const key = await keyFor(app, { session: app.signCookie("session-abc") });
    expect(key).toMatch(/^s:[A-Za-z0-9_-]{22}$/);
  });

  it("returns the same key across requests with the same session", async () => {
    const cookie = { session: app.signCookie("session-abc") };
    expect(await keyFor(app, cookie)).toBe(await keyFor(app, cookie));
  });

  it("returns different keys for different sessions", async () => {
    const a = await keyFor(app, { session: app.signCookie("session-abc") });
    const b = await keyFor(app, { session: app.signCookie("session-xyz") });
    expect(a).not.toBe(b);
  });

  it("never exposes the raw session value in the key", async () => {
    const key = await keyFor(app, { session: app.signCookie("super-secret-session") });
    expect(key).not.toContain("super-secret-session");
  });

  it("falls back to the IP key when the cookie signature is invalid", async () => {
    const key = await keyFor(app, { session: "forged-value-not-signed" });
    expect(key).toMatch(/^ip:/);
  });

  it("falls back to the IP key when no cookie is present", async () => {
    expect(await keyFor(app)).toMatch(/^ip:/);
  });

  // Regression: /auth/login is public and unauthenticated. Its oauth_state
  // cookie used to be `signed: true`, i.e. signed with the very secret this
  // generator unsigns against — and @fastify/cookie signs only the value, never
  // the name. So anyone could GET /auth/login, replay the returned value as
  // `Cookie: session=...`, and be handed a brand new bucket. Because
  // /auth/login is itself keyed by this generator, each minted key bought 10
  // more logins per minute: unlimited buckets from a standing start.
  it("does not accept an oauth_state cookie minted by /auth/login as a session", async () => {
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const minted = login.cookies.find((c) => c.name === "oauth_state");
    expect(minted).toBeDefined();

    expect(await keyFor(app, { session: minted!.value })).toMatch(/^ip:/);
  });
});

describe("rateLimitErrorResponse", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  // Exercised through a real route so the function receives a genuine
  // FastifyRequest. No hand-rolled fake. The response body shape is supplied
  // as a type argument to `res.json`, not asserted onto it with `as` — an
  // unnecessary cast is what hid the bug this whole change exists to fix.
  async function bodyFor(acceptLanguage: string) {
    const res = await app.inject({
      method: "GET",
      url: "/error-body",
      headers: { "accept-language": acceptLanguage },
    });
    return res.json<{
      statusCode: number;
      error: string;
      errorKey: string;
      retryAfter: string;
    }>();
  }

  it("returns a 429 body carrying the translation key and retry hint", async () => {
    mockGetTranslation.mockReturnValue(() => "Trop de requetes.");
    expect(await bodyFor("fr")).toEqual({
      statusCode: 429,
      error: "Trop de requetes.",
      errorKey: RATE_LIMITED_ERROR_KEY,
      retryAfter: "30 seconds",
    });
  });

  it("translates using the Accept-Language header", async () => {
    mockGetTranslation.mockReturnValue(() => "translated");
    await bodyFor("de-DE,de;q=0.9");
    expect(mockDetectLanguage).toHaveBeenCalledWith("de-DE,de;q=0.9");
    expect(mockGetTranslation).toHaveBeenCalledWith("de-DE");
  });

  it("falls back to English when i18n is not initialized", async () => {
    mockGetTranslation.mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'getFixedT')");
    });
    expect((await bodyFor("en")).error).toBe("Too many requests. Please try again later.");
  });

  it("falls back to English when the key resolves to itself (namespace not loaded)", async () => {
    mockGetTranslation.mockReturnValue(() => RATE_LIMITED_ERROR_KEY);
    expect((await bodyFor("en")).error).toBe("Too many requests. Please try again later.");
  });
});

// These four numbers are a product decision, not an implementation detail:
// they were chosen against measured client behaviour (a slider drag produces
// ~25 preview requests/min, so `heavy` must sit above it). Pinning them makes
// an accidental edit fail loudly and documents the agreed ceilings in one
// place. Intentionally a value assertion, not a tautology to delete.
describe("rateLimits tiers", () => {
  it("defines the agreed ceilings", () => {
    expect(rateLimits.heavy.rateLimit.max).toBe(40);
    expect(rateLimits.upload.rateLimit.max).toBe(10);
    expect(rateLimits.external.rateLimit.max).toBe(5);
    expect(rateLimits.create.rateLimit.max).toBe(10);
  });

  it("uses a one minute window for every tier", () => {
    for (const tier of Object.values(rateLimits)) {
      expect(tier.rateLimit.timeWindow).toBe("1 minute");
    }
  });
});

describe("globalRateLimitOptions", () => {
  it("defaults to 300 per minute and wires the shared key and error builder", () => {
    expect(globalRateLimitOptions.max).toBe(300);
    expect(globalRateLimitOptions.timeWindow).toBe("1 minute");
    expect(globalRateLimitOptions.keyGenerator).toBe(rateLimitKey);
    expect(globalRateLimitOptions.errorResponseBuilder).toBe(rateLimitErrorResponse);
  });
});
