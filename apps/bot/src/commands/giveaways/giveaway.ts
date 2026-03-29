import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { successEmbed, errorEmbed, warnEmbed, checkPermissions, logger, parseDuration, formatDuration } from "@fluxcore/utils";
import {
  createGiveaway,
  getGiveaway,
  getActiveGiveaways,
  endGiveaway,
  getActiveGiveawayCount,
} from "@fluxcore/systems/giveaways/persistence";
import { selectWinners, rerollWinners } from "@fluxcore/systems/giveaways/winner";
import {
  buildGiveawayEmbed,
  buildEndedGiveawayEmbed,
  buildGiveawayButton,
} from "@fluxcore/systems/giveaways/embed";
import { setGiveawayMessageId } from "@fluxcore/systems/giveaways/persistence";
import {
  MAX_WINNERS,
  MAX_PRIZE_LENGTH,
  MAX_ACTIVE_GIVEAWAYS,
} from "@fluxcore/systems/giveaways/constants";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage giveaways")
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a new giveaway")
        .addStringOption((opt) =>
          opt
            .setName("prize")
            .setDescription("What are you giving away?")
            .setMaxLength(MAX_PRIZE_LENGTH)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("duration")
            .setDescription("How long the giveaway lasts (e.g. 1h, 2d, 30m)")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("winners")
            .setDescription("Number of winners (default: 1)")
            .setMinValue(1)
            .setMaxValue(MAX_WINNERS),
        )
        .addRoleOption((opt) =>
          opt
            .setName("required_role")
            .setDescription("Role required to enter"),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End a giveaway early")
        .addIntegerOption((opt) =>
          opt
            .setName("id")
            .setDescription("Giveaway ID")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reroll")
        .setDescription("Re-select winners for a giveaway")
        .addIntegerOption((opt) =>
          opt
            .setName("id")
            .setDescription("Giveaway ID")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List active giveaways"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  category: "Giveaways",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await checkPermissions(interaction, [PermissionFlagsBits.ManageGuild]))) {
      return;
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "This command can only be used in a server.")],
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "start":
        await handleStart(interaction, guildId);
        break;
      case "end":
        await handleEnd(interaction, guildId);
        break;
      case "reroll":
        await handleReroll(interaction, guildId);
        break;
      case "list":
        await handleList(interaction, guildId);
        break;
      default:
        await interaction.reply({
          embeds: [errorEmbed("Error", "Unknown subcommand.")],
          ephemeral: true,
        });
    }
  },
};

async function handleStart(
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> {
  const prize = interaction.options.getString("prize", true);
  const durationStr = interaction.options.getString("duration", true);
  const winnersCount = interaction.options.getInteger("winners") ?? 1;
  const requiredRole = interaction.options.getRole("required_role");

  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "Invalid Duration",
          "Please use a valid duration format: `1h`, `30m`, `2d`, `1w`",
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  // Check active giveaway limit
  try {
    const activeCount = await getActiveGiveawayCount(guildId);
    if (activeCount >= MAX_ACTIVE_GIVEAWAYS) {
      await interaction.reply({
        embeds: [
          warnEmbed(
            "Limit Reached",
            `You can only have ${MAX_ACTIVE_GIVEAWAYS} active giveaways at a time.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }
  } catch (err) {
    logger.error(
      `Failed to check active giveaway count for guild ${guildId}`,
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  await interaction.deferReply();

  try {
    const endsAt = new Date(Date.now() + durationMs);
    const requiredRoleIds = requiredRole ? [requiredRole.id] : [];

    const giveaway = await createGiveaway({
      guildId,
      channelId: interaction.channelId,
      hostId: interaction.user.id,
      prize,
      winners: winnersCount,
      endsAt,
      requiredRoleIds,
    });

    const embed = buildGiveawayEmbed(giveaway);
    const button = buildGiveawayButton(giveaway.id);

    const channel = interaction.channel as TextChannel;
    const message = await channel.send({
      embeds: [embed],
      components: [button],
    });

    await setGiveawayMessageId(giveaway.id, message.id);

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Giveaway Started",
          `Giveaway #${giveaway.id} for **${prize}** has been created!\nEnds in ${formatDuration(durationMs)} (${winnersCount} winner${winnersCount > 1 ? "s" : ""})`,
        ),
      ],
    });
  } catch (err) {
    logger.error(
      `Failed to create giveaway in guild ${guildId}`,
      err instanceof Error ? err : new Error(String(err)),
    );
    await interaction.editReply({
      embeds: [errorEmbed("Error", "Failed to create giveaway. Please try again later.")],
    });
  }
}

async function handleEnd(
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> {
  const id = interaction.options.getInteger("id", true);

  await interaction.deferReply({ ephemeral: true });

  try {
    const giveaway = await getGiveaway(id, guildId);
    if (!giveaway) {
      await interaction.editReply({
        embeds: [errorEmbed("Not Found", `Giveaway #${id} not found in this server.`)],
      });
      return;
    }

    if (giveaway.ended) {
      await interaction.editReply({
        embeds: [warnEmbed("Already Ended", `Giveaway #${id} has already ended.`)],
      });
      return;
    }

    const winners = selectWinners(giveaway);
    const ended = await endGiveaway(id, winners);

    // Update the message
    if (giveaway.messageId && interaction.guild) {
      try {
        const channel = interaction.guild.channels.cache.get(
          giveaway.channelId,
        ) as TextChannel | undefined;
        if (channel) {
          const message = await channel.messages.fetch(giveaway.messageId);
          await message.edit({
            embeds: [buildEndedGiveawayEmbed(ended)],
            components: [],
          });

          if (winners.length > 0) {
            const winnerMentions = winners.map((wid) => `<@${wid}>`).join(", ");
            await channel.send({
              content: `\uD83C\uDF89 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`,
            });
          }
        }
      } catch {
        // Message may have been deleted
      }
    }

    const winnerText =
      winners.length > 0
        ? winners.map((wid) => `<@${wid}>`).join(", ")
        : "No valid entries";

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Giveaway Ended",
          `Giveaway #${id} has been ended.\n**Winners:** ${winnerText}`,
        ),
      ],
    });
  } catch (err) {
    logger.error(
      `Failed to end giveaway ${id} in guild ${guildId}`,
      err instanceof Error ? err : new Error(String(err)),
    );
    await interaction.editReply({
      embeds: [errorEmbed("Error", "Failed to end giveaway. Please try again later.")],
    });
  }
}

