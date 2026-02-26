import type { Client } from "discord.js";
import type { Event } from "@fluxcore/types";
import { auditPermissions } from "../systems/permissionAudit.js";
import {
  loadTempVoiceConfig,
  getAllConfiguredGuildIds,
} from "@fluxcore/systems/tempVoice/config";
import { reconcileOnStartup } from "../systems/tempVoice/manager.js";
import { loadActionGuildSettings } from "@fluxcore/systems/actions/config";
import { loadAllRules } from "@fluxcore/systems/actions/cache";
import { startCacheSyncPolling } from "@fluxcore/systems/actions/cacheSync";
import { registerActionEventListeners } from "../systems/actions/eventBridge.js";
import { startSyncServer } from "../systems/actions/syncServer.js";
import { startReminderPolling } from "../systems/reminders.js";
import { logger } from "@fluxcore/utils";

const event: Event<"ready"> = {
  name: "ready",
  once: true,
  async execute(client: Client<true>) {
    logger.info(`Logged in as ${client.user.displayName}`);
    auditPermissions(client);

    await loadTempVoiceConfig();
    for (const guildId of getAllConfiguredGuildIds()) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        try {
          await reconcileOnStartup(guild);
        } catch (error) {
          logger.error(
            `Failed to reconcile TempVoice for guild ${guildId}`,
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
    }

    try {
      await loadActionGuildSettings();
      await loadAllRules();
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
  },
};

export default event;
