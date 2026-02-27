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
  channelExistsInGuild,
} = await import("../../src/server/discordApi.js");

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
