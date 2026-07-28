import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../../shared/middleware.js";
import {
  getGuildChannels,
  getGuildRoles,
  searchGuildMembers,
  getGuildMembersByIds,
  invalidateGuildCache,
} from "../../shared/discordApi.js";
import { forceRefreshSessionGuilds } from "../../shared/session.js";
import { rateLimits } from "../../shared/rateLimit.js";
import { logger } from "@fluxcore/utils";
import { withDocs } from "../../shared/openapi-schemas.js";

// Discord channel type constants
const GuildText = 0;
const GuildVoice = 2;
const GuildCategory = 4;

const MEMBER_RESULT_SHAPE = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "string" },
      username: { type: "string" },
      displayName: { type: "string" },
      avatar: { type: "string", nullable: true },
    },
  },
} as const;

export function registerDiscordRoutes(app: FastifyInstance): void {
  /**
   * Member lookup for trigger filters.
   *
   * `?q=` searches by name prefix; `?ids=` resolves saved ids back to names so
   * a stored filter renders as "Ada" rather than "123456789012345678".
   * Rate-limited like the other Discord passthroughs — it fans out to the
   * Discord API and is reachable per keystroke.
   */
  app.get(
    "/api/guilds/:guildId/members",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      config: rateLimits.discordRead,
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          querystring: {
            type: "object",
            properties: { q: { type: "string" }, ids: { type: "string" } },
          },
        },
        { tag: "Discord", response: { 200: MEMBER_RESULT_SHAPE } },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const { q, ids } = request.query as { q?: string; ids?: string };
      try {
        if (ids) {
          const list = ids.split(",").map((s) => s.trim()).filter(Boolean);
          reply.send(await getGuildMembersByIds(guildId, list));
          return;
        }
        reply.send(await searchGuildMembers(guildId, q ?? ""));
      } catch (err) {
        logger.error(
          `Failed to look up members for guild ${guildId}`,
          err instanceof Error ? err : new Error(String(err)),
        );
        reply.send([]);
      }
    },
  );

  app.get(
    "/api/guilds/:guildId/channels",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        {
          tag: "Discord",
          response: {
            200: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  type: { type: "integer" },
                },
              },
            },
          },
        },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      try {
        const allChannels = await getGuildChannels(guildId);

        const channels = allChannels
          .filter(
            (ch) =>
              ch.type === GuildText ||
              ch.type === GuildVoice ||
              ch.type === GuildCategory,
          )
          .map((ch) => ({
            id: ch.id,
            name: ch.name,
            type: ch.type,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        reply.send(channels);
      } catch (err) {
        logger.error(
          `Failed to fetch channels for guild ${guildId}`,
          err instanceof Error ? err : new Error(String(err)),
        );
        reply.status(500).send({ error: "Failed to fetch channels" });
      }
    },
  );

  app.get(
    "/api/guilds/:guildId/roles",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        {
          tag: "Discord",
          response: {
            200: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  color: { type: "string" },
                },
              },
            },
          },
        },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      try {
        const allRoles = await getGuildRoles(guildId);

        const roles = allRoles
          .filter((r) => r.id !== guildId) // exclude @everyone
          .map((r) => ({
            id: r.id,
            name: r.name,
            color: `#${r.color.toString(16).padStart(6, "0")}`,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        reply.send(roles);
      } catch (err) {
        logger.error(
          `Failed to fetch roles for guild ${guildId}`,
          err instanceof Error ? err : new Error(String(err)),
        );
        reply.status(500).send({ error: "Failed to fetch roles" });
      }
    },
  );

  app.post(
    "/api/guilds/:guildId/refresh",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      // Busts the 60s Discord API cache in shared/discordApi.ts.
      config: rateLimits.external,
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        {
          tag: "Discord",
          response: {
            200: {
              type: "object",
              properties: {
                channels: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      type: { type: "integer" },
                    },
                  },
                },
                roles: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      color: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      try {
        // Clear server-side Discord API cache
        invalidateGuildCache(guildId);

        // Refresh guild list in session from Discord
        await forceRefreshSessionGuilds(request.sessionId!);

        // Fetch fresh data
        const [channels, roles] = await Promise.all([
          getGuildChannels(guildId),
          getGuildRoles(guildId),
        ]);

        reply.send({
          channels: channels
            .filter(
              (ch) =>
                ch.type === GuildText ||
                ch.type === GuildVoice ||
                ch.type === GuildCategory,
            )
            .map((ch) => ({ id: ch.id, name: ch.name, type: ch.type }))
            .sort((a, b) => a.name.localeCompare(b.name)),
          roles: roles
            .filter((r) => r.id !== guildId)
            .map((r) => ({
              id: r.id,
              name: r.name,
              color: `#${r.color.toString(16).padStart(6, "0")}`,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        });
      } catch (err) {
        logger.error(
          `Failed to refresh data for guild ${guildId}`,
          err instanceof Error ? err : new Error(String(err)),
        );
        reply.status(500).send({ error: "Failed to refresh data" });
      }
    },
  );
}
