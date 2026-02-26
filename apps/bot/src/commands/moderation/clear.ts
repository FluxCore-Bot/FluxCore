import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import {
  successEmbed,
  errorEmbed,
  checkPermissions,
  checkBotPermissions,
} from "@fluxcore/utils";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete multiple messages from a channel")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of messages to delete (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Only delete messages from this user"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  category: "Moderation",
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ])) ||
      !(await checkBotPermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ]))
    ) {
      return;
    }

    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Error",
            "This command can only be used in text channels.",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const amount = interaction.options.getInteger("amount", true);
    const targetUser = interaction.options.getUser("user");

    await interaction.deferReply({ ephemeral: true });

    let messages = await channel.messages.fetch({ limit: amount });

    if (targetUser) {
      messages = messages.filter((m) => m.author.id === targetUser.id);
    }

    const deleted = await channel.bulkDelete(messages, true);

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Messages Cleared",
          `Deleted **${deleted.size}** message(s).${
            targetUser ? ` (from ${targetUser.displayName})` : ""
          }`,
        ),
      ],
    });
  },
};

export default command;
