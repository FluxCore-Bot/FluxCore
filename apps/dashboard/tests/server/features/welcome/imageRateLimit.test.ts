import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", dashboardSessionSecret: "s", logLevel: "info" },
}));

vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: vi.fn().mockResolvedValue({
    // Must be a numeric snowflake: with a null avatar the preview route
    // computes a default via BigInt(session.userId), which throws on a
    // non-numeric id and turns the response into a 500.
    userId: "123456789012345678",
    username: "u",
    avatar: "abc123",
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

vi.mock("@fluxcore/systems/welcome/image", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@fluxcore/systems/welcome/image");
  return {
    ...actual,
    createStorageAdapter: () => ({
      upload: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }),
    MAX_BACKGROUND_SIZE: 5 * 1024 * 1024,
    ALLOWED_BACKGROUND_TYPES: ["image/png", "image/jpeg", "image/webp"],
    PRESET_BACKGROUNDS: [],
    DEFAULT_WELCOME_IMAGE_SETTINGS: {},
    DEFAULT_FAREWELL_IMAGE_SETTINGS: {},
    welcomeImageSettingsSchema: { safeParse: () => ({ success: true, data: {} }) },
    // Rendering is irrelevant here and slow — return a stub buffer.
    generateWelcomeImage: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    getAllTemplates: () => [],
    getAvailableFonts: () => [],
  };
});
vi.mock("@fluxcore/systems/welcome/config", () => ({
  getWelcomeConfig: vi.fn(),
  upsertWelcomeConfig: vi.fn(),
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import { registerWelcomeRoutes } from "../../../../src/server/features/welcome/routes.js";
import { globalRateLimitOptions } from "../../../../src/server/shared/rateLimit.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  // Mirror index.ts so the real key generator and error builder are exercised.
  await app.register(fastifyRateLimit, globalRateLimitOptions);
  registerWelcomeRoutes(app);
  await app.ready();
  return app;
}

// detectImageType needs >= 12 bytes and matching PNG magic bytes.
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG = Buffer.concat([PNG_HEADER, Buffer.alloc(16)]).toString("base64");

function previewRequest(app: Awaited<ReturnType<typeof buildApp>>, session: string) {
  return app.inject({
    method: "POST",
    url: "/api/guilds/guild-1/welcome/image/preview",
    cookies: { session: app.signCookie(session) },
    payload: { settings: {}, type: "welcome" },
  });
}

function uploadRequest(app: Awaited<ReturnType<typeof buildApp>>, session: string) {
  return app.inject({
    method: "POST",
    url: "/api/guilds/guild-1/welcome/image/background",
    cookies: { session: app.signCookie(session) },
    payload: { data: PNG, contentType: "image/png" },
  });
}

describe("welcome image endpoints — rate limiting", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("allows 40 previews then rejects the 41st", async () => {
    for (let i = 0; i < 40; i++) {
      const res = await previewRequest(app, "session-a");
      expect(res.statusCode).toBe(200);
    }
    const blocked = await previewRequest(app, "session-a");
    expect(blocked.statusCode).toBe(429);
  });

  it("returns the shared error key and a Retry-After header on 429", async () => {
    for (let i = 0; i < 40; i++) await previewRequest(app, "session-a");
    const blocked = await previewRequest(app, "session-a");

    expect(blocked.json<{ errorKey: string }>().errorKey).toBe("errors:server.rateLimited");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("gives separate sessions separate buckets", async () => {
    // Regression test for the shared-bucket defect: before per-session keying,
    // one client exhausting the limit blocked everyone else.
    for (let i = 0; i < 40; i++) await previewRequest(app, "session-a");
    expect((await previewRequest(app, "session-a")).statusCode).toBe(429);

    const otherUser = await previewRequest(app, "session-b");
    expect(otherUser.statusCode).toBe(200);
  });

  it("allows 10 background uploads then rejects the 11th", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await uploadRequest(app, "session-c");
      expect(res.statusCode).toBe(200);
    }
    const blocked = await uploadRequest(app, "session-c");
    expect(blocked.statusCode).toBe(429);
  });

  it("counts uploads separately from previews", async () => {
    // Distinct routes get distinct child stores, so exhausting one must not
    // consume the other's budget.
    for (let i = 0; i < 10; i++) await uploadRequest(app, "session-d");
    expect((await uploadRequest(app, "session-d")).statusCode).toBe(429);

    expect((await previewRequest(app, "session-d")).statusCode).toBe(200);
  });
});
