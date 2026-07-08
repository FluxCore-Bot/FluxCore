import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    logLevel: "info",
  },
}));

const mockGetSession = vi.fn().mockResolvedValue(null);
vi.mock("../../../src/server/shared/session.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));

const mockIsBotInGuild = vi.fn().mockResolvedValue(true);
vi.mock("../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
}));

const mockResolveUserPermissions = vi.fn();
vi.mock("../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: (...args: unknown[]) =>
    mockResolveUserPermissions(...args),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { requireAuth, requireGuildAdmin } = await import(
  "../../../src/server/shared/middleware.js"
);

function createMockRequest({
  sessionCookie = undefined as string | undefined,
  session = undefined as unknown,
  params = {} as Record<string, string>,
} = {}) {
  return {
    cookies: sessionCookie ? { session: sessionCookie } : {},
    unsignCookie: (value: string) => ({ valid: true, value, renew: false }),
    t: (key: string) => key,
    session,
    params,
  };
}

function createMockReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply;
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBotInGuild.mockResolvedValue(true);
    // Default: a current guild admin (legacy full access).
    mockResolveUserPermissions.mockResolvedValue({
      permissions: new Set(["*"]),
      isOwner: false,
      isGuildAdmin: true,
    });
  });

  describe("requireAuth", () => {
    it("returns 401 when no session cookie", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      await requireAuth(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ errorKey: "errors:auth.notAuthenticated" }),
      );
    });

    it("returns 401 when session is expired/invalid", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const request = createMockRequest({ sessionCookie: "invalid-id" });
      const reply = createMockReply();

      await requireAuth(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ errorKey: "errors:auth.sessionExpired" }),
      );
    });

    it("attaches session to request when valid", async () => {
      const session = { userId: "user-123", username: "testuser", guilds: [] };
      mockGetSession.mockResolvedValueOnce(session);
      const request = createMockRequest({ sessionCookie: "valid-id" });
      const reply = createMockReply();

      await requireAuth(request as never, reply as never);

      expect((request as Record<string, unknown>).session).toEqual(session);
      expect(reply.code).not.toHaveBeenCalled();
    });
  });

  describe("requireGuildAdmin", () => {
    function adminRequest() {
      return createMockRequest({
        session: { userId: "user-1", guilds: [] },
        params: { guildId: "guild-1" },
      });
    }

    it("returns 403 when the bot is not in the guild", async () => {
      mockIsBotInGuild.mockResolvedValueOnce(false);
      const request = adminRequest();
      const reply = createMockReply();

      await requireGuildAdmin(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ errorKey: "errors:permissions.botNotInGuild" }),
      );
    });

    it("returns 403 when the user is no longer a guild admin (revoked)", async () => {
      // Live check says the user has no current authority — the security fix.
      mockResolveUserPermissions.mockResolvedValueOnce({
        permissions: new Set(),
        isOwner: false,
        isGuildAdmin: false,
      });
      const request = adminRequest();
      const reply = createMockReply();

      await requireGuildAdmin(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          errorKey: "errors:permissions.noGuildPermission",
        }),
      );
    });

    it("does not trust the session snapshot — denies even if it says admin", async () => {
      // Session snapshot still claims Manage Server, but the live check revokes.
      mockResolveUserPermissions.mockResolvedValueOnce({
        permissions: new Set(),
        isOwner: false,
        isGuildAdmin: false,
      });
      const request = createMockRequest({
        session: {
          userId: "user-1",
          guilds: [{ id: "guild-1", permissions: BigInt(0x20).toString() }],
        },
        params: { guildId: "guild-1" },
      });
      const reply = createMockReply();

      await requireGuildAdmin(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(403);
    });

    it("passes for a live guild admin and attaches resolved permissions", async () => {
      const request = adminRequest();
      const reply = createMockReply();

      await requireGuildAdmin(request as never, reply as never);

      expect(reply.code).not.toHaveBeenCalled();
      expect(
        (request as Record<string, unknown>).resolvedPermissions,
      ).toBeDefined();
    });

    it("passes for the guild owner", async () => {
      mockResolveUserPermissions.mockResolvedValueOnce({
        permissions: new Set(["*"]),
        isOwner: true,
        isGuildAdmin: true,
      });
      const request = adminRequest();
      const reply = createMockReply();

      await requireGuildAdmin(request as never, reply as never);

      expect(reply.code).not.toHaveBeenCalled();
    });

    it("passes for an RBAC admin with a limited permission set", async () => {
      mockResolveUserPermissions.mockResolvedValueOnce({
        permissions: new Set(["actions.rules.manage"]),
        isOwner: false,
        isGuildAdmin: true,
      });
      const request = adminRequest();
      const reply = createMockReply();

      await requireGuildAdmin(request as never, reply as never);

      expect(reply.code).not.toHaveBeenCalled();
    });
  });
});
