import type { Client } from "discord.js";
import { onMusicSettingsChanged } from "@fluxcore/systems/music/config";
import { getQueue, createQueue, destroyQueue } from "./queue.js";
import { setupPlayerEvents } from "./events.js";
import { logger } from "@fluxcore/utils";

/**
 * Register a reactive handler that responds to music settings changes
 * from the dashboard by adjusting the bot's runtime state.
 */
export function registerMusicSettingsReactor(client: Client): void {
  onMusicSettingsChanged(async (guildId, oldSettings, newSettings) => {
    const queue = getQueue(guildId);

    // 24/7 toggled OFF — disconnect if idle, or start disconnect timer if playing
    if (oldSettings.twentyFourSeven && !newSettings.twentyFourSeven) {
      if (queue) {
        if (!queue.current) {
          logger.debug(`24/7 disabled for guild ${guildId} — destroying idle queue`);
          await destroyQueue(guildId);
        } else {
          logger.debug(`24/7 disabled for guild ${guildId} — starting disconnect timer`);
          queue.startDisconnectTimer();
        }
      }
      return;
    }

    // 24/7 toggled ON — cancel disconnect timer or join channel
    if (!oldSettings.twentyFourSeven && newSettings.twentyFourSeven) {
      if (queue) {
        queue.clearDisconnectTimer();
      } else if (newSettings.lastChannelId) {
        await tryJoinChannel(client, guildId, newSettings.lastChannelId);
      }
      return;
    }

    // Channel changed while 24/7 is active — move to the new channel
    if (
      newSettings.twentyFourSeven &&
      oldSettings.lastChannelId !== newSettings.lastChannelId &&
      newSettings.lastChannelId
    ) {
      if (queue) {
        await destroyQueue(guildId);
      }
      await tryJoinChannel(client, guildId, newSettings.lastChannelId);
      return;
    }

    // Volume changed — update active player
    if (oldSettings.defaultVolume !== newSettings.defaultVolume && queue?.player) {
      await queue.setVolume(newSettings.defaultVolume);
    }

    // Auto-disconnect seconds changed — restart timer if idle
    if (
      oldSettings.autoDisconnectSecs !== newSettings.autoDisconnectSecs &&
      queue &&
      !queue.current &&
      !newSettings.twentyFourSeven
    ) {
      queue.startDisconnectTimer();
    }
  });
}

async function tryJoinChannel(client: Client, guildId: string, channelId: string): Promise<void> {
  try {
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(channelId);
    if (!channel?.isVoiceBased()) return;

    await createQueue(guildId, channelId, channelId, client);
    setupPlayerEvents(guildId, client);
    logger.debug(`Joined 24/7 channel ${channelId} in guild ${guildId} via settings change`);
  } catch (err) {
    logger.error(
      `Failed to join 24/7 channel in guild ${guildId}`,
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}
