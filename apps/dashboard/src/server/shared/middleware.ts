import type { FastifyRequest, FastifyReply } from "fastify";
import { getSession, touchSession, type Session } from "./session.js";
import { isBotInGuild } from "./discordApi.js";
import {
  resolveUserPermissions,
  hasPermission,
  type ResolvedPermissions,
} from "./permissions.js";

declare module "fastify" {
  interface FastifyRequest {
    session?: Session;
    sessionId?: string;
    resolvedPermissions?: ResolvedPermissions;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const sessionCookie = request.cookies?.session;
  if (!sessionCookie) {
    reply.code(401).send({
      error: request.t("errors:auth.notAuthenticated"),
      errorKey: "errors:auth.notAuthenticated",
    });
    return;
  }

  const unsigned = request.unsignCookie(sessionCookie);
  if (!unsigned.valid || !unsigned.value) {
    reply.code(401).send({
      error: request.t("errors:auth.notAuthenticated"),
      errorKey: "errors:auth.notAuthenticated",
    });
    return;
  }

  const session = await getSession(unsigned.value);
  if (!session) {
    reply.code(401).send({
      error: request.t("errors:auth.sessionExpired"),
      errorKey: "errors:auth.sessionExpired",
    });
    return;
  }

  request.session = session;
  request.sessionId = unsigned.value;

  // Sliding session: extend expiry if past 50% of TTL
  touchSession(unsigned.value, reply).catch(() => {
    // Non-critical, don't fail the request
  });
}

/**
 * Gate for every guild-scoped route: does this user have ANY authority here?
 *
 * Authority comes from three places — guild ownership, live Discord admin
 * authority, or explicit dashboard grants (a dashboard role assignment or a
 * per-user override). A member with grants but no MANAGE_GUILD passes here and
 * is then narrowed by `requirePermission` on each route.
 */
export async function requireGuildAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { guildId } = request.params as { guildId: string };
  const session = request.session!;

  if (!(await isBotInGuild(guildId))) {
    reply.code(403).send({
      error: request.t("errors:permissions.botNotInGuild"),
      errorKey: "errors:permissions.botNotInGuild",
    });
    return;
  }

  // Authorize from LIVE Discord authority + DB grants, not the cached OAuth
  // session snapshot — so access revoked on Discord is honored here.
  const resolved = await resolveUserPermissions(session.userId, guildId);
  const authorized =
    resolved.isOwner || resolved.isGuildAdmin || resolved.permissions.size > 0;
  if (!authorized) {
    reply.code(403).send({
      error: request.t("errors:permissions.noGuildPermission"),
      errorKey: "errors:permissions.noGuildPermission",
    });
    return;
  }

  request.resolvedPermissions = resolved;
}

/**
 * Every permission key any route enforces. Populated when `requirePermission`
 * runs at route-registration time, which makes the route table — not a
 * hand-maintained list — the source of truth for what permissions exist.
 */
const declaredPermissions = new Set<string>();

export function getDeclaredPermissions(): ReadonlySet<string> {
  return declaredPermissions;
}

/**
 * Require specific dashboard permissions.
 * Must be used AFTER requireGuildAccess (which resolves permissions).
 * Accepts one or more permission keys — ALL must be granted.
 */
export function requirePermission(...keys: string[]) {
  for (const key of keys) declaredPermissions.add(key);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const resolved = request.resolvedPermissions;
    if (!resolved) {
      reply.code(500).send({
        error: request.t("errors:permissions.permissionsNotResolved"),
        errorKey: "errors:permissions.permissionsNotResolved",
      });
      return;
    }

    for (const key of keys) {
      if (!hasPermission(resolved, key)) {
        reply.code(403).send({
          error: request.t("errors:permissions.insufficientPermissions"),
          errorKey: "errors:permissions.insufficientPermissions",
          required: key,
        });
        return;
      }
    }
  };
}
