import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import {
  successEmbed,
  checkPermissions,
} from "@fluxcore/utils";
import { createModCase } from "@fluxcore/systems/moderation/persistence";
import { MAX_REASON_LENGTH } from "@fluxcore/systems/moderation/constants";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("note")
    .setDescription("Add an internal moderator note to a user")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to add a note for")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("The note text")
        .setRequired(true)
        .setMaxLength(MAX_REASON_LENGTH),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  category: "Moderation",
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ]))
    ) {
      return;
    }

    const target = interaction.options.getUser("user", true);
    const text = interaction.options.getString("text", true);

    await createModCase({
      guildId: interaction.guildId!,
      targetId: target.id,
      moderatorId: interaction.user.id,
      action: "note",
      reason: text,
    });

    await interaction.reply({
      embeds: [
        successEmbed(
          "Note Added",
          `A note has been added for **${target.displayName}**.`,
        ),
      ],
      ephemeral: true,
    });
  },
};

export default command;
