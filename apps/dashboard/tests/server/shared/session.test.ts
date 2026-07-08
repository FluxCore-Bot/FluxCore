import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    dashboardSessionSecret: "test-session-secret-for-encryption",
    logLevel: "info",
  },
}));

const mockPrisma = {
  dashboardSession: {
    create: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue(null),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    update: vi.fn().mockResolvedValue({}),
  },
};

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => mockPrisma,
}));

const mockFetchGuilds = vi.fn();
vi.mock("../../../src/server/shared/auth.js", () => ({
  fetchGuilds: (...args: unknown[]) => mockFetchGuilds(...args),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

const { encrypt } = await import("../../../src/server/shared/crypto.js");
const {
  createSession,
  getSession,
  deleteSession,
  ensureFreshGuilds,
  __setSessionCacheForTest,
} = await import("../../../src/server/shared/session.js");

describe("session module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const testSessionData = {
    userId: "user-123",
    username: "testuser",
    avatar: "abc",
    accessToken: "token-xyz",
    guilds: [
      { id: "g1", name: "Guild 1", icon: null, permissions: "8" },
    ],
  };

  describe("createSession", () => {
    it("creates a session and returns session ID", async () => {
      const id = await createSession(testSessionData);

      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      const createCall = mockPrisma.dashboardSession.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe("user-123");
      expect(createCall.data.username).toBe("testuser");
      // accessToken should be encrypted (not stored as plaintext)
      expect(createCall.data.accessToken).not.toBe("token-xyz");
    });

    it("stores guilds as JSON string", async () => {
      await createSession(testSessionData);

      const createCall = mockPrisma.dashboardSession.create.mock.calls[0][0];
      expect(typeof createCall.data.guilds).toBe("string");
      expect(JSON.parse(createCall.data.guilds)).toEqual(
        testSessionData.guilds,
      );
    });

    it("sets expiration to 24 hours from now", async () => {
      const before = Date.now();
      await createSession(testSessionData);
      const after = Date.now();

      const createCall = mockPrisma.dashboardSession.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt.getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(before + twentyFourHours - 100);
      expect(expiresAt).toBeLessThanOrEqual(after + twentyFourHours + 100);
    });
  });

  describe("getSession", () => {
    it("returns null for non-existent session", async () => {
      mockPrisma.dashboardSession.findUnique.mockResolvedValueOnce(null);

      const result = await getSession("nonexistent-id");
      expect(result).toBeNull();
    });

    it("returns session data for valid session", async () => {
      mockPrisma.dashboardSession.findUnique.mockResolvedValueOnce({
        id: "session-1",
        userId: "user-123",
        username: "testuser",
        avatar: "abc",
        accessToken: encrypt("token-xyz"),
        guilds: JSON.stringify(testSessionData.guilds),
        guildsRefreshedAt: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600_000), // Not expired
      });

      const result = await getSession("session-1");
      expect(result).not.toBeNull();
      expect(result!.userId).toBe("user-123");
      expect(result!.accessToken).toBe("token-xyz");
      expect(result!.guilds).toEqual(testSessionData.guilds);
    });

    it("returns null and deletes expired session", async () => {
      mockPrisma.dashboardSession.findUnique.mockResolvedValueOnce({
        id: "expired-session",
        userId: "user-123",
        username: "testuser",
        avatar: null,
        accessToken: "token-xyz",
        guilds: "[]",
        createdAt: new Date(Date.now() - 7200_000),
        expiresAt: new Date(Date.now() - 3600_000), // Already expired
      });

      const result = await getSession("expired-session");
      expect(result).toBeNull();
      expect(mockPrisma.dashboardSession.deleteMany).toHaveBeenCalledWith({
        where: { id: "expired-session" },
      });
    });
  });

  describe("createSession session regeneration", () => {
    it("deletes existing sessions for the user before creating a new one", async () => {
      await createSession({
        userId: "user-regen",
        username: "u",
        avatar: null,
        accessToken: "tok",
        guilds: [],
      });

      // deleteMany must have been called for this user
      const deleteCalls =
        mockPrisma.dashboardSession.deleteMany.mock.calls.filter(
          (c) =>
            (c[0] as { where?: { userId?: string } })?.where?.userId ===
            "user-regen",
        );
      expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
      expect(mockPrisma.dashboardSession.create).toHaveBeenCalled();

      // delete must be called before create (compare invocation order across all calls)
      const firstDeleteOrder =
        mockPrisma.dashboardSession.deleteMany.mock.invocationCallOrder[0];
      const firstCreateOrder =
        mockPrisma.dashboardSession.create.mock.invocationCallOrder[0];
      expect(firstDeleteOrder).toBeLessThan(firstCreateOrder);
    });
  });

  describe("ensureFreshGuilds", () => {
    it("re-fetches when cached entry is older than 5 minutes", async () => {
      const sixMinAgo = Date.now() - 6 * 60 * 1000;
      const session = {
        userId: "u",
        username: "u",
        avatar: null,
        accessToken: "tok",
        guilds: [],
        createdAt: Date.now(),
      };
      __setSessionCacheForTest("sid-stale", {
        session,
        cacheExpiresAt: Date.now() + 30_000,
        sessionExpiresAt: Date.now() + 1_000_000,
        guildsRefreshedAt: sixMinAgo,
      });
      mockFetchGuilds.mockResolvedValueOnce([
        { id: "g1", name: "g", icon: null, permissions: "32" },
      ]);

      const result = await ensureFreshGuilds("sid-stale");
      expect(mockFetchGuilds).toHaveBeenCalledOnce();
      expect(result).not.toBeNull();
      expect(result![0]?.id).toBe("g1");
    });

    it("does not re-fetch when cached entry is fresh", async () => {
      mockFetchGuilds.mockClear();
      __setSessionCacheForTest("sid-fresh", {
        session: {
          userId: "u",
          username: "u",
          avatar: null,
          accessToken: "tok",
          guilds: [{ id: "g0", name: "g", icon: null, permissions: "32" }],
          createdAt: Date.now(),
        },
        cacheExpiresAt: Date.now() + 30_000,
        sessionExpiresAt: Date.now() + 1_000_000,
        guildsRefreshedAt: Date.now() - 1_000,
      });

      const result = await ensureFreshGuilds("sid-fresh");
      expect(mockFetchGuilds).not.toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result![0]?.id).toBe("g0");
    });
  });

  describe("deleteSession", () => {
    it("deletes session by ID", async () => {
      await deleteSession("session-1");

      expect(mockPrisma.dashboardSession.deleteMany).toHaveBeenCalledWith({
        where: { id: "session-1" },
      });
    });
  });
});

