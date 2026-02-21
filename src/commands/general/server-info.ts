import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { infoEmbed, errorEmbed } from "../../utils/embeds.js";

const MS_PER_SECOND = 1000;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("server-info")
    .setDescription("Displays information about the server"),
  category: "General",
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction) {
    const { guild } = interaction;
    if (!guild) {
      await interaction.reply({
        embeds: [
          errorEmbed("Error", "This command can only be used in a server."),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const owner = await guild.fetchOwner();
    const embed = infoEmbed(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: "Owner", value: owner.user.displayName, inline: true },
        { name: "Members", value: `${guild.memberCount}`, inline: true },
        {
          name: "Channels",
          value: `${guild.channels.cache.size}`,
          inline: true,
        },
        { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
        {
          name: "Boost Level",
          value: `${guild.premiumTier}`,
          inline: true,
        },
        {
          name: "Boosts",
          value: `${guild.premiumSubscriptionCount ?? 0}`,
          inline: true,
        },
        {
          name: "Created",
          value: `<t:${Math.floor(guild.createdTimestamp / MS_PER_SECOND)}:R>`,
          inline: true,
        },
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
