import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    dashboardSessionSecret: "session-secret",
    logLevel: "info",
  },
}));

const MANAGE_GUILD = BigInt(0x20);
const mockSession = {
  userId: "user-1",
  username: "testuser",
  guilds: [{ id: "guild-1", name: "Test", permissions: MANAGE_GUILD.toString() }],
};

const mockGetSession = vi.fn().mockResolvedValue(mockSession);
const mockTouchSession = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/server/session.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  touchSession: (...args: unknown[]) => mockTouchSession(...args),
}));

const mockIsBotInGuild = vi.fn().mockResolvedValue(true);
vi.mock("../../src/server/discordApi.js", () => ({
  isBotInGuild: (...args: unknown[]) => mockIsBotInGuild(...args),
}));

const mockGetTicketSettings = vi.fn().mockResolvedValue({
  guildId: "guild-1",
  staffRoleIds: [],
  transcriptChannelId: null,
  maxOpenPerUser: 3,
  autoCloseHours: 0,
  namingFormat: "ticket-{number}",
  ticketCounter: 0,
});
const mockUpsertTicketSettings = vi.fn().mockResolvedValue({
  guildId: "guild-1",
  staffRoleIds: ["role-1"],
  transcriptChannelId: null,
  maxOpenPerUser: 5,
  autoCloseHours: 0,
  namingFormat: "ticket-{number}",
  ticketCounter: 0,
});
vi.mock("@fluxcore/systems/tickets/config", () => ({
  getTicketSettings: (...args: unknown[]) => mockGetTicketSettings(...args),
  upsertTicketSettings: (...args: unknown[]) => mockUpsertTicketSettings(...args),
}));

const mockGetTickets = vi.fn().mockResolvedValue({ tickets: [], total: 0 });
const mockGetTicketById = vi.fn().mockResolvedValue(null);
const mockCloseTicket = vi.fn().mockResolvedValue({});
const mockGetTicketPanels = vi.fn().mockResolvedValue([]);
const mockGetTicketPanel = vi.fn().mockResolvedValue(null);
const mockCreateTicketPanel = vi.fn().mockResolvedValue({
  id: 1,
  guildId: "guild-1",
  channelId: "channel-1",
  messageId: null,
  name: "Support",
  embed: "{}",
  categories: [],
  createdBy: "user-1",
  createdAt: new Date(),
});
const mockUpdateTicketPanel = vi.fn().mockResolvedValue({});
const mockDeleteTicketPanel = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/tickets/persistence", () => ({
  getTickets: (...args: unknown[]) => mockGetTickets(...args),
  getTicketById: (...args: unknown[]) => mockGetTicketById(...args),
  closeTicket: (...args: unknown[]) => mockCloseTicket(...args),
  getTicketPanels: (...args: unknown[]) => mockGetTicketPanels(...args),
  getTicketPanel: (...args: unknown[]) => mockGetTicketPanel(...args),
  createTicketPanel: (...args: unknown[]) => mockCreateTicketPanel(...args),
  updateTicketPanel: (...args: unknown[]) => mockUpdateTicketPanel(...args),
  deleteTicketPanel: (...args: unknown[]) => mockDeleteTicketPanel(...args),
}));

vi.mock("@fluxcore/systems/tickets/constants", () => ({
  TICKETS_PAGE_SIZE: 20,
  MAX_CATEGORIES: 10,
  MAX_FORM_FIELDS: 5,
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerTicketRoutes } from "../../src/server/routes/tickets.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerTicketRoutes(app);
  await app.ready();
  return app;
}

describe("ticket routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockIsBotInGuild.mockResolvedValue(true);
    app = await buildApp();
  });

  // --- Tickets ---
  describe("GET /api/guilds/:guildId/tickets", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/tickets",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns tickets on success", async () => {
      mockGetTickets.mockResolvedValueOnce({
        tickets: [{ id: 1, status: "open", userId: "u1" }],
        total: 1,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/tickets",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.tickets).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it("passes status filter", async () => {
      await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/tickets?status=open&page=2&limit=10",
        cookies: { session: app.signCookie("valid") },
      });

      expect(mockGetTickets).toHaveBeenCalledWith(
        "guild-1",
        expect.objectContaining({ status: "open", page: 2, limit: 10 }),
      );
    });

    it("returns 403 when user lacks guild permissions", async () => {
      mockGetSession.mockResolvedValueOnce({
        ...mockSession,
        guilds: [{ id: "guild-1", name: "Test", permissions: "0" }],
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/tickets",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("GET /api/guilds/:guildId/tickets/:ticketId", () => {
    it("returns 404 when ticket not found", async () => {
      mockGetTicketById.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/tickets/999",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for invalid ticket ID", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/tickets/invalid",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns ticket on success", async () => {
      mockGetTicketById.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-1",
        status: "open",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/tickets/1",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/guilds/:guildId/tickets/:ticketId", () => {
    it("force-closes ticket", async () => {
      mockGetTicketById.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-1",
        status: "open",
      });

      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/tickets/1",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(mockCloseTicket).toHaveBeenCalledWith(1, "Force closed from dashboard");
    });
  });

  // --- Panels ---
  describe("GET /api/guilds/:guildId/ticket-panels", () => {
    it("returns panels on success", async () => {
      mockGetTicketPanels.mockResolvedValueOnce([
        { id: 1, name: "Support", channelId: "ch-1" },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/ticket-panels",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
    });
  });

  describe("POST /api/guilds/:guildId/ticket-panels", () => {
    it("creates panel on valid request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/ticket-panels",
        cookies: { session: app.signCookie("valid") },
        payload: { channelId: "ch-1", name: "Support" },
      });

      expect(res.statusCode).toBe(201);
      expect(mockCreateTicketPanel).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: "guild-1", channelId: "ch-1", name: "Support" }),
      );
    });

    it("returns 400 for missing name", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/ticket-panels",
        cookies: { session: app.signCookie("valid") },
        payload: { channelId: "ch-1" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/guilds/:guildId/ticket-panels/:panelId", () => {
    it("deletes panel", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/ticket-panels/1",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      expect(mockDeleteTicketPanel).toHaveBeenCalledWith(1, "guild-1");
    });

    it("returns 400 for invalid panel ID", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/guilds/guild-1/ticket-panels/invalid",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- Settings ---
  describe("GET /api/guilds/:guildId/ticket-settings", () => {
    it("returns settings on success", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/guilds/guild-1/ticket-settings",
        cookies: { session: app.signCookie("valid") },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.guildId).toBe("guild-1");
      expect(body.maxOpenPerUser).toBe(3);
    });
  });

  describe("PUT /api/guilds/:guildId/ticket-settings", () => {
    it("updates settings on valid request", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/ticket-settings",
        cookies: { session: app.signCookie("valid") },
        payload: { maxOpenPerUser: 5, staffRoleIds: ["role-1"] },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpsertTicketSettings).toHaveBeenCalledWith(
        "guild-1",
        expect.objectContaining({ maxOpenPerUser: 5, staffRoleIds: ["role-1"] }),
      );
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/guilds/guild-1/ticket-settings",
        payload: { maxOpenPerUser: 5 },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
