import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-bot-token",
    clientId: "test-client-id",
    logLevel: "info",
  },
}));

vi.mock("@fluxcore/utils", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const {
  isBotInGuild,
  getGuildChannels,
  getGuildRoles,
  getGuildMember,
  channelExistsInGuild,
} = await import("../../../src/server/shared/discordApi.js");

// Use a unique counter per test to avoid cross-test cache hits
let testCounter = 0;

describe("discordApi module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    testCounter++;
  });

  describe("isBotInGuild", () => {
    it("returns true when guild exists", async () => {
      const guildId = `guild-exists-${testCounter}`;
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: guildId }),
      } as Response);

      const result = await isBotInGuild(guildId);
      expect(result).toBe(true);
    });

    it("returns false when guild returns 404", async () => {
      const guildId = `guild-404-${testCounter}`;
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await isBotInGuild(guildId);
      expect(result).toBe(false);
    });

    it("returns false when guild returns 403", async () => {
      const guildId = `guild-403-${testCounter}`;
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      const result = await isBotInGuild(guildId);
      expect(result).toBe(false);
    });

    it("uses bot token for authentication", async () => {
      const guildId = `guild-auth-${testCounter}`;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: guildId }),
      } as Response);

      await isBotInGuild(guildId);

      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<
        string,
        string
      >;
      expect(headers.Authorization).toBe("Bot test-bot-token");
    });
  });

  describe("getGuildChannels", () => {
    it("returns channels for a valid guild", async () => {
      const guildId = `guild-channels-${testCounter}`;
      const mockChannels = [
        { id: "ch-1", name: "general", type: 0 },
        { id: "ch-2", name: "voice", type: 2 },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChannels),
      } as Response);

      const result = await getGuildChannels(guildId);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("general");
    });

    it("returns empty array when bot cant access guild", async () => {
      const guildId = `guild-no-channels-${testCounter}`;
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await getGuildChannels(guildId);
      expect(result).toEqual([]);
    });
  });

  describe("getGuildRoles", () => {
    it("returns roles for a valid guild", async () => {
      const guildId = `guild-roles-${testCounter}`;
      const mockRoles = [
        { id: "r-1", name: "Admin", color: 0xff0000 },
        { id: "r-2", name: "Member", color: 0x00ff00 },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRoles),
      } as Response);

      const result = await getGuildRoles(guildId);
      expect(result).toHaveLength(2);
    });

    it("returns empty array when bot cant access guild", async () => {
      const guildId = `guild-no-roles-${testCounter}`;
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      const result = await getGuildRoles(guildId);
      expect(result).toEqual([]);
    });
  });

  describe("getGuildMember", () => {
    it("returns the member (role IDs) when present", async () => {
      const guildId = `member-ok-${testCounter}`;
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ roles: ["r1", "r2"], user: { id: "u1" } }),
      } as Response);

      const member = await getGuildMember(guildId, "u1");
      expect(member).toEqual({ roles: ["r1", "r2"], user: { id: "u1" } });
    });

    it("returns null when the user is not a member (404)", async () => {
      const guildId = `member-404-${testCounter}`;
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const member = await getGuildMember(guildId, "u-missing");
      expect(member).toBeNull();
    });

    it("caches the result (including null) to avoid repeat calls", async () => {
      const guildId = `member-cache-${testCounter}`;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await getGuildMember(guildId, "u1");
      await getGuildMember(guildId, "u1");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("uses the bot token and the member endpoint", async () => {
      const guildId = `member-auth-${testCounter}`;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ roles: [] }),
      } as Response);

      await getGuildMember(guildId, "u1");

      const [url, init] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain(`/guilds/${guildId}/members/u1`);
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bot test-bot-token");
    });
  });

  describe("channelExistsInGuild", () => {
    it("returns true when channel exists in guild", async () => {
      const guildId = `guild-ch-exists-${testCounter}`;
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: "ch-1", name: "general", type: 0 },
            { id: "ch-2", name: "voice", type: 2 },
          ]),
      } as Response);

      const result = await channelExistsInGuild(guildId, "ch-1");
      expect(result).toBe(true);
    });

    it("returns false when channel does not exist", async () => {
      const guildId = `guild-ch-missing-${testCounter}`;
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([{ id: "ch-1", name: "general", type: 0 }]),
      } as Response);

      const result = await channelExistsInGuild(guildId, "nonexistent");
      expect(result).toBe(false);
    });
  });
});
