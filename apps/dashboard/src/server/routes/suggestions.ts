import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin, requirePermission } from "../middleware.js";
import {
  getSuggestionSettings,
  upsertSuggestionSettings,
} from "@fluxcore/systems/suggestions/config";
import {
  getSuggestions,
  createSuggestion,
  updateSuggestionStatus,
  deleteSuggestion,
} from "@fluxcore/systems/suggestions/persistence";
import { SUGGESTIONS_PAGE_SIZE, VALID_STATUSES } from "@fluxcore/systems/suggestions/constants";
import type { SuggestionStatus } from "@fluxcore/systems/suggestions/types";

export function registerSuggestionRoutes(app: FastifyInstance): void {
  // GET suggestions list
  app.get(
    "/api/guilds/:guildId/suggestions",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("suggestions.list.view")] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as { status?: string; page?: string; limit?: string };

      const status = query.status && VALID_STATUSES.includes(query.status as SuggestionStatus)
        ? (query.status as SuggestionStatus)
        : undefined;
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? Math.min(parseInt(query.limit, 10), 50) : SUGGESTIONS_PAGE_SIZE;

      const result = await getSuggestions(guildId, {
        status,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        limit: Number.isFinite(limit) && limit > 0 ? limit : SUGGESTIONS_PAGE_SIZE,
      });
      reply.send(result);
    },
  );

  // POST create suggestion (from dashboard)
  app.post(
    "/api/guilds/:guildId/suggestions",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("suggestions.list.manage")],
      schema: {
        body: {
          type: "object",
          required: ["content", "userId"],
          properties: {
            content: { type: "string", minLength: 1, maxLength: 2000 },
            userId: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as { content: string; userId: string };

      const suggestion = await createSuggestion(guildId, body.userId, body.content);
      reply.code(201).send(suggestion);
    },
  );

  // PUT update suggestion status
  app.put(
    "/api/guilds/:guildId/suggestions/:id/status",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("suggestions.list.manage")],
      schema: {
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: [...VALID_STATUSES] },
            reason: { type: "string", maxLength: 500 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const body = request.body as { status: SuggestionStatus; reason?: string };

      const suggestionId = parseInt(id, 10);
      if (!Number.isFinite(suggestionId) || suggestionId < 1) {
        reply.code(400).send({ error: "Invalid suggestion ID" });
        return;
      }

      const session = request.session!;
      const updated = await updateSuggestionStatus(
        suggestionId,
        guildId,
        body.status,
        session.userId,
        body.reason,
      );

      if (!updated) {
        reply.code(404).send({ error: "Suggestion not found" });
        return;
      }

      reply.send(updated);
    },
  );

  // DELETE suggestion
  app.delete(
    "/api/guilds/:guildId/suggestions/:id",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("suggestions.list.manage")] },
    async (request, reply) => {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const suggestionId = parseInt(id, 10);
      if (!Number.isFinite(suggestionId) || suggestionId < 1) {
        reply.code(400).send({ error: "Invalid suggestion ID" });
        return;
      }

      const deleted = await deleteSuggestion(suggestionId, guildId);
      if (!deleted) {
        reply.code(404).send({ error: "Suggestion not found" });
        return;
      }

      reply.send({ success: true });
    },
  );

  // GET suggestion settings
  app.get(
    "/api/guilds/:guildId/suggestion-settings",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("suggestions.settings.manage")] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const settings = await getSuggestionSettings(guildId);
      reply.send(settings);
    },
  );

  // PUT update suggestion settings
  app.put(
    "/api/guilds/:guildId/suggestion-settings",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("suggestions.settings.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            channelId: { type: ["string", "null"] },
            reviewChannelId: { type: ["string", "null"] },
            dmOnStatusChange: { type: "boolean" },
            autoThread: { type: "boolean" },
            anonymousMode: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Partial<{
        enabled: boolean;
        channelId: string | null;
        reviewChannelId: string | null;
        dmOnStatusChange: boolean;
        autoThread: boolean;
        anonymousMode: boolean;
      }>;

      const settings = await upsertSuggestionSettings(guildId, body);
      reply.send(settings);
    },
  );
}
