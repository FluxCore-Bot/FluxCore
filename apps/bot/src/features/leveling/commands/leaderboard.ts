import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { infoEmbed, errorEmbed, logger } from "@fluxcore/utils";
import { getLeaderboard } from "@fluxcore/systems/leveling/persistence";
import { LEADERBOARD_PAGE_SIZE } from "@fluxcore/systems/leveling/constants";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the server XP leaderboard")
    .addIntegerOption((option) =>
      option
        .setName("page")
        .setDescription("Page number (default: 1)")
        .setMinValue(1)
        .setRequired(false),
    ),
  category: "Leveling",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    const page = interaction.options.getInteger("page") ?? 1;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "This command can only be used in a server.")],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const { entries, total } = await getLeaderboard(guildId, page, LEADERBOARD_PAGE_SIZE);
      const totalPages = Math.max(1, Math.ceil(total / LEADERBOARD_PAGE_SIZE));

      if (entries.length === 0) {
        await interaction.editReply({
          embeds: [infoEmbed("Leaderboard", "No one has earned XP yet. Start chatting!")],
        });
        return;
      }

      const startRank = (page - 1) * LEADERBOARD_PAGE_SIZE + 1;
      const lines = entries.map((entry, i) => {
        const rank = startRank + i;
        const medal = rank === 1 ? " :first_place:" : rank === 2 ? " :second_place:" : rank === 3 ? " :third_place:" : "";
        return `**#${rank}**${medal} <@${entry.userId}> -- Level ${entry.level} -- ${entry.xp.toLocaleString()} XP`;
      });

      const embed = infoEmbed(
        `Leaderboard -- ${interaction.guild?.name ?? "Server"}`,
        lines.join("\n"),
      );
      embed.setFooter({ text: `Page ${page} of ${totalPages} | ${total} members ranked` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(
        `Failed to get leaderboard for guild ${guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [errorEmbed("Error", "Failed to retrieve leaderboard. Please try again later.")],
      });
    }
  },
};

export default command;
