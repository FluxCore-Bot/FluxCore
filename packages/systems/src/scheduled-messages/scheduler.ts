import type { Client, TextBasedChannel } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { logger } from "@fluxcore/utils";
import { getDueMessages, markMessageExecuted } from "./persistence.js";
import { SCHEDULER_CHECK_INTERVAL_MS } from "./constants.js";
import type { ScheduledMessageRow } from "./types.js";

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

function buildEmbed(embed: NonNullable<ScheduledMessageRow["message"]["embed"]>): EmbedBuilder {
  const builder = new EmbedBuilder();

  if (embed.title) builder.setTitle(embed.title);
  if (embed.description) builder.setDescription(embed.description);
  if (embed.color !== undefined) builder.setColor(embed.color);
  if (embed.thumbnail) builder.setThumbnail(embed.thumbnail);
  if (embed.image) builder.setImage(embed.image);
  if (embed.footer) builder.setFooter({ text: embed.footer });
  if (embed.fields) {
    for (const field of embed.fields) {
      builder.addFields({ name: field.name, value: field.value, inline: field.inline });
    }
  }

  return builder;
}

export async function processScheduledMessages(client: Client): Promise<void> {
  const due = await getDueMessages();

  for (const msg of due) {
    try {
      const guild = await client.guilds.fetch(msg.guildId);
      const channel = guild.channels.cache.get(msg.channelId) as TextBasedChannel | undefined;

      if (!channel || !("send" in channel)) {
        logger.warn(`Scheduled message ${msg.id}: channel ${msg.channelId} not found or not text-based`);
        // Still update nextRunAt so we don't retry every tick
        await markMessageExecuted(msg.id, msg.cronExpr, msg.timezone);
        continue;
      }

      const response = msg.message;
      if (response.type === "embed" && response.embed) {
        await channel.send({ embeds: [buildEmbed(response.embed)] });
      } else if (response.content) {
        await channel.send(response.content);
      } else {
        logger.warn(`Scheduled message ${msg.id}: empty message content`);
      }

      await markMessageExecuted(msg.id, msg.cronExpr, msg.timezone);
      logger.debug(`Scheduled message ${msg.id} sent to ${msg.channelId} in ${msg.guildId}`);
    } catch (error) {
      logger.error(
        `Scheduled message ${msg.id} failed`,
        error instanceof Error ? error : new Error(String(error)),
      );
      // Still advance nextRunAt to prevent retry loops
      try {
        await markMessageExecuted(msg.id, msg.cronExpr, msg.timezone);
      } catch {
        // Ignore secondary failure
      }
    }
  }
}

export function startScheduledMessageScheduler(client: Client): void {
  // Run immediately on startup
  processScheduledMessages(client).catch((err: unknown) =>
    logger.error(
      "Scheduled message check failed",
      err instanceof Error ? err : new Error(String(err)),
    ),
  );

  schedulerTimer = setInterval(() => {
    processScheduledMessages(client).catch((err: unknown) =>
      logger.error(
        "Scheduled message check failed",
        err instanceof Error ? err : new Error(String(err)),
      ),
    );
  }, SCHEDULER_CHECK_INTERVAL_MS);
  (schedulerTimer as unknown as { unref: () => void }).unref();
}

export function stopScheduledMessageScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
