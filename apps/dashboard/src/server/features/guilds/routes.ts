import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../shared/middleware.js";
import { isBotInGuild } from "../../shared/discordApi.js";
import { canManageGuild } from "../../shared/guildPermissions.js";
import { forceRefreshSessionGuilds, type OAuthGuild } from "../../shared/session.js";

/**
 * Filter the user's OAuth guilds down to the ones they can manage from the
 * dashboard: they own it or have Administrator/Manage Server, AND the bot is
 * present.
 */
async function buildManageableGuilds(guilds: OAuthGuild[]) {
  const manageable = guilds.filter(
    (g) => g.owner || canManageGuild(g.permissions),
  );

  const checks = await Promise.all(
    manageable.map(async (g) => ({
      guild: g,
      botPresent: await isBotInGuild(g.id),
    })),
  );

  return checks
    .filter((c) => c.botPresent)
    .map((c) => ({
      id: c.guild.id,
      name: c.guild.name,
      icon: c.guild.icon,
    }));
}

export function registerGuildRoutes(app: FastifyInstance): void {
  app.get(
    "/api/guilds",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const session = request.session!;
      reply.send(await buildManageableGuilds(session.guilds));
    },
  );

  // Force a re-fetch of the user's guild list from Discord, then return it.
  // Needed so newly-granted roles (e.g. a fresh admin role) show up without
  // waiting for the lazy background refresh or re-authenticating.
  app.post(
    "/api/guilds/refresh",
    {
      preHandler: [requireAuth],
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const guilds = await forceRefreshSessionGuilds(request.sessionId!);
      reply.send(await buildManageableGuilds(guilds));
    },
  );
}