async function handleReroll(
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> {
  const id = interaction.options.getInteger("id", true);

  await interaction.deferReply({ ephemeral: true });

  try {
    const giveaway = await getGiveaway(id, guildId);
    if (!giveaway) {
      await interaction.editReply({
        embeds: [errorEmbed("Not Found", `Giveaway #${id} not found in this server.`)],
      });
      return;
    }

    if (!giveaway.ended) {
      await interaction.editReply({
        embeds: [warnEmbed("Not Ended", `Giveaway #${id} has not ended yet. Use \`/giveaway end\` first.`)],
      });
      return;
    }

    const newWinners = rerollWinners(giveaway);
    if (newWinners.length === 0) {
      await interaction.editReply({
        embeds: [warnEmbed("No Entries", "There are no remaining eligible entrants to reroll.")],
      });
      return;
    }

    const updated = await endGiveaway(id, newWinners);

    // Update the message and announce
    if (giveaway.messageId && interaction.guild) {
      try {
        const channel = interaction.guild.channels.cache.get(
          giveaway.channelId,
        ) as TextChannel | undefined;
        if (channel) {
          try {
            const message = await channel.messages.fetch(giveaway.messageId);
            await message.edit({
              embeds: [buildEndedGiveawayEmbed(updated)],
              components: [],
            });
          } catch {
            // Message may have been deleted
          }

          const winnerMentions = newWinners.map((wid) => `<@${wid}>`).join(", ");
          await channel.send({
            content: `\uD83C\uDF89 Giveaway rerolled! New winner${newWinners.length > 1 ? "s" : ""}: ${winnerMentions} for **${giveaway.prize}**!`,
          });
        }
      } catch {
        // Channel may not be accessible
      }
    }

    const winnerText = newWinners.map((wid) => `<@${wid}>`).join(", ");
    await interaction.editReply({
      embeds: [
        successEmbed(
          "Giveaway Rerolled",
          `Giveaway #${id} has been rerolled.\n**New Winners:** ${winnerText}`,
        ),
      ],
    });
  } catch (err) {
    logger.error(
      `Failed to reroll giveaway ${id} in guild ${guildId}`,
      err instanceof Error ? err : new Error(String(err)),
    );
    await interaction.editReply({
      embeds: [errorEmbed("Error", "Failed to reroll giveaway. Please try again later.")],
    });
  }
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const giveaways = await getActiveGiveaways(guildId);

    if (giveaways.length === 0) {
      await interaction.editReply({
        embeds: [warnEmbed("No Active Giveaways", "There are no active giveaways in this server.")],
      });
      return;
    }

    const lines = giveaways.map((g) => {
      const unixTs = Math.floor(g.endsAt.getTime() / 1000);
      return `**#${g.id}** — ${g.prize} (${g.winners} winner${g.winners > 1 ? "s" : ""}) — Ends <t:${unixTs}:R> — ${g.entrantIds.length} entries`;
    });

    await interaction.editReply({
      embeds: [
        successEmbed(
          `Active Giveaways (${giveaways.length})`,
          lines.join("\n"),
        ),
      ],
    });
  } catch (err) {
    logger.error(
      `Failed to list giveaways in guild ${guildId}`,
      err instanceof Error ? err : new Error(String(err)),
    );
    await interaction.editReply({
      embeds: [errorEmbed("Error", "Failed to list giveaways. Please try again later.")],
    });
  }
}

export default command;
