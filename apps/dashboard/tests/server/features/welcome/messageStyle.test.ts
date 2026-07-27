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
vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  touchSession: (...args: unknown[]) => mockTouchSession(...args),
}));

const mockIsBotInGuild = vi.fn().mockResolvedValue(true);
const mockGetGuildOwnerId = vi.fn().mockResolvedValue("owner-1");
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
  getGuildOwnerId: (...args: unknown[]) => mockGetGuildOwnerId(...args),
}));

const mockResolveUserPermissions = vi.fn().mockResolvedValue({
  permissions: new Set(["*"]),
  isOwner: false,
  isGuildAdmin: true,
});
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: (...args: unknown[]) => mockResolveUserPermissions(...args),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockGetWelcomeConfig = vi.fn().mockResolvedValue(null);
const mockUpsertWelcomeConfig = vi.fn().mockResolvedValue({
  guildId: "guild-1",
  welcomeEnabled: false,
  welcomeChannelId: null,
  welcomeMessage: {},
  welcomeMessageStyle: "plain",
  welcomeContent: "",
  farewellEnabled: false,
  farewellChannelId: null,
  farewellMessage: {},
  farewellMessageStyle: "plain",
  farewellContent: "",
  dmEnabled: false,
  dmMessage: {},
  autoRoleIds: [],
  welcomeImageEnabled: false,
  welcomeImageConfig: {},
  farewellImageEnabled: false,
  farewellImageConfig: {},
});
vi.mock("@fluxcore/systems/welcome/config", () => ({
  getWelcomeConfig: (...args: unknown[]) => mockGetWelcomeConfig(...args),
  upsertWelcomeConfig: (...args: unknown[]) => mockUpsertWelcomeConfig(...args),
}));

const mockGenerateWelcomeImage = vi.fn().mockResolvedValue(Buffer.from("fake-png"));
vi.mock("@fluxcore/systems/welcome/image", () => ({
  generateWelcomeImage: (...args: unknown[]) => mockGenerateWelcomeImage(...args),
  getAllTemplates: () => [
    { name: "starter", displayName: "Starter", description: "Classic", canvas: { width: 1024, height: 450 } },
  ],
  getAvailableFonts: () => [
    { name: "Inter", displayName: "Inter", category: "sans-serif", file: "Inter.ttf", weight: 600 },
  ],
  createStorageAdapter: () => ({
    upload: vi.fn().mockResolvedValue("key"),
    delete: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(Buffer.from("")),
    exists: vi.fn().mockResolvedValue(false),
    getUrl: vi.fn().mockReturnValue("/uploads/test"),
  }),
  welcomeImageSettingsSchema: {
    safeParse: (data: unknown) => ({ success: true, data }),
  },
  DEFAULT_WELCOME_IMAGE_SETTINGS: {},
  DEFAULT_FAREWELL_IMAGE_SETTINGS: {},
  MAX_BACKGROUND_SIZE: 3 * 1024 * 1024,
  ALLOWED_BACKGROUND_TYPES: ["image/jpeg", "image/png", "image/webp"],
  PRESET_BACKGROUNDS: ["midnight", "ocean"],
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerWelcomeRoutes } from "../../../../src/server/features/welcome/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerWelcomeRoutes(app);
  await app.ready();
  return app;
}

describe("PUT /api/guilds/:guildId/welcome — message style", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["*"]),
      isOwner: false,
      isGuildAdmin: true,
    });
    mockUpsertWelcomeConfig.mockClear();
    app = await buildApp();
  });

  it("accepts plain and persists it", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/welcome",
      cookies: { session: app.signCookie("valid") },
      payload: { welcomeMessageStyle: "plain", welcomeContent: "Welcome {user}!" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockUpsertWelcomeConfig).toHaveBeenCalledWith(
      "guild-1",
      expect.objectContaining({
        welcomeMessageStyle: "plain",
        welcomeContent: "Welcome {user}!",
      }),
    );
  });

  it("accepts the farewell equivalents", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/welcome",
      cookies: { session: app.signCookie("valid") },
      payload: { farewellMessageStyle: "embed", farewellContent: "Bye {user.name}" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockUpsertWelcomeConfig).toHaveBeenCalledWith(
      "guild-1",
      expect.objectContaining({
        farewellMessageStyle: "embed",
        farewellContent: "Bye {user.name}",
      }),
    );
  });

  it("rejects an unknown style with 400 and never writes", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/welcome",
      cookies: { session: app.signCookie("valid") },
      payload: { welcomeMessageStyle: "carrier-pigeon" },
    });

    expect(res.statusCode).toBe(400);
    expect(mockUpsertWelcomeConfig).not.toHaveBeenCalled();
  });

  it("rejects content over Discord's 2000-character limit", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/welcome",
      cookies: { session: app.signCookie("valid") },
      payload: { welcomeContent: "x".repeat(2001) },
    });

    expect(res.statusCode).toBe(400);
    expect(mockUpsertWelcomeConfig).not.toHaveBeenCalled();
  });

  it("accepts content at exactly 2000 characters", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/welcome",
      cookies: { session: app.signCookie("valid") },
      payload: { welcomeContent: "x".repeat(2000) },
    });

    expect(res.statusCode).toBe(200);
  });

  it("rejects an unauthenticated request with 401", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/welcome",
      payload: { welcomeMessageStyle: "plain" },
    });

    expect(res.statusCode).toBe(401);
  });
});
