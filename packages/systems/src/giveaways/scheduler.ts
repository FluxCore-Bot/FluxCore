import type { Client, TextChannel } from "discord.js";
import { logger } from "@fluxcore/utils";
import { getDueGiveaways, endGiveaway, getPendingGiveaways, setGiveawayMessageId } from "./persistence.js";
import { selectWinners } from "./winner.js";
import { buildEndedGiveawayEmbed, buildGiveawayEmbed, buildGiveawayButton } from "./embed.js";
import { GIVEAWAY_CHECK_INTERVAL_MS } from "./constants.js";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export async function processEndedGiveaways(client: Client<true>): Promise<void> {
  const dueGiveaways = await getDueGiveaways();

  for (const giveaway of dueGiveaways) {
    try {
      const winners = selectWinners(giveaway);
      const ended = await endGiveaway(giveaway.id, winners);

      // Try to update the giveaway message
      try {
        const guild = client.guilds.cache.get(giveaway.guildId);
        if (!guild) continue;

        const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel | undefined;
        if (!channel) continue;

        if (giveaway.messageId) {
          try {
            const message = await channel.messages.fetch(giveaway.messageId);
            await message.edit({
              embeds: [buildEndedGiveawayEmbed(ended)],
              components: [],
            });
          } catch {
            // Message may have been deleted
          }
        }

        // Announce winners in channel
        if (winners.length > 0) {
          const winnerMentions = winners.map((id) => `<@${id}>`).join(", ");
          await channel.send({
            content: `\uD83C\uDF89 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`,
          });
        } else {
          await channel.send({
            content: `\uD83C\uDF89 Giveaway for **${giveaway.prize}** ended with no valid entries.`,
          });
        }

        // DM winners
        for (const winnerId of winners) {
          try {
            const user = await client.users.fetch(winnerId);
            await user.send({
              content: `\uD83C\uDF89 You won **${giveaway.prize}** in **${guild.name}**! Contact <@${giveaway.hostId}> to claim your prize.`,
            });
          } catch {
            // DMs may be disabled
          }
        }
      } catch (err) {
        logger.error(
          `Failed to announce giveaway ${giveaway.id} results`,
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    } catch (err) {
      logger.error(
        `Failed to process giveaway ${giveaway.id}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }
}

export async function processPendingGiveaways(client: Client<true>): Promise<void> {
  const pending = await getPendingGiveaways();

  for (const giveaway of pending) {
    try {
      const guild = client.guilds.cache.get(giveaway.guildId);
      if (!guild) continue;

      const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel | undefined;
      if (!channel) continue;

      const message = await channel.send({
        embeds: [buildGiveawayEmbed(giveaway)],
        components: [buildGiveawayButton(giveaway.id)],
      });

      await setGiveawayMessageId(giveaway.id, message.id);
    } catch (err) {
      logger.error(
        `Failed to post pending giveaway ${giveaway.id}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }
}

export function startGiveawayScheduler(client: Client<true>): void {
  if (schedulerInterval) return;

  schedulerInterval = setInterval(() => {
    Promise.all([
      processPendingGiveaways(client),
      processEndedGiveaways(client),
    ]).catch((err: unknown) =>
      logger.error(
        "Giveaway scheduler tick failed",
        err instanceof Error ? err : new Error(String(err)),
      ),
    );
  }, GIVEAWAY_CHECK_INTERVAL_MS);

  (schedulerInterval as unknown as { unref: () => void }).unref();
  logger.info("Giveaway scheduler started");
}

export function stopGiveawayScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
