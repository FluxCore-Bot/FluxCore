import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import {
  successEmbed,
  errorEmbed,
  checkPermissions,
  checkBotPermissions,
  logger,
} from "@fluxcore/utils";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock a channel to prevent @everyone from sending messages")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to lock (defaults to current)")
        .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for locking"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  category: "Moderation",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [
        PermissionFlagsBits.ManageChannels,
      ])) ||
      !(await checkBotPermissions(interaction, [
        PermissionFlagsBits.ManageChannels,
      ]))
    ) {
      return;
    }

    const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel | null;
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    if (!channel || !("permissionOverwrites" in channel)) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "Could not find that channel.")],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, {
        SendMessages: false,
      });
    } catch (error) {
      logger.error(
        `Failed to lock channel ${channel.id} in guild ${interaction.guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [errorEmbed("Lock Failed", "Failed to lock the channel.")],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Channel Locked",
          `<#${channel.id}> has been locked.\n**Reason:** ${reason}`,
        ),
      ],
    });
  },
};

export default command;
