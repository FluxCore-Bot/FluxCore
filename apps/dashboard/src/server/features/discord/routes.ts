import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../../shared/middleware.js";
import {
  getGuildChannels,
  getGuildRoles,
  invalidateGuildCache,
} from "../../shared/discordApi.js";
import { forceRefreshSessionGuilds } from "../../shared/session.js";
import { logger } from "@fluxcore/utils";
import { withDocs } from "../../shared/openapi-schemas.js";

// Discord channel type constants
const GuildText = 0;
const GuildVoice = 2;
const GuildCategory = 4;

export function registerDiscordRoutes(app: FastifyInstance): void {
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
      config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
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
