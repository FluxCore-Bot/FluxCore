import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { infoEmbed, errorEmbed, logger } from "@fluxcore/utils";
import { getUserLevel, getUserRank, getLeaderboard } from "@fluxcore/systems/leveling/persistence";
import { xpForLevel, totalXpForLevel } from "@fluxcore/systems/leveling/xp";

function buildProgressBar(current: number, total: number, length = 10): string {
  const filled = Math.round((current / total) * length);
  const empty = length - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${Math.round((current / total) * 100)}%`;
}

function formatVoiceTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("View your rank or another member's rank")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to view (defaults to yourself)")
        .setRequired(false),
    ),
  category: "Leveling",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser("user") ?? interaction.user;
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
      const userLevel = await getUserLevel(guildId, targetUser.id);
      const rank = await getUserRank(guildId, targetUser.id);
      const { total: totalMembers } = await getLeaderboard(guildId, 1, 1);

      const level = userLevel?.level ?? 0;
      const xp = userLevel?.xp ?? 0;
      const messageCount = userLevel?.messageCount ?? 0;
      const voiceMinutes = userLevel?.voiceMinutes ?? 0;

      // Calculate progress within current level
      const xpAtCurrentLevel = totalXpForLevel(level);
      const xpInLevel = xp - xpAtCurrentLevel;
      const xpNeeded = xpForLevel(level);
      const progressBar = buildProgressBar(xpInLevel, xpNeeded);

      const embed = infoEmbed(
        `Rank -- ${targetUser.displayName}`,
        [
          `**Level:** ${level}`,
          `**XP:** ${xpInLevel.toLocaleString()} / ${xpNeeded.toLocaleString()}`,
          `**Progress:** ${progressBar}`,
          `**Rank:** #${rank || "N/A"} of ${totalMembers.toLocaleString()}`,
          `**Messages:** ${messageCount.toLocaleString()}`,
          `**Voice:** ${formatVoiceTime(voiceMinutes)}`,
        ].join("\n"),
      );

      embed.setThumbnail(targetUser.displayAvatarURL({ size: 128 }));

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(
        `Failed to get rank for ${targetUser.id} in guild ${guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [errorEmbed("Error", "Failed to retrieve rank. Please try again later.")],
      });
    }
  },
};

export default command;
