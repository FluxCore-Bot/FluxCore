import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import {
  successEmbed,
  errorEmbed,
  checkPermissions,
  checkBotPermissions,
  isAboveTarget,
  logger,
} from "@fluxcore/utils";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to kick")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the kick"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  category: "Moderation",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [
        PermissionFlagsBits.KickMembers,
      ])) ||
      !(await checkBotPermissions(interaction, [
        PermissionFlagsBits.KickMembers,
      ]))
    ) {
      return;
    }

    const target = interaction.options.getMember("user") as GuildMember | null;
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";

    if (!target) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "Could not find that member.")],
        ephemeral: true,
      });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "You cannot kick yourself.")],
        ephemeral: true,
      });
      return;
    }

    if (target.id === interaction.client.user.id) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "I cannot kick myself.")],
        ephemeral: true,
      });
      return;
    }

    if (!target.kickable) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "I cannot kick this member.")],
        ephemeral: true,
      });
      return;
    }

    const actor = interaction.member as GuildMember;
    if (!isAboveTarget(actor, target)) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Error",
            "You cannot kick a member with an equal or higher role.",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      await target.kick(reason);
    } catch (error) {
      logger.error(
        `Failed to kick ${target.user.id} in guild ${interaction.guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Kick Failed",
            "Failed to kick the member. They may have left the server.",
          ),
        ],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Member Kicked",
          `**${target.user.displayName}** was kicked.\n**Reason:** ${reason}`,
        ),
      ],
    });
  },
};

export default command;
