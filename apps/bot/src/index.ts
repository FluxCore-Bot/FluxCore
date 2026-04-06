import { ExtendedClient } from "./shared/client/ExtendedClient.js";
import { config } from "@fluxcore/config";
import { connectDatabase, disconnectDatabase } from "@fluxcore/database";
import { loadCommands, loadEvents } from "./shared/handlers/index.js";
import { stopReminderPolling } from "./shared/systems/reminders.js";
import { stopCacheSyncPolling } from "@fluxcore/systems/actions/cacheSync";
import { stopSyncServer } from "./features/automation/system/syncServer.js";
import { initShoukaku, getShoukaku } from "./features/music/system/shoukaku.js";
import { getAllQueues } from "./features/music/system/queue.js";
import { stopAllProgressRefresh } from "./features/music/system/panel.js";
import { logger } from "@fluxcore/utils";

async function main(): Promise<void> {
  const client = new ExtendedClient();

  await connectDatabase();

  await loadCommands(client);
  await loadEvents(client);

  // Init Shoukaku before login so the connector can listen for the ready event
  initShoukaku(client);

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
    stopCacheSyncPolling();
    stopSyncServer();

    // Cleanup music players
    stopAllProgressRefresh();
    const queues = getAllQueues();
    for (const [, queue] of queues) {
      await queue.destroy().catch(() => {});
    }
    const shoukaku = getShoukaku();
    if (shoukaku) {
      for (const [name] of shoukaku.nodes) {
        shoukaku.removeNode(name);
      }
    }

    client.destroy();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await client.login(config.token);
}

main().catch((error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error("Failed to start bot", err);
  process.exit(1);
});
