import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "@fluxcore/config";
import { logger } from "@fluxcore/utils";
import { connectDatabase, disconnectDatabase } from "@fluxcore/database";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerGuildRoutes } from "./routes/guilds.js";
import { registerTempVoiceRoutes } from "./routes/tempvoice.js";
import { registerActionRoutes } from "./routes/actions.js";
import { registerDiscordRoutes } from "./routes/discord.js";

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

  const __dirname = dirname(fileURLToPath(import.meta.url));
  await app.register(fastifyStatic, {
    root: join(__dirname, "public"),
    prefix: "/",
  });

  registerAuthRoutes(app);
  registerGuildRoutes(app);
  registerTempVoiceRoutes(app);
  registerActionRoutes(app);
  registerDiscordRoutes(app);

  const port = config.dashboardPort;
  await app.listen({ port, host: "0.0.0.0" });
  logger.info(`Dashboard running on port ${port}`);

  const shutdown = async () => {
    logger.info("Dashboard shutting down...");
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
