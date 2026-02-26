import type { FastifyRequest, FastifyReply } from "fastify";
import { getSession, type Session } from "./session.js";

const MANAGE_GUILD = BigInt(0x20);

declare module "fastify" {
  interface FastifyRequest {
    session?: Session;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const sessionId = request.cookies?.session;
  if (!sessionId) {
    reply.code(401).send({ error: "Not authenticated" });
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    reply.code(401).send({ error: "Session expired" });
    return;
  }

  request.session = session;
}

export async function requireGuildAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { guildId } = request.params as { guildId: string };
  const session = request.session!;
  const client = request.discordClient!;

  const userGuild = session.guilds.find((g) => g.id === guildId);
  if (!userGuild || !(BigInt(userGuild.permissions) & MANAGE_GUILD)) {
    reply.code(403).send({ error: "No permission for this guild" });
    return;
  }

  if (!client.guilds.cache.has(guildId)) {
    reply.code(403).send({ error: "Bot is not in this guild" });
    return;
  }
}
