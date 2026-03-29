import type { Message, EmbedBuilder as DiscordEmbedBuilder } from "discord.js";
import type { CustomCommand } from "./types.js";
import { replaceVariables } from "./variables.js";
import { logger } from "@fluxcore/utils";

/**
 * Build the variable context from a Discord message.
 */
function buildContext(message: Message) {
  return {
    userId: message.author.id,
    username: message.author.displayName,
    serverName: message.guild?.name ?? "Unknown",
    channelId: message.channelId,
    channelName: "name" in message.channel ? (message.channel.name as string) : "unknown",
    memberCount: message.guild?.memberCount ?? 0,
  };
}

/**
 * Execute a custom command: send the response and run any actions.
 */
export async function executeCustomCommand(
  cmd: CustomCommand,
  message: Message,
): Promise<void> {
  const context = buildContext(message);

  try {
    // Delete trigger message if configured
    if (cmd.deletesTrigger && message.deletable) {
      await message.delete().catch(() => {
        // Ignore deletion failures (permissions, already deleted)
      });
    }

    // Build and send the response
    if (cmd.response.type === "embed" && cmd.response.embed) {
      const { EmbedBuilder } = await import("discord.js");
      const embed = new EmbedBuilder();

      if (cmd.response.embed.title) {
        embed.setTitle(replaceVariables(cmd.response.embed.title, context));
      }
      if (cmd.response.embed.description) {
        embed.setDescription(replaceVariables(cmd.response.embed.description, context));
      }
      if (cmd.response.embed.color !== undefined) {
        embed.setColor(cmd.response.embed.color);
      }
      if (cmd.response.embed.footer) {
        embed.setFooter({ text: replaceVariables(cmd.response.embed.footer, context) });
      }
      if (cmd.response.embed.thumbnail) {
        embed.setThumbnail(cmd.response.embed.thumbnail);
      }
      if (cmd.response.embed.image) {
        embed.setImage(cmd.response.embed.image);
      }

      if (cmd.dmResponse) {
        await message.author.send({ embeds: [embed] }).catch(() => {
          // DMs may be disabled
        });
      } else {
        await message.channel.send({ embeds: [embed] });
      }
    } else if (cmd.response.content) {
      const text = replaceVariables(cmd.response.content, context);

      if (cmd.dmResponse) {
        await message.author.send(text).catch(() => {
          // DMs may be disabled
        });
      } else {
        await message.channel.send(text);
      }
    }

    // Execute additional actions (role add/remove)
    if (cmd.actions.length > 0 && message.member) {
      for (const action of cmd.actions) {
        try {
          if (action.type === "addRole") {
            await message.member.roles.add(action.roleId);
          } else if (action.type === "removeRole") {
            await message.member.roles.remove(action.roleId);
          }
        } catch (error) {
          logger.debug(
            `Custom command action failed (${action.type} ${action.roleId}): ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }
  } catch (error) {
    logger.debug(
      `Failed to execute custom command "${cmd.name}" in guild ${cmd.guildId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
