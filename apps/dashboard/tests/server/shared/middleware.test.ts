import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResolvedPermissions } from "../../../src/server/shared/permissions.js";

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

const { requireAuth, requireGuildAccess } = await import(
  "../../../src/server/shared/middleware.js"
);

interface MockRequest {
  cookies: Record<string, string>;
  unsignCookie: (value: string) => { valid: boolean; value: string; renew: boolean };
  t: (key: string) => string;
  session: unknown;
  params: Record<string, string>;
  // Populated by requireGuildAccess on success — declared here (rather than
  // read back via a cast) so assertions can access it directly.
  resolvedPermissions?: ResolvedPermissions;
}

function createMockRequest({
  sessionCookie = undefined as string | undefined,
  session = undefined as unknown,
  params = {} as Record<string, string>,
} = {}): MockRequest {
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
      isGuildMember: true,
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

      expect(request.session).toEqual(session);
      expect(reply.code).not.toHaveBeenCalled();
    });
  });

  describe("requireGuildAccess", () => {
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

      await requireGuildAccess(request as never, reply as never);

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
        isGuildMember: true,
      });
      const request = adminRequest();
      const reply = createMockReply();

      await requireGuildAccess(request as never, reply as never);

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
        isGuildMember: true,
      });
      const request = createMockRequest({
        session: {
          userId: "user-1",
          guilds: [{ id: "guild-1", permissions: BigInt(0x20).toString() }],
        },
        params: { guildId: "guild-1" },
      });
      const reply = createMockReply();

      await requireGuildAccess(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(403);
    });

    it("passes for a live guild admin and attaches resolved permissions", async () => {
      const request = adminRequest();
      const reply = createMockReply();

      await requireGuildAccess(request as never, reply as never);

      expect(reply.code).not.toHaveBeenCalled();
      expect(request.resolvedPermissions).toBeDefined();
    });

    it("passes for the guild owner", async () => {
      mockResolveUserPermissions.mockResolvedValueOnce({
        permissions: new Set(["*"]),
        isOwner: true,
        isGuildAdmin: true,
        isGuildMember: true,
      });
      const request = adminRequest();
      const reply = createMockReply();

      await requireGuildAccess(request as never, reply as never);

      expect(reply.code).not.toHaveBeenCalled();
    });

    it("passes for an RBAC admin with a limited permission set", async () => {
      mockResolveUserPermissions.mockResolvedValueOnce({
        permissions: new Set(["actions.rules.manage"]),
        isOwner: false,
        isGuildAdmin: true,
        isGuildMember: true,
      });
      const request = adminRequest();
      const reply = createMockReply();

      await requireGuildAccess(request as never, reply as never);

      expect(reply.code).not.toHaveBeenCalled();
    });

    // This is the discriminator for the `permissions.size > 0` rewrite: the
    // set below is non-empty but contains no "*", so the OLD gate
    // (isOwner || isGuildAdmin || permissions.has("*")) would 403 this
    // request, while the NEW gate allows it. The "rejects a member holding
    // no grants" / "rejects a non-member" cases below both use an empty set,
    // which fails identically under old and new — they're regression guards,
    // not discriminators. This is the one that actually proves the rewrite.
    it("allows a non-admin member holding explicit grants (size>0 discriminator)", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["tickets.list.view"]),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      const request = createMockRequest({
        session: { userId: "user-1" },
        params: { guildId: "guild-1" },
      });
      const reply = createMockReply();

      await requireGuildAccess(request as never, reply as never);

      expect(reply.code).not.toHaveBeenCalled();
      expect(
        request.resolvedPermissions?.permissions.has("tickets.list.view"),
      ).toBe(true);
    });

    it("rejects a member holding no grants", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      const request = createMockRequest({
        session: { userId: "user-1" },
        params: { guildId: "guild-1" },
      });
      const reply = createMockReply();

      await requireGuildAccess(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(403);
    });

    it("rejects a non-member", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: false,
      });
      const request = createMockRequest({
        session: { userId: "user-1" },
        params: { guildId: "guild-1" },
      });
      const reply = createMockReply();

      await requireGuildAccess(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(403);
    });
  });
});
