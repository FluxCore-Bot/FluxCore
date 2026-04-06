import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { infoEmbed } from "@fluxcore/utils";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Get a user's avatar")
    .addUserOption((option) =>
      option.setName("user").setDescription("The user (defaults to you)"),
    ),
  category: "Utility",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const avatarUrl = user.displayAvatarURL({ size: 4096 });

    const embed = infoEmbed(user.displayName)
      .setImage(avatarUrl)
      .setDescription(`[Download Avatar](${avatarUrl})`);

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
