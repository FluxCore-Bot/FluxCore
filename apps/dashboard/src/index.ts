import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "discord.js";
import { config } from "@fluxcore/config";
import { logger } from "@fluxcore/utils";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerGuildRoutes } from "./routes/guilds.js";
import { registerTempVoiceRoutes } from "./routes/tempvoice.js";
import { registerActionRoutes } from "./routes/actions.js";
import { registerDiscordRoutes } from "./routes/discord.js";

declare module "fastify" {
  interface FastifyRequest {
    discordClient?: Client;
  }
}

let server: FastifyInstance | null = null;

export async function startDashboard(client: Client): Promise<void> {
  if (!config.dashboardClientSecret) {
    logger.info("Dashboard disabled (DASHBOARD_CLIENT_SECRET not set)");
    return;
  }

  const app = Fastify({ logger: false });

  await app.register(fastifyCookie, {
    secret: config.dashboardSessionSecret,
  });

  const __dirname = dirname(fileURLToPath(import.meta.url));
  await app.register(fastifyStatic, {
    root: join(__dirname, "public"),
    prefix: "/",
  });

  app.addHook("onRequest", async (request) => {
    request.discordClient = client;
  });

  registerAuthRoutes(app);
  registerGuildRoutes(app);
  registerTempVoiceRoutes(app);
  registerActionRoutes(app);
  registerDiscordRoutes(app);

  const port = config.dashboardPort;
  await app.listen({ port, host: "0.0.0.0" });
  server = app;
  logger.info(`Dashboard running on port ${port}`);
}

export async function stopDashboard(): Promise<void> {
  if (server) {
    await server.close();
    server = null;
    logger.info("Dashboard stopped");
  }
}