describe("session TTL configuration", () => {
  const here = dirname(fileURLToPath(import.meta.url));

  it("session.ts SESSION_TTL is 24 hours", () => {
    const src = readFileSync(
      resolve(here, "../../../src/server/shared/session.ts"),
      "utf8",
    );
    const match = /const\s+SESSION_TTL\s*=\s*([^;]+);/.exec(src);
    expect(match, "SESSION_TTL not found").toBeTruthy();
    // 24 * 60 * 60 * 1000 = 86_400_000
    // eslint-disable-next-line no-eval
    const value = eval(match![1]) as number;
    expect(value).toBe(24 * 60 * 60 * 1000);
  });

  it("session.ts touchSession cookie maxAge is 86400", () => {
    const src = readFileSync(
      resolve(here, "../../../src/server/shared/session.ts"),
      "utf8",
    );
    expect(src).toMatch(/maxAge:\s*86400\b/);
    expect(src).not.toMatch(/maxAge:\s*604800\b/);
  });

  it("auth routes.ts session cookie maxAge is 86400", () => {
    const src = readFileSync(
      resolve(here, "../../../src/server/features/auth/routes.ts"),
      "utf8",
    );
    // The session cookie (not oauth_state) should be 24h
    const sessionBlock = /setCookie\("session"[\s\S]*?\}\)/.exec(src);
    expect(sessionBlock, "session setCookie block not found").toBeTruthy();
    expect(sessionBlock![0]).toMatch(/maxAge:\s*86400\b/);
  });
});
