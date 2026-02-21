import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { successEmbed, errorEmbed } from "../../utils/embeds.js";
import { checkPermissions, checkBotPermissions } from "../../utils/permissions.js";

const COLOR_CHOICES = [
  { name: "Red", value: "#ED4245" },
  { name: "Green", value: "#57F287" },
  { name: "Blue", value: "#5865F2" },
  { name: "Yellow", value: "#FEE75C" },
  { name: "Purple", value: "#9B59B6" },
  { name: "White", value: "#FFFFFF" },
] as const;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Create a custom embed message")
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("Embed title")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("Embed description")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("Embed color")
        .addChoices(...COLOR_CHOICES),
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to send the embed to (defaults to current)")
        .addChannelTypes(ChannelType.GuildText),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  category: "Utility",
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ])) ||
      !(await checkBotPermissions(interaction, [
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
      ]))
    ) {
      return;
    }

    const title = interaction.options.getString("title", true);
    const description = interaction.options.getString("description", true);
    const color = interaction.options.getString("color") ?? "#5865F2";
    const targetChannel = (interaction.options.getChannel("channel") ??
      interaction.channel) as TextChannel;

    // Verify bot can send in the target channel specifically
    const botMember = interaction.guild?.members.me;
    if (botMember) {
      const channelPerms = targetChannel.permissionsFor(botMember);
      if (!channelPerms?.has(PermissionFlagsBits.SendMessages) || !channelPerms.has(PermissionFlagsBits.EmbedLinks)) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Missing Permissions",
              `I don't have permission to send embeds in ${targetChannel}.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color as `#${string}`)
      .setTimestamp()
      .setFooter({ text: `Created by ${interaction.user.displayName}` });

    await targetChannel.send({ embeds: [embed] });

    await interaction.reply({
      embeds: [
        successEmbed("Embed Sent", `Embed posted in ${targetChannel}.`),
      ],
      ephemeral: true,
    });
  },
};

export default command;
