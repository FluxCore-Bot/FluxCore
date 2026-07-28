import type { FastifyInstance } from "fastify";
import { getPrisma } from "@fluxcore/database";
import { withDocs } from "../../shared/openapi-schemas.js";
import { requireAuth } from "../../shared/middleware.js";
import { isBotInGuild } from "../../shared/discordApi.js";
import { canManageGuild } from "../../shared/guildPermissions.js";
import { forceRefreshSessionGuilds, type OAuthGuild } from "../../shared/session.js";
import { rateLimits } from "../../shared/rateLimit.js";

/**
 * Guild IDs where this user holds an explicit dashboard grant — a role
 * assignment or a per-user override. These admit a user who has no Discord
 * MANAGE_GUILD at all.
 */
async function guildIdsWithGrants(userId: string): Promise<Set<string>> {
  const prisma = getPrisma();
  const [assignments, overrides] = await Promise.all([
    prisma.dashboardRoleAssignment.findMany({
      where: { userId },
      select: { guildId: true },
      distinct: ["guildId"],
    }),
    prisma.dashboardUserPermission.findMany({
      where: { userId },
      select: { guildId: true },
      distinct: ["guildId"],
    }),
  ]);

  return new Set([
    ...assignments.map((a) => a.guildId),
    ...overrides.map((o) => o.guildId),
  ]);
}

/**
 * Filter the user's OAuth guilds down to the ones they can open in the
 * dashboard: they own it, have Administrator/Manage Server, or hold an explicit
 * dashboard grant there.
 *
 * Intersecting grants with the OAuth guild list is also the membership check —
 * a grant row for a guild the user has left cannot resurface it.
 *
 * Guilds the bot has NOT been added to are included, flagged with
 * `botPresent: false`, so the dashboard can offer a preselected invite instead
 * of hiding them. This grants no access on its own — `requireGuildAccess` still
 * rejects guild-scoped requests with `botNotInGuild`.
 *
 * Bot-present guilds sort first so the actionable cards lead the grid.
 */
async function buildManageableGuilds(userId: string, guilds: OAuthGuild[]) {
  const grantedIds = await guildIdsWithGrants(userId);

  const visible = guilds
    .map((guild) => ({
      guild,
      isAdmin: guild.owner || canManageGuild(guild.permissions),
    }))
    .filter((entry) => entry.isAdmin || grantedIds.has(entry.guild.id));

  const checks = await Promise.all(
    visible.map(async (entry) => ({
      ...entry,
      botPresent: await isBotInGuild(entry.guild.id),
    })),
  );

  return checks
    .map((c) => ({
      id: c.guild.id,
      name: c.guild.name,
      icon: c.guild.icon,
      botPresent: c.botPresent,
      access: c.isAdmin ? "admin" : "delegated",
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
        access: { type: "string" },
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
      reply.send(await buildManageableGuilds(session.userId, session.guilds));
    },
  );

  // Force a re-fetch of the user's guild list from Discord, then return it.
  // Needed so newly-granted roles (e.g. a fresh admin role) show up without
  // waiting for the lazy background refresh or re-authenticating.
  app.post(
    "/api/guilds/refresh",
    {
      preHandler: [requireAuth],
      // Re-fetches the user's guild list from the Discord OAuth API.
      config: rateLimits.external,
      schema: withDocs(undefined, {
        tag: "Guilds",
        response: guildListResponseSchema,
      }),
    },
    async (request, reply) => {
      const guilds = await forceRefreshSessionGuilds(request.sessionId!);
      reply.send(await buildManageableGuilds(request.session!.userId, guilds));
    },
  );
}
