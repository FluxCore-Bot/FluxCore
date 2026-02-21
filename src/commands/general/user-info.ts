import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { infoEmbed, errorEmbed } from "../../utils/embeds.js";

const MS_PER_SECOND = 1000;
const MAX_DISPLAYED_ROLES = 10;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("user-info")
    .setDescription("Displays information about a user")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to get info about (defaults to you)"),
    ),
  category: "General",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        embeds: [
          errorEmbed("Error", "This command can only be used in a server."),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const targetUser = interaction.options.getUser("user") ?? interaction.user;
    const member = await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null);

    const embed = infoEmbed(targetUser.displayName)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "ID", value: targetUser.id, inline: true },
        { name: "Bot", value: targetUser.bot ? "Yes" : "No", inline: true },
        {
          name: "Account Created",
          value: `<t:${Math.floor(targetUser.createdTimestamp / MS_PER_SECOND)}:R>`,
          inline: true,
        },
      );

    if (member) {
      const roles =
        member.roles.cache
          .filter((r) => r.id !== interaction.guild!.id)
          .sort((a, b) => b.position - a.position)
          .map((r) => `${r}`)
          .slice(0, MAX_DISPLAYED_ROLES)
          .join(", ") || "None";

      embed.addFields(
        {
          name: "Joined Server",
          value: member.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp / MS_PER_SECOND)}:R>`
            : "Unknown",
          inline: true,
        },
        {
          name: `Roles (${member.roles.cache.size - 1})`,
          value: roles,
        },
      );
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
