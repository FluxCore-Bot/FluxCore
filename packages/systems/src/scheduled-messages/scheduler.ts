import type { Client, TextBasedChannel } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { logger } from "@fluxcore/utils";
import { JobQueue } from "../queue/JobQueue.js";
import { getDueMessages, markMessageExecuted } from "./persistence.js";
import { SCHEDULER_CHECK_INTERVAL_MS } from "./constants.js";
import type { ScheduledMessageRow } from "./types.js";

let producerTimer: ReturnType<typeof setInterval> | null = null;
let queue: JobQueue<ScheduledMessageRow> | null = null;

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

export async function startScheduledMessageScheduler(client: Client): Promise<void> {
  queue = new JobQueue<ScheduledMessageRow>(async (msg) => {
    try {
      const guild = await client.guilds.fetch(msg.guildId);
      const channel = guild.channels.cache.get(msg.channelId) as TextBasedChannel | undefined;

      if (!channel || !("send" in channel)) {
        logger.warn(`Scheduled message ${msg.id}: channel ${msg.channelId} not found or not text-based`);
        await markMessageExecuted(msg.id, msg.cronExpr, msg.timezone);
        return;
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
      try {
        await markMessageExecuted(msg.id, msg.cronExpr, msg.timezone);
      } catch {
        // Ignore secondary failure
      }
    }
  });

  queue.start();

  // Run immediately on startup
  const due = await getDueMessages();
  queue.enqueue(due);

  producerTimer = setInterval(async () => {
    try {
      const due = await getDueMessages();
      queue!.enqueue(due);
    } catch (error) {
      logger.error(
        "Scheduled message check failed",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }, SCHEDULER_CHECK_INTERVAL_MS);
  (producerTimer as unknown as { unref: () => void }).unref();

  logger.info("Scheduled messages scheduler started");
}

export function stopScheduledMessageScheduler(): void {
  if (producerTimer) {
    clearInterval(producerTimer);
    producerTimer = null;
  }
  if (queue) {
    queue.stop();
    queue = null;
  }
}
