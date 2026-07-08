import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    dashboardClientSecret: "test-secret",
    dashboardCallbackUrl: "http://localhost:3000/auth/callback",
    logLevel: "info",
  },
}));

const { getAuthorizationUrl, exchangeCode, fetchUser, fetchGuilds } =
  await import("../../../src/server/shared/auth.js");

const CALLBACK_URL = "http://localhost:3000/auth/callback";

describe("auth module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("getAuthorizationUrl", () => {
    it("returns a valid Discord OAuth2 URL", () => {
      const { url, state } = getAuthorizationUrl(CALLBACK_URL);
      expect(url).toContain("discord.com/api/v10/oauth2/authorize");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("response_type=code");
      expect(url).toContain("scope=identify+guilds");
      expect(state).toBeDefined();
      expect(typeof state).toBe("string");
    });

    it("includes the callback URL", () => {
      const { url } = getAuthorizationUrl(CALLBACK_URL);
      expect(url).toContain(
        encodeURIComponent("http://localhost:3000/auth/callback"),
      );
    });
  });

  describe("exchangeCode", () => {
    it("exchanges code for tokens successfully", async () => {
      const mockResponse = {
        access_token: "mock-token",
        token_type: "Bearer",
        expires_in: 604800,
        scope: "identify guilds",
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await exchangeCode("test-code", CALLBACK_URL);
      expect(result.access_token).toBe("mock-token");
    });

    it("throws on failed token exchange", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as Response);

      await expect(exchangeCode("bad-code", CALLBACK_URL)).rejects.toThrow(
        "Token exchange failed: 400",
      );
    });
  });

  describe("fetchUser", () => {
    it("fetches user info successfully", async () => {
      const mockUser = {
        id: "123",
        username: "testuser",
        avatar: "abc123",
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser),
      } as Response);

      const result = await fetchUser("mock-token");
      expect(result.id).toBe("123");
      expect(result.username).toBe("testuser");
    });

    it("throws on failed user fetch", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(fetchUser("bad-token")).rejects.toThrow(
        "Failed to fetch user: 401",
      );
    });
  });

  describe("fetchGuilds", () => {
    it("fetches guilds successfully", async () => {
      const mockGuilds = [
        { id: "g1", name: "Guild 1", icon: null, permissions: "8" },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGuilds),
      } as Response);

      const result = await fetchGuilds("mock-token");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Guild 1");
    });

    it("throws on failed guild fetch", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(fetchGuilds("bad-token")).rejects.toThrow(
        "Failed to fetch guilds: 401",
      );
    });
  });
});
