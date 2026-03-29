import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/database", () => ({
  getPrisma: vi.fn(),
}));

import { getPrisma } from "@fluxcore/database";

const mockPrisma = {
  suggestion: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  suggestionGuildSettings: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
};

(getPrisma as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma);

const { createSuggestion, getSuggestion, getSuggestions, updateSuggestionStatus, deleteSuggestion } =
  await import("../../src/suggestions/persistence.js");
const { getSuggestionSettings, upsertSuggestionSettings } =
  await import("../../src/suggestions/config.js");

describe("suggestions persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSuggestion", () => {
    it("creates a new suggestion", async () => {
      const created = {
        id: 1,
        guildId: "guild-1",
        userId: "user-1",
        content: "Test suggestion",
        status: "pending",
      };
      mockPrisma.suggestion.create.mockResolvedValueOnce(created);

      const result = await createSuggestion("guild-1", "user-1", "Test suggestion");

      expect(mockPrisma.suggestion.create).toHaveBeenCalledWith({
        data: { guildId: "guild-1", userId: "user-1", content: "Test suggestion" },
      });
      expect(result.id).toBe(1);
    });
  });

  describe("getSuggestion", () => {
    it("returns a suggestion by id and guild", async () => {
      const suggestion = { id: 1, guildId: "guild-1", content: "Test" };
      mockPrisma.suggestion.findFirst.mockResolvedValueOnce(suggestion);

      const result = await getSuggestion(1, "guild-1");

      expect(result).toEqual(suggestion);
      expect(mockPrisma.suggestion.findFirst).toHaveBeenCalledWith({
        where: { id: 1, guildId: "guild-1" },
      });
    });

    it("returns null when not found", async () => {
      mockPrisma.suggestion.findFirst.mockResolvedValueOnce(null);

      const result = await getSuggestion(999, "guild-1");
      expect(result).toBeNull();
    });
  });

  describe("getSuggestions", () => {
    it("returns paginated suggestions", async () => {
      const suggestions = [{ id: 1 }, { id: 2 }];
      mockPrisma.suggestion.findMany.mockResolvedValueOnce(suggestions);
      mockPrisma.suggestion.count.mockResolvedValueOnce(2);

      const result = await getSuggestions("guild-1", { page: 1, limit: 10 });

      expect(result.suggestions).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("filters by status", async () => {
      mockPrisma.suggestion.findMany.mockResolvedValueOnce([]);
      mockPrisma.suggestion.count.mockResolvedValueOnce(0);

      await getSuggestions("guild-1", { status: "approved" });

      expect(mockPrisma.suggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guildId: "guild-1", status: "approved" },
        }),
      );
    });
  });

  describe("updateSuggestionStatus", () => {
    it("updates the status of an existing suggestion", async () => {
      const existing = { id: 1, guildId: "guild-1" };
      mockPrisma.suggestion.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.suggestion.update.mockResolvedValueOnce({
        ...existing,
        status: "approved",
        statusBy: "mod-1",
        statusReason: "Good idea",
      });

      const result = await updateSuggestionStatus(1, "guild-1", "approved", "mod-1", "Good idea");

      expect(result).not.toBeNull();
      expect(mockPrisma.suggestion.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: "approved", statusBy: "mod-1", statusReason: "Good idea" },
      });
    });

    it("returns null for non-existent suggestion", async () => {
      mockPrisma.suggestion.findFirst.mockResolvedValueOnce(null);

      const result = await updateSuggestionStatus(999, "guild-1", "approved", "mod-1");
      expect(result).toBeNull();
      expect(mockPrisma.suggestion.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteSuggestion", () => {
    it("deletes and returns true", async () => {
      mockPrisma.suggestion.deleteMany.mockResolvedValueOnce({ count: 1 });

      const result = await deleteSuggestion(1, "guild-1");
      expect(result).toBe(true);
    });

    it("returns false when not found", async () => {
      mockPrisma.suggestion.deleteMany.mockResolvedValueOnce({ count: 0 });

      const result = await deleteSuggestion(999, "guild-1");
      expect(result).toBe(false);
    });
  });
});

describe("suggestions config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSuggestionSettings", () => {
    it("returns existing settings", async () => {
      const settings = {
        guildId: "guild-1",
        enabled: true,
        channelId: "ch-1",
        reviewChannelId: null,
        dmOnStatusChange: true,
        autoThread: false,
        anonymousMode: false,
      };
      mockPrisma.suggestionGuildSettings.findUnique.mockResolvedValueOnce(settings);

      const result = await getSuggestionSettings("guild-1");
      expect(result).toEqual(settings);
    });

    it("returns defaults when no settings exist", async () => {
      mockPrisma.suggestionGuildSettings.findUnique.mockResolvedValueOnce(null);

      const result = await getSuggestionSettings("guild-1");
      expect(result.guildId).toBe("guild-1");
      expect(result.enabled).toBe(true);
      expect(result.channelId).toBeNull();
    });
  });

  describe("upsertSuggestionSettings", () => {
    it("upserts settings", async () => {
      const updated = {
        guildId: "guild-1",
        enabled: false,
        channelId: "ch-1",
        reviewChannelId: null,
        dmOnStatusChange: true,
        autoThread: false,
        anonymousMode: false,
      };
      mockPrisma.suggestionGuildSettings.upsert.mockResolvedValueOnce(updated);

      const result = await upsertSuggestionSettings("guild-1", { enabled: false });
      expect(result.enabled).toBe(false);
      expect(mockPrisma.suggestionGuildSettings.upsert).toHaveBeenCalledWith({
        where: { guildId: "guild-1" },
        create: { guildId: "guild-1", enabled: false },
        update: { enabled: false },
      });
    });
  });
});
