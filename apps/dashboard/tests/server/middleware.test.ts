import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    logLevel: "info",
  },
}));

const mockGetSession = vi.fn().mockResolvedValue(null);
vi.mock("../../src/server/session.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));

const mockIsBotInGuild = vi.fn().mockResolvedValue(true);
const mockGetGuildOwnerId = vi.fn().mockResolvedValue("owner-1");
vi.mock("../../src/server/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
  getGuildOwnerId: (...args: unknown[]) => mockGetGuildOwnerId(...args),
}));

vi.mock("../../src/server/permissions.js", () => ({
  resolveUserPermissions: vi.fn().mockResolvedValue({ permissions: new Set(["*"]), isOwner: false }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { requireAuth, requireGuildAdmin } = await import(
  "../../src/server/middleware.js"
);

function createMockRequest({
  sessionCookie = undefined as string | undefined,
  session = undefined as unknown,
  params = {} as Record<string, string>,
} = {}) {
  return {
    cookies: sessionCookie ? { session: sessionCookie } : {},
    unsignCookie: (value: string) => ({ valid: true, value, renew: false }),
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
  });

  describe("requireAuth", () => {
    it("returns 401 when no session cookie", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      await requireAuth(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        error: "Not authenticated",
      });
    });

    it("returns 401 when session is expired/invalid", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const request = createMockRequest({ sessionCookie: "invalid-id" });
      const reply = createMockReply();

      await requireAuth(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        error: "Session expired",
      });
    });

    it("attaches session to request when valid", async () => {
      const session = {
        userId: "user-123",
        username: "testuser",
        guilds: [],
      };
      mockGetSession.mockResolvedValueOnce(session);
      const request = createMockRequest({ sessionCookie: "valid-id" });
      const reply = createMockReply();

      await requireAuth(request as never, reply as never);

      expect((request as Record<string, unknown>).session).toEqual(session);
      expect(reply.code).not.toHaveBeenCalled();
    });
  });

  describe("requireGuildAdmin", () => {
    const MANAGE_GUILD = BigInt(0x20);

    it("returns 403 when user has no guild permission", async () => {
      const request = createMockRequest({
        session: {
          guilds: [{ id: "guild-1", permissions: "0" }],
        },
        params: { guildId: "guild-1" },
      });
      const reply = createMockReply();

      await requireGuildAdmin(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        error: "No permission for this guild",
      });
    });

    it("returns 403 when user is not in the guild", async () => {
      const request = createMockRequest({
        session: {
          guilds: [
            { id: "other-guild", permissions: MANAGE_GUILD.toString() },
          ],
        },
        params: { guildId: "guild-1" },
      });
      const reply = createMockReply();

      await requireGuildAdmin(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(403);
    });

    it("returns 403 when bot is not in the guild", async () => {
      mockIsBotInGuild.mockResolvedValueOnce(false);
      const request = createMockRequest({
        session: {
          guilds: [
            { id: "guild-1", permissions: MANAGE_GUILD.toString() },
          ],
        },
        params: { guildId: "guild-1" },
      });
      const reply = createMockReply();

      await requireGuildAdmin(request as never, reply as never);

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        error: "Bot is not in this guild",
      });
    });

    it("passes when user has MANAGE_GUILD and bot is present", async () => {
      mockIsBotInGuild.mockResolvedValueOnce(true);
      const request = createMockRequest({
        session: {
          guilds: [
            { id: "guild-1", permissions: MANAGE_GUILD.toString() },
          ],
        },
        params: { guildId: "guild-1" },
      });
      const reply = createMockReply();

      await requireGuildAdmin(request as never, reply as never);

      expect(reply.code).not.toHaveBeenCalled();
    });
  });
});
