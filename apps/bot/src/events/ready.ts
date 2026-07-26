import type { Client } from "discord.js";
import type { Event } from "@fluxcore/types";
import { auditPermissions } from "../shared/systems/permissionAudit.js";
import {
  loadTempVoiceConfig,
  getAllConfiguredGuildIds,
} from "@fluxcore/systems/tempVoice/config";
import { reconcileOnStartup } from "../features/tempvoice/system/manager.js";
import { loadActionGuildSettings } from "@fluxcore/systems/actions/config";
import { loadAllRules } from "@fluxcore/systems/actions/cache";
import { startCacheSyncPolling } from "@fluxcore/systems/actions/cacheSync";
import { cleanOldLogs } from "@fluxcore/systems/actions/persistence";
import { registerActionEventListeners } from "../features/automation/system/eventBridge.js";
import { startSyncServer } from "../features/automation/system/syncServer.js";
import { startReminderPolling } from "../shared/systems/reminders.js";
import { cleanOldLogEntries } from "@fluxcore/systems/logging/persistence";
import { logger } from "@fluxcore/utils";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const event: Event<"ready"> = {
  name: "ready",
  once: true,
  async execute(client: Client<true>) {
    logger.info(`Logged in as ${client.user.displayName}`);
    auditPermissions(client);

    await loadTempVoiceConfig();
    const guildsToReconcile = getAllConfiguredGuildIds()
      .map((id) => client.guilds.cache.get(id))
      .filter((g): g is NonNullable<typeof g> => g != null);
    const results = await Promise.allSettled(
      guildsToReconcile.map((guild) => reconcileOnStartup(guild)),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        logger.error(
          "Failed to reconcile TempVoice for guild",
          result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        );
      }
    }

    try {
      await Promise.all([loadActionGuildSettings(), loadAllRules()]);
      registerActionEventListeners(client);
      await startCacheSyncPolling();
      startSyncServer();
    } catch (error) {
      logger.error(
        "Failed to initialize action system",
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    startReminderPolling(client);

    // Logging system — load guild configs on-demand, schedule retention cleanup
    try {
      const logCleanupTimer = setInterval(() => {
        cleanOldLogEntries().catch((err: unknown) =>
          logger.error("LogEntry cleanup failed", err instanceof Error ? err : new Error(String(err))),
        );
      }, ONE_DAY_MS);
      (logCleanupTimer as unknown as { unref: () => void }).unref();
    } catch (error) {
      logger.error("Failed to initialize logging system", error instanceof Error ? error : new Error(String(error)));
    }

    // Tempban scheduler
    try {
      const { startTempbanScheduler } = await import("@fluxcore/systems/moderation/scheduler");
      startTempbanScheduler(client);
      logger.info("Tempban scheduler started");
    } catch (error) {
      logger.error("Failed to start tempban scheduler", error instanceof Error ? error : new Error(String(error)));
    }

    // Scheduled Messages scheduler
    try {
      const { startScheduledMessageScheduler } = await import("@fluxcore/systems/scheduled-messages/scheduler");
      startScheduledMessageScheduler(client);
      logger.info("Scheduled messages scheduler started");
    } catch (error) {
      logger.error("Failed to start scheduled messages scheduler", error instanceof Error ? error : new Error(String(error)));
    }

    // Giveaway scheduler
    try {
      const { startGiveawayScheduler } = await import("@fluxcore/systems/giveaways/scheduler");
      startGiveawayScheduler(client);
    } catch (error) {
      logger.error("Failed to start giveaway scheduler", error instanceof Error ? error : new Error(String(error)));
    }

    // Schedule daily ActionLog retention cleanup
    const cleanupTimer = setInterval(() => {
      cleanOldLogs().catch((err: unknown) =>
        logger.error(
          "ActionLog cleanup failed",
          err instanceof Error ? err : new Error(String(err)),
        ),
      );
    }, ONE_DAY_MS);
    (cleanupTimer as unknown as { unref: () => void }).unref();
  },
};

export default event;
