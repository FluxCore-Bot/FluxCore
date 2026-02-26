import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware.js";

const MANAGE_GUILD = BigInt(0x20);

export function registerGuildRoutes(app: FastifyInstance): void {
  app.get(
    "/api/guilds",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const session = request.session!;
      const client = request.discordClient!;

      const guilds = session.guilds
        .filter((g) => {
          const hasPermission = !!(BigInt(g.permissions) & MANAGE_GUILD);
          const botPresent = client.guilds.cache.has(g.id);
          return hasPermission && botPresent;
        })
        .map((g) => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
        }));

      reply.send(guilds);
    },
  );
}
