import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../middleware.js";
import { getGuildChannels, getGuildRoles } from "../discordApi.js";
import { logger } from "@fluxcore/utils";

// Discord channel type constants
const GuildText = 0;
const GuildVoice = 2;
const GuildCategory = 4;

export function registerDiscordRoutes(app: FastifyInstance): void {
  app.get(
    "/api/guilds/:guildId/channels",
    { preHandler: [requireAuth, requireGuildAdmin] },
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
    { preHandler: [requireAuth, requireGuildAdmin] },
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
}
