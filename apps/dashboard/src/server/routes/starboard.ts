import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin, requirePermission } from "../middleware.js";
import { getStarboardSettings, upsertStarboardSettings } from "@fluxcore/systems/starboard/config";
import { getStarboardEntries } from "@fluxcore/systems/starboard/persistence";
import { STARBOARD_PAGE_SIZE } from "@fluxcore/systems/starboard/constants";

export function registerStarboardRoutes(app: FastifyInstance): void {
  // GET starred messages
  app.get(
    "/api/guilds/:guildId/starboard",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("starboard.entries.view")] },
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
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("starboard.settings.manage")] },
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
      schema: {
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
