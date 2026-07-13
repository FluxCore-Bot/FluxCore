import type { FastifyInstance } from "fastify";
import { withDocs } from "../../shared/openapi-schemas.js";
import { requireAuth, requireGuildAdmin, requirePermission } from "../../shared/middleware.js";
import { getStarboardSettings, upsertStarboardSettings } from "@fluxcore/systems/starboard/config";
import { getStarboardEntries } from "@fluxcore/systems/starboard/persistence";
import { STARBOARD_PAGE_SIZE } from "@fluxcore/systems/starboard/constants";

export function registerStarboardRoutes(app: FastifyInstance): void {
  // GET starred messages
  app.get(
    "/api/guilds/:guildId/starboard",
    {
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          querystring: { type: "object", properties: { page: { type: "integer", minimum: 1, default: 1 }, limit: { type: "integer", minimum: 1, maximum: 100, default: 20 }, sort: { type: "string" } } },
        },
        { tag: "Starboard", response: { 200: { type: "object", additionalProperties: true } } },
      ),
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("starboard.entries.view")],
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as { page?: string; limit?: string };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? Math.min(parseInt(query.limit, 10), 50) : STARBOARD_PAGE_SIZE;

      const result = await getStarboardEntries(
        guildId,
        Number.isFinite(page) && page > 0 ? page : 1,
        Number.isFinite(limit) && limit > 0 ? limit : STARBOARD_PAGE_SIZE,
      );
      reply.send(result);
    },
  );

  // GET starboard settings
  app.get(
    "/api/guilds/:guildId/starboard-settings",
    {
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        { tag: "Starboard", response: { 200: { type: "object", additionalProperties: true } } },
      ),
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("starboard.settings.manage")],
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const settings = await getStarboardSettings(guildId);
      reply.send(settings);
    },
  );

  // PUT update starboard settings
  app.put(
    "/api/guilds/:guildId/starboard-settings",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("starboard.settings.manage")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              channelId: { type: ["string", "null"] },
              emoji: { type: "string", minLength: 1, maxLength: 100 },
              threshold: { type: "integer", minimum: 1, maximum: 100 },
              selfStar: { type: "boolean" },
              ignoredChannels: { type: "array", items: { type: "string" } },
              nsfwHandling: { type: "string", enum: ["ignore", "separate"] },
            },
            additionalProperties: false,
          },
        },
        { tag: "Starboard", response: { 200: { type: "object", additionalProperties: true } } },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Partial<{
        enabled: boolean;
        channelId: string | null;
        emoji: string;
        threshold: number;
        selfStar: boolean;
        ignoredChannels: string[];
        nsfwHandling: "ignore" | "separate";
      }>;

      const settings = await upsertStarboardSettings(guildId, body);
      reply.send(settings);
    },
  );
}
