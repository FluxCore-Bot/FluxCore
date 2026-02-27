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
  },
};

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => mockPrisma,
}));

const { encrypt } = await import("../../src/server/crypto.js");
const { createSession, getSession, deleteSession } = await import(
  "../../src/server/session.js"
);

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

    it("sets expiration to 1 hour from now", async () => {
      const before = Date.now();
      await createSession(testSessionData);
      const after = Date.now();

      const createCall = mockPrisma.dashboardSession.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt.getTime();
      const oneHour = 60 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(before + oneHour - 100);
      expect(expiresAt).toBeLessThanOrEqual(after + oneHour + 100);
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

  describe("deleteSession", () => {
    it("deletes session by ID", async () => {
      await deleteSession("session-1");

      expect(mockPrisma.dashboardSession.deleteMany).toHaveBeenCalledWith({
        where: { id: "session-1" },
      });
    });
  });
});
