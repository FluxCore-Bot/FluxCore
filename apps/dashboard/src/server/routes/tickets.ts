import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../middleware.js";
import {
  getTicketSettings,
  upsertTicketSettings,
} from "@fluxcore/systems/tickets/config";
import {
  getTickets,
  getTicketById,
  closeTicket,
  getTicketPanels,
  getTicketPanel,
  createTicketPanel,
  updateTicketPanel,
  deleteTicketPanel,
} from "@fluxcore/systems/tickets/persistence";
import { TICKETS_PAGE_SIZE, MAX_CATEGORIES, MAX_FORM_FIELDS } from "@fluxcore/systems/tickets/constants";
import type { TicketStatus, TicketCategory } from "@fluxcore/systems/tickets/types";

function parseIntParam(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function registerTicketRoutes(app: FastifyInstance): void {
  // === Tickets ===

  // GET list tickets
  app.get(
    "/api/guilds/:guildId/tickets",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as {
        status?: string;
        userId?: string;
        page?: string;
        limit?: string;
      };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit
        ? Math.min(parseInt(query.limit, 10), 50)
        : TICKETS_PAGE_SIZE;

      const filters: { status?: TicketStatus; userId?: string; page: number; limit: number } = {
        page: Number.isFinite(page) && page > 0 ? page : 1,
        limit: Number.isFinite(limit) && limit > 0 ? limit : TICKETS_PAGE_SIZE,
      };

      if (query.status && ["open", "claimed", "closed"].includes(query.status)) {
        filters.status = query.status as TicketStatus;
      }
      if (query.userId) {
        filters.userId = query.userId;
      }

      const result = await getTickets(guildId, filters);
      reply.send(result);
    },
  );

  // GET ticket by ID
  app.get(
    "/api/guilds/:guildId/tickets/:ticketId",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, ticketId } = request.params as { guildId: string; ticketId: string };
      const id = parseIntParam(ticketId);
      if (id === null) {
        reply.code(400).send({ error: "Invalid ticket ID" });
        return;
      }

      const ticket = await getTicketById(id);
      if (!ticket || ticket.guildId !== guildId) {
        reply.code(404).send({ error: "Ticket not found" });
        return;
      }

      reply.send(ticket);
    },
  );

  // DELETE force-close ticket
  app.delete(
    "/api/guilds/:guildId/tickets/:ticketId",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, ticketId } = request.params as { guildId: string; ticketId: string };
      const id = parseIntParam(ticketId);
      if (id === null) {
        reply.code(400).send({ error: "Invalid ticket ID" });
        return;
      }

      const ticket = await getTicketById(id);
      if (!ticket || ticket.guildId !== guildId) {
        reply.code(404).send({ error: "Ticket not found" });
        return;
      }

      await closeTicket(id, "Force closed from dashboard");
      reply.send({ success: true });
    },
  );

  // === Ticket Panels ===

  // GET list panels
  app.get(
    "/api/guilds/:guildId/ticket-panels",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const panels = await getTicketPanels(guildId);
      reply.send(panels);
    },
  );

  // POST create panel
  app.post(
    "/api/guilds/:guildId/ticket-panels",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: {
        body: {
          type: "object",
          required: ["channelId", "name"],
          properties: {
            channelId: { type: "string", minLength: 1 },
            name: { type: "string", minLength: 1, maxLength: 50 },
            embed: { type: "string" },
            categories: {
              type: "array",
              maxItems: MAX_CATEGORIES,
              items: {
                type: "object",
                required: ["name", "label"],
                properties: {
                  name: { type: "string", minLength: 1 },
                  label: { type: "string", minLength: 1, maxLength: 80 },
                  emoji: { type: "string" },
                  description: { type: "string", maxLength: 100 },
                  staffRoleIds: { type: "array", items: { type: "string" } },
                  formFields: {
                    type: "array",
                    maxItems: MAX_FORM_FIELDS,
                    items: {
                      type: "object",
                      required: ["label", "style", "required"],
                      properties: {
                        label: { type: "string", minLength: 1, maxLength: 45 },
                        placeholder: { type: "string", maxLength: 100 },
                        style: { type: "string", enum: ["short", "paragraph"] },
                        required: { type: "boolean" },
                        maxLength: { type: "integer", minimum: 1, maximum: 4000 },
                      },
                    },
                  },
                },
              },
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        channelId: string;
        name: string;
        embed?: string;
        categories?: TicketCategory[];
      };

      // Get user ID from session
      const session = (request as { session?: { userId: string } }).session;
      const createdBy = session?.userId ?? "dashboard";

      try {
        const panel = await createTicketPanel({
          guildId,
          channelId: body.channelId,
          name: body.name,
          embed: body.embed,
          categories: body.categories,
          createdBy,
        });
        reply.code(201).send(panel);
      } catch {
        reply.code(400).send({ error: "Failed to create panel" });
      }
    },
  );

  // PUT update panel
  app.put(
    "/api/guilds/:guildId/ticket-panels/:panelId",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: {
        body: {
          type: "object",
          properties: {
            channelId: { type: "string", minLength: 1 },
            name: { type: "string", minLength: 1, maxLength: 50 },
            embed: { type: "string" },
            categories: {
              type: "array",
              maxItems: MAX_CATEGORIES,
              items: {
                type: "object",
                required: ["name", "label"],
                properties: {
                  name: { type: "string", minLength: 1 },
                  label: { type: "string", minLength: 1, maxLength: 80 },
                  emoji: { type: "string" },
                  description: { type: "string", maxLength: 100 },
                  staffRoleIds: { type: "array", items: { type: "string" } },
                  formFields: {
                    type: "array",
                    maxItems: MAX_FORM_FIELDS,
                    items: {
                      type: "object",
                      required: ["label", "style", "required"],
                      properties: {
                        label: { type: "string", minLength: 1, maxLength: 45 },
                        placeholder: { type: "string", maxLength: 100 },
                        style: { type: "string", enum: ["short", "paragraph"] },
                        required: { type: "boolean" },
                        maxLength: { type: "integer", minimum: 1, maximum: 4000 },
                      },
                    },
                  },
                },
              },
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId, panelId } = request.params as { guildId: string; panelId: string };
      const id = parseIntParam(panelId);
      if (id === null) {
        reply.code(400).send({ error: "Invalid panel ID" });
        return;
      }

      const existing = await getTicketPanel(id);
      if (!existing || existing.guildId !== guildId) {
        reply.code(404).send({ error: "Panel not found" });
        return;
      }

      const body = request.body as Partial<{
        channelId: string;
        name: string;
        embed: string;
        categories: TicketCategory[];
      }>;

      const panel = await updateTicketPanel(id, body);
      reply.send(panel);
    },
  );

  // DELETE panel
  app.delete(
    "/api/guilds/:guildId/ticket-panels/:panelId",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, panelId } = request.params as { guildId: string; panelId: string };
      const id = parseIntParam(panelId);
      if (id === null) {
        reply.code(400).send({ error: "Invalid panel ID" });
        return;
      }

      await deleteTicketPanel(id, guildId);
      reply.send({ success: true });
    },
  );

  // POST send panel message (placeholder — actual sending requires bot client)
  app.post(
    "/api/guilds/:guildId/ticket-panels/:panelId/send",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, panelId } = request.params as { guildId: string; panelId: string };
      const id = parseIntParam(panelId);
      if (id === null) {
        reply.code(400).send({ error: "Invalid panel ID" });
        return;
      }

      const panel = await getTicketPanel(id);
      if (!panel || panel.guildId !== guildId) {
        reply.code(404).send({ error: "Panel not found" });
        return;
      }

      // The actual message sending is done via bot webhook/cache invalidation
      // For now return the panel so the bot can pick it up
      reply.send({ success: true, panelId: id });
    },
  );

  // === Ticket Settings ===

  // GET settings
  app.get(
    "/api/guilds/:guildId/ticket-settings",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const settings = await getTicketSettings(guildId);
      reply.send(settings);
    },
  );

  // PUT update settings
  app.put(
    "/api/guilds/:guildId/ticket-settings",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: {
        body: {
          type: "object",
          properties: {
            staffRoleIds: { type: "array", items: { type: "string" } },
            transcriptChannelId: { type: ["string", "null"] },
            maxOpenPerUser: { type: "integer", minimum: 1, maximum: 25 },
            autoCloseHours: { type: "integer", minimum: 0, maximum: 720 },
            namingFormat: { type: "string", minLength: 1, maxLength: 50 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Partial<{
        staffRoleIds: string[];
        transcriptChannelId: string | null;
        maxOpenPerUser: number;
        autoCloseHours: number;
        namingFormat: string;
      }>;

      const settings = await upsertTicketSettings(guildId, body);
      reply.send(settings);
    },
  );
}
