import type { FastifyInstance } from "fastify";
import {
  getAuthorizationUrl,
  exchangeCode,
  fetchUser,
  fetchGuilds,
} from "../auth.js";
import { createSession, deleteSession, getSession } from "../session.js";
import { logger } from "@fluxcore/utils";

export function registerAuthRoutes(app: FastifyInstance): void {
  app.get("/auth/login", async (_request, reply) => {
    reply.redirect(getAuthorizationUrl());
  });

  app.get("/auth/callback", async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) {
      reply.code(400).send({ error: "Missing code parameter" });
      return;
    }

    try {
      const token = await exchangeCode(code);
      const [user, guilds] = await Promise.all([
        fetchUser(token.access_token),
        fetchGuilds(token.access_token),
      ]);

      const sessionId = createSession({
        userId: user.id,
        username: user.username,
        avatar: user.avatar,
        accessToken: token.access_token,
        guilds,
      });

      reply
        .setCookie("session", sessionId, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          maxAge: 3600,
        })
        .redirect("/");
    } catch (error) {
      logger.error(
        "OAuth callback failed",
        error instanceof Error ? error : new Error(String(error)),
      );
      reply.code(500).send({ error: "Authentication failed" });
    }
  });

  app.get("/auth/logout", async (request, reply) => {
    const sessionId = request.cookies?.session;
    if (sessionId) {
      deleteSession(sessionId);
    }
    reply.clearCookie("session", { path: "/" }).redirect("/");
  });

  app.get("/auth/me", async (request, reply) => {
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

    reply.send({
      userId: session.userId,
      username: session.username,
      avatar: session.avatar,
    });
  });
}
