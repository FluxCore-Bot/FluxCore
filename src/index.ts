import { ExtendedClient } from "./client/ExtendedClient.js";
import { config } from "./config/index.js";
import { loadCommands, loadEvents } from "./handlers/index.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const client = new ExtendedClient();

  await loadCommands(client);
  await loadEvents(client);

  process.on("unhandledRejection", (error: unknown) => {
    const err =
      error instanceof Error ? error : new Error(String(error));
    logger.error("Unhandled rejection", err);
  });

  process.on("uncaughtException", (error: Error) => {
    logger.error("Uncaught exception", error);
    process.exit(1);
  });

  const shutdown = () => {
    logger.info("Shutting down...");
    client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await client.login(config.token);
}

main().catch((error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error("Failed to start bot", err);
  process.exit(1);
});
