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
  addGuildConfig,
  removeGuildConfig,
  getGuildConfigs,
  getConfigByHubChannel,
} from "@fluxcore/systems/tempVoice/config";
import {
  DEFAULT_NAME_TEMPLATE,
  MAX_TEMPVOICE_CONFIGS_PER_GUILD,
} from "@fluxcore/systems/tempVoice/constants";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("tempvoice")
    .setDescription("Configure temporary voice channels")
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Add a new temp voice hub channel")
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
        .setDescription("Remove a temp voice hub configuration")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("The hub channel to remove")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all temp voice hub configurations"),
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

      if (getConfigByHubChannel(channel.id)) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Already Configured",
              `${channel} is already set up as a temp voice hub.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const existingConfigs = getGuildConfigs(interaction.guildId!);
      if (existingConfigs.length >= MAX_TEMPVOICE_CONFIGS_PER_GUILD) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Limit Reached",
              `This server already has ${MAX_TEMPVOICE_CONFIGS_PER_GUILD} temp voice configurations (max).`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await addGuildConfig(interaction.guildId!, {
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

      const channel = interaction.options.getChannel(
        "channel",
        true,
      ) as VoiceChannel;
      const config = getConfigByHubChannel(channel.id);

      if (!config) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Not Configured",
              `${channel} is not set up as a temp voice hub.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await removeGuildConfig(interaction.guildId!, config.id);

      await interaction.reply({
        embeds: [
          successEmbed(
            "Configuration Removed",
            `Temp voice hub ${channel} has been removed.`,
          ),
        ],
        ephemeral: true,
      });
    } else if (sub === "list") {
      const configs = getGuildConfigs(interaction.guildId!);
      if (configs.length === 0) {
        await interaction.reply({
          embeds: [
            infoEmbed(
              "No Configurations",
              "Use `/tempvoice setup` to add a hub channel.",
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const lines = configs.map(
        (c, i) =>
          `**${i + 1}.** <#${c.hubChannelId}> — Template: \`${c.nameTemplate}\`${c.categoryId ? ` — Category: <#${c.categoryId}>` : ""}`,
      );

      await interaction.reply({
        embeds: [
          infoEmbed(
            `Temp Voice Configurations (${configs.length})`,
            lines.join("\n"),
          ),
        ],
        ephemeral: true,
      });
    }
  },
};

export default command;
