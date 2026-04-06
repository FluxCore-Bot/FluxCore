import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../shared/middleware.js";
import { isBotInGuild } from "../../shared/discordApi.js";

const MANAGE_GUILD = BigInt(0x20);

export function registerGuildRoutes(app: FastifyInstance): void {
  app.get(
    "/api/guilds",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const session = request.session!;

      const manageable = session.guilds.filter(
        (g) => !!(BigInt(g.permissions) & MANAGE_GUILD),
      );

      const checks = await Promise.all(
        manageable.map(async (g) => ({
          guild: g,
          botPresent: await isBotInGuild(g.id),
        })),
      );

      const guilds = checks
        .filter((c) => c.botPresent)
        .map((c) => ({
          id: c.guild.id,
          name: c.guild.name,
          icon: c.guild.icon,
        }));

      reply.send(guilds);
    },
  );
}
