import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "@fluxcore/config";
import { logger } from "@fluxcore/utils";
import {
  connectDatabase,
  disconnectDatabase,
  getPrisma,
} from "@fluxcore/database";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerGuildRoutes } from "./routes/guilds.js";
import { registerTempVoiceRoutes } from "./routes/tempvoice.js";
import { registerActionRoutes } from "./routes/actions.js";
import { registerDiscordRoutes } from "./routes/discord.js";
import { registerMusicRoutes } from "./routes/music.js";
import { registerLoggingRoutes } from "./routes/logging.js";
import { registerWarningRoutes } from "./routes/warnings.js";
import { registerModerationRoutes } from "./routes/moderation.js";
import { registerWelcomeRoutes } from "./routes/welcome.js";
import { registerRolePanelRoutes } from "./routes/rolePanel.js";
import { registerLevelingRoutes } from "./routes/leveling.js";
import { registerAntiRaidRoutes } from "./routes/anti-raid.js";

async function main(): Promise<void> {
  if (!config.dashboardClientSecret) {
    logger.error("DASHBOARD_CLIENT_SECRET is required");
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production" && !process.env.DASHBOARD_SESSION_SECRET) {
    logger.error("DASHBOARD_SESSION_SECRET is required in production");
    process.exit(1);
  }

  await connectDatabase();

  const app = Fastify({ logger: false });

  await app.register(fastifyCookie, {
    secret: config.dashboardSessionSecret,
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://cdn.discordapp.com"],
      },
    },
  });

  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  const __dirname = dirname(fileURLToPath(import.meta.url));

  // In production, serve the built React SPA
  if (process.env.NODE_ENV === "production") {
    await app.register(fastifyStatic, {
      root: join(__dirname, "../client"),
      prefix: "/",
      wildcard: false,
    });
  }

  // Public endpoint — no auth required
  app.get("/api/bot-info", async (_request, reply) => {
    // Measure round-trip latency to Discord's API
    let latency: number | null = null;
    try {
      const start = performance.now();
      await fetch("https://discord.com/api/v10/gateway", { method: "GET" });
      latency = Math.round(performance.now() - start);
    } catch {
      // Discord unreachable — leave as null
    }

    reply.send({
      clientId: config.clientId,
      inviteUrl: `https://discord.com/oauth2/authorize?client_id=${config.clientId}&permissions=8&scope=bot%20applications.commands`,
      latency,
    });
  });

  registerAuthRoutes(app);
  registerGuildRoutes(app);
  registerTempVoiceRoutes(app);
  registerActionRoutes(app);
  registerDiscordRoutes(app);
  registerMusicRoutes(app);
  registerLoggingRoutes(app);
  registerWarningRoutes(app);
  registerModerationRoutes(app);
  registerWelcomeRoutes(app);
  registerRolePanelRoutes(app);
  registerLevelingRoutes(app);
  registerAntiRaidRoutes(app);

  // SPA fallback: serve index.html for non-API/auth routes in production
  if (process.env.NODE_ENV === "production") {
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/") || request.url.startsWith("/auth/")) {
        reply.code(404).send({ error: "Not found" });
        return;
      }
      return reply.sendFile("index.html");
    });
  }

  // Clean up expired sessions every hour
  const SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000;
  const cleanupTimer = setInterval(async () => {
    try {
      const result = await getPrisma().dashboardSession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired sessions`);
      }
    } catch (error) {
      logger.error(
        "Session cleanup failed",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }, SESSION_CLEANUP_INTERVAL);

  const port = config.dashboardPort;
  await app.listen({ port, host: "0.0.0.0" });
  logger.info(`Dashboard running on port ${port}`);

  const shutdown = async () => {
    logger.info("Dashboard shutting down...");
    clearInterval(cleanupTimer);
    await app.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error("Failed to start dashboard", err);
  process.exit(1);
});
