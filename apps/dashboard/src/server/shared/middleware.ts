import type { FastifyRequest, FastifyReply } from "fastify";
import {
  getSession,
  touchSession,
  ensureFreshGuilds,
  type Session,
} from "./session.js";
import { isBotInGuild } from "./discordApi.js";
import {
  resolveUserPermissions,
  hasPermission,
  type ResolvedPermissions,
} from "./permissions.js";

const MANAGE_GUILD = BigInt(0x20);

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

export async function requireGuildAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { guildId } = request.params as { guildId: string };
  const session = request.session!;
  const sessionId = request.sessionId!;

  // Re-validate guild membership against fresh Discord data (max 5 min stale)
  let guilds = session.guilds;
  if (sessionId) {
    try {
      const fresh = await ensureFreshGuilds(sessionId);
      if (fresh) {
        guilds = fresh;
        session.guilds = fresh;
      }
    } catch {
      // If Discord is unreachable, fall back to cached guilds — this is the
      // existing behavior. We still re-check permissions below.
    }
  }

  const userGuild = guilds.find((g) => g.id === guildId);
  if (!userGuild || !(BigInt(userGuild.permissions) & MANAGE_GUILD)) {
    reply.code(403).send({
      error: request.t("errors:permissions.noGuildPermission"),
      errorKey: "errors:permissions.noGuildPermission",
    });
    return;
  }

  if (!(await isBotInGuild(guildId))) {
    reply.code(403).send({
      error: request.t("errors:permissions.botNotInGuild"),
      errorKey: "errors:permissions.botNotInGuild",
    });
    return;
  }

  // Pre-resolve permissions so downstream handlers can use them
  request.resolvedPermissions = await resolveUserPermissions(
    session.userId,
    guildId,
  );
}

/**
 * Require specific dashboard permissions.
 * Must be used AFTER requireGuildAdmin (which resolves permissions).
 * Accepts one or more permission keys — ALL must be granted.
 */
export function requirePermission(...keys: string[]) {
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
