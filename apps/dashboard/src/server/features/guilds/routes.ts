import type { FastifyInstance } from "fastify";
import { withDocs } from "../../shared/openapi-schemas.js";
import { requireAuth } from "../../shared/middleware.js";
import { isBotInGuild } from "../../shared/discordApi.js";
import { canManageGuild } from "../../shared/guildPermissions.js";
import { forceRefreshSessionGuilds, type OAuthGuild } from "../../shared/session.js";

/**
 * Filter the user's OAuth guilds down to the ones they can manage from the
 * dashboard: they own it or have Administrator/Manage Server.
 *
 * Guilds the bot has NOT been added to are included, flagged with
 * `botPresent: false`, so the dashboard can offer a preselected invite for them
 * instead of hiding them. This grants no access on its own — `requireGuildAdmin`
 * still rejects guild-scoped requests with `botNotInGuild`.
 *
 * Bot-present guilds sort first so the actionable cards lead the grid.
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
    .map((c) => ({
      id: c.guild.id,
      name: c.guild.name,
      icon: c.guild.icon,
      botPresent: c.botPresent,
    }))
    .sort(
      (a, b) =>
        Number(b.botPresent) - Number(a.botPresent) ||
        a.name.localeCompare(b.name),
    );
}

const guildListResponseSchema = {
  200: {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        icon: { type: ["string", "null"] },
        botPresent: { type: "boolean" },
      },
    },
  },
};

export function registerGuildRoutes(app: FastifyInstance): void {
  app.get(
    "/api/guilds",
    {
      preHandler: [requireAuth],
      schema: withDocs(undefined, {
        tag: "Guilds",
        response: guildListResponseSchema,
      }),
    },
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
      schema: withDocs(undefined, {
        tag: "Guilds",
        response: guildListResponseSchema,
      }),
    },
    async (request, reply) => {
      const guilds = await forceRefreshSessionGuilds(request.sessionId!);
      reply.send(await buildManageableGuilds(guilds));
    },
  );
}
