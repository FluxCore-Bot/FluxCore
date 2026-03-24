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
import { createModCase } from "@fluxcore/systems/moderation/persistence";
import { getModSettings } from "@fluxcore/systems/moderation/persistence";
import { dmOnPunishment } from "@fluxcore/systems/moderation/dm";
import { DURATION_PRESETS } from "@fluxcore/systems/moderation/constants";

const SECONDS_PER_DAY = 86_400;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("tempban")
    .setDescription("Temporarily ban a member from the server")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to tempban")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription("Duration (1h, 6h, 12h, 1d, 3d, 7d, 14d, 30d)")
        .setRequired(true)
        .addChoices(
          { name: "1 hour", value: "1h" },
          { name: "6 hours", value: "6h" },
          { name: "12 hours", value: "12h" },
          { name: "1 day", value: "1d" },
          { name: "3 days", value: "3d" },
          { name: "7 days", value: "7d" },
          { name: "14 days", value: "14d" },
          { name: "30 days", value: "30d" },
        ),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the tempban"),
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
    const durationStr = interaction.options.getString("duration", true);
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
        embeds: [errorEmbed("Error", "You cannot tempban yourself.")],
        ephemeral: true,
      });
      return;
    }

    if (target.id === interaction.client.user.id) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "I cannot tempban myself.")],
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

    const durationSecs = DURATION_PRESETS[durationStr];
    if (!durationSecs) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Invalid Duration",
            "Use one of: 1h, 6h, 12h, 1d, 3d, 7d, 14d, 30d.",
          ),
        ],
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
            "You cannot tempban a member with an equal or higher role.",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const expiresAt = new Date(Date.now() + durationSecs * 1000);

    const modSettings = await getModSettings(interaction.guildId!);
    if (modSettings.dmOnPunishment) {
      await dmOnPunishment(target, interaction.guild!.name, "temporarily banned", reason, durationStr);
    }

    try {
      await target.ban({
        reason: `Tempban (${durationStr}): ${reason}`,
        deleteMessageSeconds: deleteDays * SECONDS_PER_DAY,
      });
    } catch (error) {
      logger.error(
        `Failed to tempban ${target.user.id} in guild ${interaction.guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Tempban Failed",
            "Failed to ban the member. They may have left the server.",
          ),
        ],
      });
      return;
    }

    await createModCase({
      guildId: interaction.guildId!,
      targetId: target.id,
      moderatorId: interaction.user.id,
      action: "tempban",
      reason,
      duration: durationSecs,
      expiresAt,
    });

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Member Temporarily Banned",
          `**${target.user.displayName}** was temporarily banned for **${durationStr}**.\n**Reason:** ${reason}\n**Expires:** <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
        ),
      ],
    });
  },
};

export default command;
