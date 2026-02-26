import { ChannelType } from "discord.js";
import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../middleware.js";

export function registerDiscordRoutes(app: FastifyInstance): void {
  app.get(
    "/api/guilds/:guildId/channels",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const guild = request.discordClient!.guilds.cache.get(guildId);
      if (!guild) {
        reply.code(404).send({ error: "Guild not found" });
        return;
      }

      const channels = guild.channels.cache
        .filter(
          (ch) =>
            ch.type === ChannelType.GuildText ||
            ch.type === ChannelType.GuildVoice ||
            ch.type === ChannelType.GuildCategory,
        )
        .map((ch) => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      reply.send(channels);
    },
  );

  app.get(
    "/api/guilds/:guildId/roles",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const guild = request.discordClient!.guilds.cache.get(guildId);
      if (!guild) {
        reply.code(404).send({ error: "Guild not found" });
        return;
      }

      const roles = guild.roles.cache
        .filter((r) => r.id !== guildId) // exclude @everyone
        .map((r) => ({
          id: r.id,
          name: r.name,
          color: r.hexColor,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      reply.send(roles);
    },
  );
}
