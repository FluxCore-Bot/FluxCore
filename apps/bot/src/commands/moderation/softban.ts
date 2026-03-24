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

const SEVEN_DAYS_SECS = 7 * 86_400;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("softban")
    .setDescription("Softban a member (ban + unban to purge messages)")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to softban")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the softban"),
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

    if (!target) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "Could not find that member.")],
        ephemeral: true,
      });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "You cannot softban yourself.")],
        ephemeral: true,
      });
      return;
    }

    if (target.id === interaction.client.user.id) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "I cannot softban myself.")],
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
            "You cannot softban a member with an equal or higher role.",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const modSettings = await getModSettings(interaction.guildId!);
    if (modSettings.dmOnPunishment) {
      await dmOnPunishment(target, interaction.guild!.name, "softbanned", reason);
    }

    try {
      await target.ban({
        reason: `Softban: ${reason}`,
        deleteMessageSeconds: SEVEN_DAYS_SECS,
      });
      await interaction.guild!.members.unban(target.id, "Softban");
    } catch (error) {
      logger.error(
        `Failed to softban ${target.user.id} in guild ${interaction.guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Softban Failed",
            "Failed to softban the member. They may have left the server.",
          ),
        ],
      });
      return;
    }

    await createModCase({
      guildId: interaction.guildId!,
      targetId: target.id,
      moderatorId: interaction.user.id,
      action: "softban",
      reason,
    });

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Member Softbanned",
          `**${target.user.displayName}** was softbanned (messages purged).\n**Reason:** ${reason}`,
        ),
      ],
    });
  },
};

export default command;
