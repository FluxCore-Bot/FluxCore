import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";

vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

const mockGetSuggestionSettings = vi.fn();
const mockUpsertSuggestionSettings = vi.fn();
vi.mock("@fluxcore/systems/suggestions/config", () => ({
  getSuggestionSettings: (...args: unknown[]) => mockGetSuggestionSettings(...args),
  upsertSuggestionSettings: (...args: unknown[]) => mockUpsertSuggestionSettings(...args),
}));

const mockGetSuggestions = vi.fn();
const mockGetSuggestion = vi.fn();
const mockCreateSuggestion = vi.fn();
const mockUpdateSuggestionStatus = vi.fn();
const mockDeleteSuggestion = vi.fn();
vi.mock("@fluxcore/systems/suggestions/persistence", () => ({
  getSuggestions: (...args: unknown[]) => mockGetSuggestions(...args),
  getSuggestion: (...args: unknown[]) => mockGetSuggestion(...args),
  createSuggestion: (...args: unknown[]) => mockCreateSuggestion(...args),
  updateSuggestionStatus: (...args: unknown[]) => mockUpdateSuggestionStatus(...args),
  deleteSuggestion: (...args: unknown[]) => mockDeleteSuggestion(...args),
}));

vi.mock("@fluxcore/systems/suggestions/constants", () => ({
  SUGGESTIONS_PAGE_SIZE: 10,
  VALID_STATUSES: ["pending", "approved", "denied", "implemented"],
}));

// Mock middleware
const mockSession = {
  userId: "user-123",
  username: "TestUser",
  avatar: null,
  guilds: [
    { id: "guild-123", name: "Test Guild", icon: null, permissions: "2147483647" },
  ],
};

vi.mock("../../src/server/middleware.js", () => ({
  requireAuth: vi.fn(async (request: { session: typeof mockSession }) => {
    request.session = mockSession;
  }),
  requireGuildAdmin: vi.fn(async () => {}),
}));

const { registerSuggestionRoutes } = await import("../../../src/server/routes/suggestions.js");

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(fastifyCookie);
  registerSuggestionRoutes(app);
  await app.ready();
  return app;
}

describe("suggestions routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/guilds/:guildId/suggestions", () => {
    it("returns suggestions list", async () => {
      const app = await buildApp();
      mockGetSuggestions.mockResolvedValueOnce({
        suggestions: [
          { id: 1, guildId: "guild-123", userId: "user-1", content: "Test", status: "pending" },
        ],
        total: 1,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-123/suggestions",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.suggestions).toHaveLength(1);
      expect(body.total).toBe(1);
      await app.close();
    });

    it("passes status filter", async () => {
      const app = await buildApp();
      mockGetSuggestions.mockResolvedValueOnce({ suggestions: [], total: 0 });

      await app.inject({
        method: "GET",
        url: "/api/guilds/guild-123/suggestions?status=approved",
      });

      expect(mockGetSuggestions).toHaveBeenCalledWith(
        "guild-123",
        expect.objectContaining({ status: "approved" }),
      );
      await app.close();
    });
  });

  describe("PUT /api/guilds/:guildId/suggestions/:id/status", () => {
    it("updates suggestion status", async () => {
      const app = await buildApp();
      mockUpdateSuggestionStatus.mockResolvedValueOnce({
        id: 1,
        status: "approved",
        statusBy: "user-123",
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-123/suggestions/1/status",
        payload: { status: "approved", reason: "Looks good" },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpdateSuggestionStatus).toHaveBeenCalledWith(
        1,
        "guild-123",
        "approved",
        "user-123",
        "Looks good",
      );
      await app.close();
    });

    it("returns 404 for non-existent suggestion", async () => {
      const app = await buildApp();
      mockUpdateSuggestionStatus.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-123/suggestions/999/status",
        payload: { status: "approved" },
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it("returns 400 for invalid ID", async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-123/suggestions/abc/status",
        payload: { status: "approved" },
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  describe("DELETE /api/guilds/:guildId/suggestions/:id", () => {
    it("deletes a suggestion", async () => {
      const app = await buildApp();
      mockDeleteSuggestion.mockResolvedValueOnce(true);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-123/suggestions/1",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
      await app.close();
    });

    it("returns 404 for non-existent suggestion", async () => {
      const app = await buildApp();
      mockDeleteSuggestion.mockResolvedValueOnce(false);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-123/suggestions/999",
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });
  });

  describe("GET /api/guilds/:guildId/suggestion-settings", () => {
    it("returns settings", async () => {
      const app = await buildApp();
      mockGetSuggestionSettings.mockResolvedValueOnce({
        guildId: "guild-123",
        enabled: true,
        channelId: "ch-1",
        dmOnStatusChange: true,
        autoThread: false,
        anonymousMode: false,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-123/suggestion-settings",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().enabled).toBe(true);
      await app.close();
    });
  });

  describe("PUT /api/guilds/:guildId/suggestion-settings", () => {
    it("updates settings", async () => {
      const app = await buildApp();
      mockUpsertSuggestionSettings.mockResolvedValueOnce({
        guildId: "guild-123",
        enabled: false,
        channelId: "ch-1",
        dmOnStatusChange: true,
        autoThread: false,
        anonymousMode: false,
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-123/suggestion-settings",
        payload: { enabled: false },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpsertSuggestionSettings).toHaveBeenCalledWith(
        "guild-123",
        { enabled: false },
      );
      await app.close();
    });
  });
});
