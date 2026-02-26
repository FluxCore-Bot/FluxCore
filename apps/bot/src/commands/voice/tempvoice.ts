import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ChatInputCommandInteraction,
  type VoiceChannel,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import {
  successEmbed,
  errorEmbed,
  infoEmbed,
  checkPermissions,
  checkBotPermissions,
} from "@fluxcore/utils";
import {
  setGuildConfig,
  removeGuildConfig,
  getGuildConfig,
} from "@fluxcore/systems/tempVoice/config";
import { DEFAULT_NAME_TEMPLATE } from "@fluxcore/systems/tempVoice/constants";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("tempvoice")
    .setDescription("Configure temporary voice channels")
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set a voice channel as the temp voice hub")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription(
              "The hub voice channel (joining it creates a temp channel)",
            )
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("name-template")
            .setDescription(
              'Channel name template. Use {user} for the creator\'s name. Default: "{user}\'s Channel"',
            )
            .setMaxLength(100),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove the temp voice hub configuration"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Show the current temp voice configuration"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  category: "Voice",
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "setup") {
      if (
        !(await checkPermissions(interaction, [
          PermissionFlagsBits.ManageChannels,
        ])) ||
        !(await checkBotPermissions(interaction, [
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MoveMembers,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.SendMessages,
        ]))
      )
        return;

      const channel = interaction.options.getChannel(
        "channel",
        true,
      ) as VoiceChannel;
      const nameTemplate =
        interaction.options.getString("name-template") ?? DEFAULT_NAME_TEMPLATE;

      await setGuildConfig(interaction.guildId!, {
        hubChannelId: channel.id,
        categoryId: channel.parentId,
        nameTemplate,
      });

      await interaction.reply({
        embeds: [
          successEmbed(
            "Temp Voice Configured",
            `Hub channel set to ${channel}.\nNew temp channels will be created when users join it.\n**Name template:** \`${nameTemplate}\``,
          ),
        ],
        ephemeral: true,
      });
    } else if (sub === "remove") {
      if (
        !(await checkPermissions(interaction, [
          PermissionFlagsBits.ManageChannels,
        ]))
      )
        return;

      const removed = await removeGuildConfig(interaction.guildId!);
      if (!removed) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Not Configured",
              "Temp voice channels are not set up in this server.",
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [
          successEmbed(
            "Configuration Removed",
            "Temp voice channel hub has been removed.",
          ),
        ],
        ephemeral: true,
      });
    } else if (sub === "status") {
      const config = getGuildConfig(interaction.guildId!);
      if (!config) {
        await interaction.reply({
          embeds: [
            infoEmbed(
              "Not Configured",
              "Use `/tempvoice setup` to configure a hub channel.",
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [
          infoEmbed(
            "Temp Voice Status",
            `**Hub Channel:** <#${config.hubChannelId}>\n**Name Template:** \`${config.nameTemplate}\`\n**Category:** ${config.categoryId ? `<#${config.categoryId}>` : "None"}`,
          ),
        ],
        ephemeral: true,
      });
    }
  },
};

export default command;
