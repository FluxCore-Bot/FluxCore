import type { EmbedBuilder, Guild, TextChannel } from "discord.js";
import { ChannelType } from "discord.js";
import { logger } from "@fluxcore/utils";

/**
 * Safely send a log embed to a log channel.
 * Silently handles channel not found, wrong type, or permission errors.
 */
export async function sendLogEmbed(
  guild: Guild,
  channelId: string,
  embed: EmbedBuilder,
): Promise<void> {
  try {
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;
    if (channel.type !== ChannelType.GuildText) return;

    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    // Silently ignore permission errors / unknown channels — log at debug level
    logger.debug(
      `Failed to send log embed to channel ${channelId} in guild ${guild.id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
