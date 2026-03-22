import type { Client, TextChannel } from "discord.js";
import type { Shoukaku, TrackEndEvent, TrackExceptionEvent, WebSocketClosedEvent } from "shoukaku";
import { getQueue, destroyQueue } from "./queue.js";
import { updateNowPlayingPanel, buildNowPlayingPanel, deleteNowPlayingPanel } from "./panel.js";
import { errorEmbed, logger } from "@fluxcore/utils";

export function registerMusicEvents(_shoukaku: Shoukaku, _client: Client): void {
  // Shoukaku-level events are handled in shoukaku.ts
  // Player-level events are set up per-guild via setupPlayerEvents
}

export function setupPlayerEvents(guildId: string, client: Client): void {
  const queue = getQueue(guildId);
  if (!queue?.player) return;

  const player = queue.player;

  player.on("start", () => {
    if (!queue.current) return;

    // Delete old panel and send a fresh one at the bottom of chat
    updateNowPlayingPanel(queue, client).catch((err: unknown) =>
      logger.error("Failed to update now playing panel", err instanceof Error ? err : new Error(String(err))),
    );
  });

  player.on("end", async (data: TrackEndEvent) => {
    if (data.reason === "replaced") return;

    try {
      const next = await queue.playNext();
      if (!next) {
        // Queue empty — update panel to idle state with disabled buttons
        if (queue.panelMessageId) {
          try {
            const channel = client.channels.cache.get(queue.textChannelId) as TextChannel | undefined;
            const msg = await channel?.messages.fetch(queue.panelMessageId).catch(() => null);
            if (msg) {
              const panel = buildNowPlayingPanel(queue);
              await msg.edit({ ...panel });
            }
          } catch {
            // ignore
          }
        }
        queue.startDisconnectTimer();
      }
    } catch (err) {
      logger.error(
        `Error playing next track in guild ${guildId}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  });

  player.on("stuck", async () => {
    logger.warn(`Track stuck in guild ${guildId}, skipping`);
    const channel = client.channels.cache.get(queue.textChannelId) as TextChannel | undefined;
    if (channel) {
      channel
        .send({ embeds: [errorEmbed("Track Stuck", "The current track got stuck. Skipping...")] })
        .catch(() => {});
    }
    try {
      await queue.skip();
    } catch {
      // ignore
    }
  });

  player.on("exception", async (data: TrackExceptionEvent) => {
    logger.error(`Track exception in guild ${guildId}: ${data.exception.message}`);
    const channel = client.channels.cache.get(queue.textChannelId) as TextChannel | undefined;
    if (channel) {
      channel
        .send({ embeds: [errorEmbed("Track Error", "An error occurred with the current track. Skipping...")] })
        .catch(() => {});
    }
    try {
      await queue.skip();
    } catch {
      // ignore
    }
  });

  player.on("closed", async (data: WebSocketClosedEvent) => {
    logger.warn(`WebSocket closed for guild ${guildId}: code ${data.code}`);
    if (data.code === 4014) {
      await deleteNowPlayingPanel(queue, client);
      await destroyQueue(guildId);
    }
  });
}
