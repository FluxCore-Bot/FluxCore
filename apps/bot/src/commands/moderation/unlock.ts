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
    .setName("unlock")
    .setDescription("Unlock a channel to allow @everyone to send messages")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to unlock (defaults to current)")
        .addChannelTypes(ChannelType.GuildText),
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
        SendMessages: null,
      });
    } catch (error) {
      logger.error(
        `Failed to unlock channel ${channel.id} in guild ${interaction.guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [errorEmbed("Unlock Failed", "Failed to unlock the channel.")],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Channel Unlocked",
          `<#${channel.id}> has been unlocked.`,
        ),
      ],
    });
  },
};

export default command;
