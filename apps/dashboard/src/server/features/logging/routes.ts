import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin, requirePermission } from "../../shared/middleware.js";
import { loadLogConfigs, upsertLogConfig } from "@fluxcore/systems/logging/config";
import { getLogEntries, cleanOldLogEntries } from "@fluxcore/systems/logging/persistence";
import { LOG_CATEGORIES, EVENT_TYPES_BY_CATEGORY } from "@fluxcore/systems/logging/constants";
import type { LogCategory } from "@fluxcore/systems/logging/types";
import { withDocs } from "../../shared/openapi-schemas.js";

export function registerLoggingRoutes(app: FastifyInstance): void {
  // GET log entries for a guild with optional filters
  app.get(
    "/api/guilds/:guildId/logs",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("logging.entries.view")],
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] }, querystring: { type: "object", properties: { page: { type: "integer", minimum: 1, default: 1 }, limit: { type: "integer", minimum: 1, maximum: 100, default: 20 }, sort: { type: "string" } } } },
        { tag: "Logging", response: { 200: { type: "object", additionalProperties: true } } },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as {
        category?: string;
        eventType?: string;
        targetId?: string;
        page?: string;
        limit?: string;
      };

      const filters: {
        category?: LogCategory;
        eventType?: string;
        targetId?: string;
        page?: number;
        limit?: number;
      } = {};

      if (query.category && LOG_CATEGORIES.includes(query.category as LogCategory)) {
        filters.category = query.category as LogCategory;
      }
      if (query.eventType) filters.eventType = query.eventType;
      if (query.targetId) filters.targetId = query.targetId;
      if (query.page) filters.page = parseInt(query.page, 10) || 1;
      if (query.limit) filters.limit = Math.min(100, parseInt(query.limit, 10) || 50);

      const result = await getLogEntries(guildId, filters);
      reply.send(result);
    },
  );

  // GET all category configs for a guild
  app.get(
    "/api/guilds/:guildId/log-config",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("logging.config.manage")],
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        {
          tag: "Logging",
          response: {
            200: {
              type: "object",
              properties: {
                configs: { type: "array", items: { type: "object", additionalProperties: true } },
                categories: { type: "array", items: { type: "string" } },
                eventTypes: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const configs = await loadLogConfigs(guildId);
      reply.send({ configs, categories: LOG_CATEGORIES, eventTypes: EVENT_TYPES_BY_CATEGORY });
    },
  );

  // PUT update a category config
  app.put(
    "/api/guilds/:guildId/log-config/:category",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("logging.config.manage")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            required: ["channelId"],
            properties: {
              channelId: { type: "string", minLength: 1 },
              enabled: { type: "boolean" },
              ignoredChannels: { type: "array", items: { type: "string" } },
              ignoredRoles: { type: "array", items: { type: "string" } },
              enabledEvents: { type: "array", items: { type: "string" } },
            },
            additionalProperties: false,
          },
        },
        { tag: "Logging", response: { 200: { type: "object", additionalProperties: true } } },
      ),
    },
    async (request, reply) => {
      const { guildId, category } = request.params as { guildId: string; category: string };

      if (!LOG_CATEGORIES.includes(category as LogCategory)) {
        reply.code(400).send({ error: "Invalid log category" });
        return;
      }

      const body = request.body as {
        channelId: string;
        enabled?: boolean;
        ignoredChannels?: string[];
        ignoredRoles?: string[];
        enabledEvents?: string[];
      };

      const config = await upsertLogConfig(guildId, category as LogCategory, {
        channelId: body.channelId,
        enabled: body.enabled,
        ignoredChannels: body.ignoredChannels,
        ignoredRoles: body.ignoredRoles,
        enabledEvents: body.enabledEvents,
      });

      reply.send(config);
    },
  );

  // DELETE purge old logs
  app.delete(
    "/api/guilds/:guildId/logs",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("logging.entries.purge")],
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        {
          tag: "Logging",
          response: { 200: { type: "object", properties: { purged: { type: "integer" } } } },
        },
      ),
    },
    async (_request, reply) => {
      const count = await cleanOldLogEntries();
      reply.send({ purged: count });
    },
  );
}
