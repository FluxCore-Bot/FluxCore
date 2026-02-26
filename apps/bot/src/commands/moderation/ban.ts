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

const SECONDS_PER_DAY = 86_400;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to ban")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the ban"),
    )
    .addIntegerOption((option) =>
      option
        .setName("delete-days")
        .setDescription("Days of messages to delete (0-7)")
        .setMinValue(0)
        .setMaxValue(7),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  category: "Moderation",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [
        PermissionFlagsBits.BanMembers,
      ])) ||
      !(await checkBotPermissions(interaction, [
        PermissionFlagsBits.BanMembers,
      ]))
    ) {
      return;
    }

    const target = interaction.options.getMember("user") as GuildMember | null;
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";
    const deleteDays = interaction.options.getInteger("delete-days") ?? 0;

    if (!target) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "Could not find that member.")],
        ephemeral: true,
      });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "You cannot ban yourself.")],
        ephemeral: true,
      });
      return;
    }

    if (target.id === interaction.client.user.id) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "I cannot ban myself.")],
        ephemeral: true,
      });
      return;
    }

    if (!target.bannable) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "I cannot ban this member.")],
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
            "You cannot ban a member with an equal or higher role.",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      await target.ban({
        reason,
        deleteMessageSeconds: deleteDays * SECONDS_PER_DAY,
      });
    } catch (error) {
      logger.error(
        `Failed to ban ${target.user.id} in guild ${interaction.guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Ban Failed",
            "Failed to ban the member. They may have left the server.",
          ),
        ],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Member Banned",
          `**${target.user.displayName}** was banned.\n**Reason:** ${reason}`,
        ),
      ],
    });
  },
};

export default command;
