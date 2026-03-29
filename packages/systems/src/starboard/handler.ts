import type {
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  TextChannel,
  Message,
} from "discord.js";
import { EmbedBuilder } from "discord.js";
import { logger } from "@fluxcore/utils";
import { getStarboardSettings } from "./config.js";
import { getStarboardEntry, upsertStarboardEntry, deleteStarboardEntry } from "./persistence.js";
import type { StarboardGuildSettings } from "./types.js";

function buildStarboardEmbed(
  message: Message,
  starCount: number,
  emoji: string,
): { content: string; embeds: EmbedBuilder[] } {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL(),
    })
    .setTimestamp(message.createdAt)
    .setColor(0xf5c842)
    .setFooter({ text: `Message ID: ${message.id}` });

  if (message.content) {
    embed.setDescription(message.content);
  }

  // Add first image attachment or embed image
  const imageAttachment = message.attachments.find((a) =>
    a.contentType?.startsWith("image/"),
  );
  if (imageAttachment) {
    embed.setImage(imageAttachment.url);
  } else {
    const embedImage = message.embeds.find((e) => e.image);
    if (embedImage?.image) {
      embed.setImage(embedImage.image.url);
    }
  }

  const jumpUrl = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
  const content = `${emoji} **${starCount}** | <#${message.channelId}> | [Jump to message](${jumpUrl})`;

  return { content, embeds: [embed] };
}

function getReactionCount(
  reaction: MessageReaction,
  settings: StarboardGuildSettings,
): number {
  let count = reaction.count;

  // If self-star is disabled, subtract 1 if the author reacted
  if (!settings.selfStar && reaction.users.cache.has(reaction.message.author?.id ?? "")) {
    count -= 1;
  }

  return Math.max(0, count);
}

function isMatchingEmoji(reaction: MessageReaction | PartialMessageReaction, emoji: string): boolean {
  const reactionEmoji = reaction.emoji;
  // Unicode emoji comparison
  if (reactionEmoji.name === emoji) return true;
  // Custom emoji: match by name or <:name:id> format
  if (reactionEmoji.id && emoji.includes(reactionEmoji.id)) return true;
  return false;
}

export async function handleStarboardReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): Promise<void> {
  // Only process in guilds
  const guild = reaction.message.guild;
  if (!guild) return;

  // Ignore bot reactions
  if (user.bot) return;

  const settings = await getStarboardSettings(guild.id);

  // Check if starboard is enabled and configured
  if (!settings.enabled || !settings.channelId) return;

  // Check if emoji matches
  if (!isMatchingEmoji(reaction, settings.emoji)) return;

  const message = reaction.message;

  // Ignore messages from bots
  if (message.author?.bot) return;

  // Check if channel is ignored
  if (settings.ignoredChannels.includes(message.channelId)) return;

  // Handle NSFW channels
  const channel = message.channel as TextChannel;
  if (channel.nsfw && settings.nsfwHandling === "ignore") return;

  // Fetch the full message if partial
  let fullMessage: Message;
  try {
    fullMessage = message.partial ? await message.fetch() : (message as Message);
  } catch {
    return; // Message may have been deleted
  }

  // Ensure all reaction users are cached for accurate count
  try {
    await reaction.users.fetch();
  } catch {
    // Could not fetch users, continue with cached data
  }

  const starCount = getReactionCount(reaction as MessageReaction, settings);
  const existing = await getStarboardEntry(guild.id, fullMessage.id);

  if (starCount >= settings.threshold) {
    // Get the starboard channel
    let starboardChannel: TextChannel;
    try {
      const ch = await guild.channels.fetch(settings.channelId);
      if (!ch?.isTextBased()) return;
      starboardChannel = ch as TextChannel;
    } catch {
      logger.warn(`Starboard channel ${settings.channelId} not found for guild ${guild.id}`);
      return;
    }

    const { content, embeds } = buildStarboardEmbed(fullMessage, starCount, settings.emoji);

    if (existing?.starboardMessageId) {
      // Update existing starboard message
      try {
        const starMsg = await starboardChannel.messages.fetch(existing.starboardMessageId);
        await starMsg.edit({ content, embeds });
        await upsertStarboardEntry(guild.id, fullMessage.id, {
          originalChannelId: fullMessage.channelId,
          authorId: fullMessage.author.id,
          starCount,
        });
      } catch {
        // Starboard message was deleted, recreate it
        try {
          const newMsg = await starboardChannel.send({ content, embeds });
          await upsertStarboardEntry(guild.id, fullMessage.id, {
            originalChannelId: fullMessage.channelId,
            authorId: fullMessage.author.id,
            starCount,
            starboardMessageId: newMsg.id,
          });
        } catch (sendErr) {
          logger.error(
            "Failed to send starboard message",
            sendErr instanceof Error ? sendErr : new Error(String(sendErr)),
          );
        }
      }
    } else {
      // Create new starboard entry
      try {
        const newMsg = await starboardChannel.send({ content, embeds });
        await upsertStarboardEntry(guild.id, fullMessage.id, {
          originalChannelId: fullMessage.channelId,
          authorId: fullMessage.author.id,
          starCount,
          starboardMessageId: newMsg.id,
        });
      } catch (err) {
        logger.error(
          "Failed to send starboard message",
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    }
  } else if (existing) {
    // Star count dropped below threshold
    if (existing.starboardMessageId) {
      // Try to delete the starboard message
      try {
        const starboardChannel = await guild.channels.fetch(settings.channelId);
        if (starboardChannel?.isTextBased()) {
          const starMsg = await (starboardChannel as TextChannel).messages.fetch(
            existing.starboardMessageId,
          );
          await starMsg.delete();
        }
      } catch {
        // Message already deleted, that's fine
      }
    }
    await deleteStarboardEntry(guild.id, fullMessage.id);
  }
}
