import type { FastifyInstance } from "fastify";
import { config } from "@fluxcore/config";
import {
  buildCallbackUrl,
  getAuthorizationUrl,
  exchangeCode,
  fetchUser,
  fetchGuilds,
} from "../../shared/auth.js";
import { createSession, deleteSession, getSession } from "../../shared/session.js";
import { generateCsrfToken } from "../../shared/csrf.js";
import { logger } from "@fluxcore/utils";

const isProduction = process.env.NODE_ENV === "production";

const authRateLimit = {
  config: {
    rateLimit: { max: 10, timeWindow: "1 minute" },
  },
};

export function registerAuthRoutes(app: FastifyInstance): void {
  app.get("/auth/login", { ...authRateLimit }, async (_request, reply) => {
    const callbackUrl = buildCallbackUrl(config.dashboardPublicUrl);
    const { url, state } = getAuthorizationUrl(callbackUrl);
    reply
      .setCookie("oauth_state", state, {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
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
      reply
        .clearCookie("oauth_state", { path: "/" })
        .code(403)
        .send({ error: "Invalid state parameter" });
      return;
    }

    // State is valid — burn it immediately so it cannot be replayed
    // regardless of whether the rest of the flow succeeds.
    reply.clearCookie("oauth_state", { path: "/" });

    try {
      const callbackUrl = buildCallbackUrl(config.dashboardPublicUrl);
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
        .setCookie("session", sessionId, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          signed: true,
          maxAge: 86400, // 24 hours
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

  app.get("/auth/csrf", async (_request, reply) => {
    const token = generateCsrfToken();
    reply
      .setCookie("csrf_token", token, {
        path: "/",
        httpOnly: false, // double-submit: JS must read it
        sameSite: "lax",
        secure: isProduction,
        maxAge: 604800,
      })
      .send({ token });
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
