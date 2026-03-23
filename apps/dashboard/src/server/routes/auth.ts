import type { FastifyInstance } from "fastify";
import {
  buildCallbackUrl,
  getAuthorizationUrl,
  exchangeCode,
  fetchUser,
  fetchGuilds,
} from "../auth.js";
import { createSession, deleteSession, getSession } from "../session.js";
import { logger } from "@fluxcore/utils";

const isProduction = process.env.NODE_ENV === "production";

const authRateLimit = {
  config: {
    rateLimit: { max: 10, timeWindow: "1 minute" },
  },
};

export function registerAuthRoutes(app: FastifyInstance): void {
  app.get("/auth/login", { ...authRateLimit }, async (request, reply) => {
    const proto = (request.headers["x-forwarded-proto"] as string) || request.protocol;
    const host = request.headers["x-forwarded-host"] as string || request.hostname;
    const origin = `${proto}://${host}`;
    const callbackUrl = buildCallbackUrl(origin);
    const { url, state } = getAuthorizationUrl(callbackUrl);
    reply
      .setCookie("oauth_state", state, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        signed: true,
        maxAge: 300, // 5 minutes
      })
      .redirect(url);
  });

  app.get("/auth/callback", { ...authRateLimit }, async (request, reply) => {
    const { code, state } = request.query as {
      code?: string;
      state?: string;
    };
    if (!code) {
      reply.code(400).send({ error: "Missing code parameter" });
      return;
    }

    // Validate CSRF state parameter
    const stateCookie = request.cookies?.oauth_state;
    if (!stateCookie || !state) {
      reply.code(403).send({ error: "Missing state parameter" });
      return;
    }

    const unsignedState = request.unsignCookie(stateCookie);
    if (!unsignedState.valid || unsignedState.value !== state) {
      reply.code(403).send({ error: "Invalid state parameter" });
      return;
    }

    try {
      const proto = (request.headers["x-forwarded-proto"] as string) || request.protocol;
      const host = request.headers["x-forwarded-host"] as string || request.hostname;
      const origin = `${proto}://${host}`;
      const callbackUrl = buildCallbackUrl(origin);
      const token = await exchangeCode(code, callbackUrl);
      const [user, guilds] = await Promise.all([
        fetchUser(token.access_token),
        fetchGuilds(token.access_token),
      ]);

      const sessionId = await createSession({
        userId: user.id,
        username: user.username,
        avatar: user.avatar,
        accessToken: token.access_token,
        guilds,
      });

      reply
        .clearCookie("oauth_state", { path: "/" })
        .setCookie("session", sessionId, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          signed: true,
          maxAge: 604800, // 7 days
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
    const sessionCookie = request.cookies?.session;
    if (sessionCookie) {
      const unsigned = request.unsignCookie(sessionCookie);
      if (unsigned.valid && unsigned.value) {
        await deleteSession(unsigned.value);
      }
    }
    reply.clearCookie("session", { path: "/" }).redirect("/");
  });

  app.get("/auth/me", async (request, reply) => {
    const sessionCookie = request.cookies?.session;
    if (!sessionCookie) {
      reply.code(401).send({ error: "Not authenticated" });
      return;
    }

    const unsigned = request.unsignCookie(sessionCookie);
    if (!unsigned.valid || !unsigned.value) {
      reply.code(401).send({ error: "Not authenticated" });
      return;
    }

    const session = await getSession(unsigned.value);
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
