import { ExtendedClient } from "./client/ExtendedClient.js";
import { config } from "@fluxcore/config";
import { startDashboard, stopDashboard } from "@fluxcore/dashboard";
import { connectDatabase, disconnectDatabase } from "@fluxcore/database";
import { loadCommands, loadEvents } from "./handlers/index.js";
import { stopReminderPolling } from "./systems/reminders.js";
import { logger } from "@fluxcore/utils";

async function main(): Promise<void> {
  const client = new ExtendedClient();

  await connectDatabase();

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

  const shutdown = async () => {
    logger.info("Shutting down...");
    stopReminderPolling();
    await stopDashboard();
    client.destroy();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await client.login(config.token);
  await startDashboard(client);
}

main().catch((error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error("Failed to start bot", err);
  process.exit(1);
});
