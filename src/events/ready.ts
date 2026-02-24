import type { Client } from "discord.js";
import type { Event } from "../types/index.js";
import { auditPermissions } from "../systems/permissionAudit.js";
import {
  loadTempVoiceConfig,
  getAllConfiguredGuildIds,
} from "../systems/tempVoice/config.js";
import { reconcileOnStartup } from "../systems/tempVoice/manager.js";
import { logger } from "../utils/logger.js";

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
        await reconcileOnStartup(guild);
      }
    }
  },
};

export default event;
