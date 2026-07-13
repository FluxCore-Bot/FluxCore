import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { readFile } from "node:fs/promises";
import { config } from "@fluxcore/config";
import { logger } from "@fluxcore/utils";
import {
  connectDatabase,
  disconnectDatabase,
  getPrisma,
} from "@fluxcore/database";
import { registerAuthRoutes } from "./features/auth/routes.js";
import { registerGuildRoutes } from "./features/guilds/routes.js";
import { registerTempVoiceRoutes } from "./features/tempvoice/routes.js";
import { registerActionRoutes } from "./features/actions/routes.js";
import { registerDiscordRoutes } from "./features/discord/routes.js";
import { registerMusicRoutes } from "./features/music/routes.js";
import { registerLoggingRoutes } from "./features/logging/routes.js";
import { registerWarningRoutes } from "./features/moderation/warnings-routes.js";
import { registerModerationRoutes } from "./features/moderation/routes.js";
import { registerWelcomeRoutes } from "./features/welcome/routes.js";
import { registerRolePanelRoutes } from "./features/roles/routes.js";
import { registerLevelingRoutes } from "./features/leveling/routes.js";
import { registerScheduledMessageRoutes } from "./features/scheduled/routes.js";
import { registerCustomCommandRoutes } from "./features/commands/routes.js";
import { registerAntiRaidRoutes } from "./features/security/routes.js";
import { registerTicketRoutes } from "./features/tickets/routes.js";
import { registerGiveawayRoutes } from "./features/giveaways/routes.js";
import { registerSuggestionRoutes } from "./features/suggestions/routes.js";
import { registerStarboardRoutes } from "./features/starboard/routes.js";
import { registerDashboardRoleRoutes } from "./features/permissions/roles-routes.js";
import { registerDashboardPermissionRoutes } from "./features/permissions/routes.js";
import { registerI18n } from "./shared/i18n.js";
import { requireCsrf } from "./shared/csrf.js";
import { helmetOptions } from "./shared/security.js";
import { registerOpenApi } from "./shared/openapi.js";
import { withDocs } from "./shared/openapi-schemas.js";

/**
 * Build the fully-configured Fastify application (plugins, routes, OpenAPI
 * docs) without starting the HTTP listener. Exported so tests and the
 * production entrypoint share one setup path.
 */
export async function createApp(): Promise<FastifyInstance> {
  if (!config.dashboardClientSecret) {
    logger.error("DASHBOARD_CLIENT_SECRET is required");
    process.exit(1);
  }

  // DASHBOARD_SESSION_SECRET fail-fast is enforced inside @fluxcore/config

  await connectDatabase();

  const app = Fastify({ logger: false });

  await app.register(fastifyCookie, {
    secret: config.dashboardSessionSecret,
  });

  await app.register(fastifyHelmet, helmetOptions);

  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // CSRF double-submit enforcement on mutating /api/* routes
  app.addHook("preHandler", async (request, reply) => {
    if (
      request.url.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method)
    ) {
      await requireCsrf(request, reply);
    }
  });

  // Register OpenAPI/Swagger BEFORE any routes so every route (including
  // i18n, bot-info and all feature routes) is captured by the generator.
  await registerOpenApi(app);

  const __dirname = dirname(fileURLToPath(import.meta.url));

  // In production, serve the built React SPA
  if (process.env.NODE_ENV === "production") {
    await app.register(fastifyStatic, {
      root: join(__dirname, "../client"),
      prefix: "/",
      wildcard: false,
    });
  }

  // Initialize i18n (server-side translations + /api/i18n/:lng/:ns endpoint)
  await registerI18n(app);

  // Public endpoint — no auth required
  app.get(
    "/api/bot-info",
    {
      schema: withDocs(undefined, {
        tag: "Meta",
        secure: false,
        response: {
          200: {
            type: "object",
            properties: {
              clientId: { type: "string" },
              inviteUrl: { type: "string" },
              latency: { type: ["number", "null"] },
            },
          },
        },
      }),
    },
    async (_request, reply) => {
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

  // Serve uploaded images (welcome backgrounds, etc.)
  app.register(fastifyStatic, {
    root: "/data/uploads",
    prefix: "/uploads/",
    decorateReply: false,
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
  registerScheduledMessageRoutes(app);
  registerCustomCommandRoutes(app);
  registerAntiRaidRoutes(app);
  registerTicketRoutes(app);
  registerGiveawayRoutes(app);
  registerSuggestionRoutes(app);
  registerStarboardRoutes(app);
  registerDashboardRoleRoutes(app);
  registerDashboardPermissionRoutes(app);

  // SPA fallback: serve index.html for non-API/auth routes in production
  if (process.env.NODE_ENV === "production") {
    const indexHtmlPath = join(__dirname, "../client/index.html");
    const indexHtmlTemplate = await readFile(indexHtmlPath, "utf8");

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/") || request.url.startsWith("/auth/")) {
        reply.code(404).send({ error: "Not found" });
        return;
      }
      const nonce = (reply as unknown as { cspNonce: { style: string } })
        .cspNonce.style;
      const html = indexHtmlTemplate.replace(/<style/g, `<style nonce="${nonce}"`);
      reply.type("text/html").send(html);
    });
  }

  return app;
}

async function main(): Promise<void> {
  const app = await createApp();

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

// Only auto-start when this module is the process entrypoint
// (e.g. `node dist/server/index.js` or `tsx src/server/index.ts`).
// When imported (tests, `createApp` reuse) we must NOT call listen().
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to start dashboard", err);
    process.exit(1);
  });
}
