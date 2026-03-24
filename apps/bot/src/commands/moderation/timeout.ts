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
  parseDuration,
  formatDuration,
  logger,
} from "@fluxcore/utils";
import { createModCase } from "@fluxcore/systems/moderation/persistence";
import { getModSettings } from "@fluxcore/systems/moderation/persistence";
import { dmOnPunishment } from "@fluxcore/systems/moderation/dm";

const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to timeout")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription("Duration (e.g., 10m, 2h, 1d)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the timeout"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  category: "Moderation",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [
        PermissionFlagsBits.ModerateMembers,
      ])) ||
      !(await checkBotPermissions(interaction, [
        PermissionFlagsBits.ModerateMembers,
      ]))
    ) {
      return;
    }

    const target = interaction.options.getMember("user") as GuildMember | null;
    const durationStr = interaction.options.getString("duration", true);
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
        embeds: [errorEmbed("Error", "You cannot timeout yourself.")],
        ephemeral: true,
      });
      return;
    }

    if (target.id === interaction.client.user.id) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "I cannot timeout myself.")],
        ephemeral: true,
      });
      return;
    }

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Invalid Duration",
            "Use a format like `10s`, `5m`, `2h`, `1d`. Maximum: 28 days.",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (durationMs > MAX_TIMEOUT) {
      await interaction.reply({
        embeds: [
          errorEmbed("Error", "Timeout duration cannot exceed 28 days."),
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
            "You cannot timeout a member with an equal or higher role.",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const modSettings = await getModSettings(interaction.guildId!);
    if (modSettings.dmOnPunishment) {
      await dmOnPunishment(target, interaction.guild!.name, "timed out", reason, formatDuration(durationMs));
    }

    try {
      await target.timeout(durationMs, reason);
    } catch (error) {
      logger.error(
        `Failed to timeout ${target.user.id} in guild ${interaction.guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Timeout Failed",
            "Failed to timeout the member. They may have left the server.",
          ),
        ],
      });
      return;
    }

    const durationSecs = Math.floor(durationMs / 1000);
    await createModCase({
      guildId: interaction.guildId!,
      targetId: target.id,
      moderatorId: interaction.user.id,
      action: "timeout",
      reason,
      duration: durationSecs,
      expiresAt: new Date(Date.now() + durationMs),
    });

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Member Timed Out",
          `**${target.user.displayName}** was timed out for **${formatDuration(durationMs)}**.\n**Reason:** ${reason}`,
        ),
      ],
    });
  },
};

export default command;
