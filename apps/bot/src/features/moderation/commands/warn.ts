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
  warnEmbed,
  checkPermissions,
  isAboveTarget,
  logger,
} from "@fluxcore/utils";
import { createWarning, getWarningCount } from "@fluxcore/systems/warnings/persistence";
import { checkAndExecutePunishment } from "@fluxcore/systems/warnings/escalation";
import { getWarnSettings } from "@fluxcore/systems/warnings/config";
import { MAX_REASON_LENGTH } from "@fluxcore/systems/warnings/constants";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue a warning to a member")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to warn")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the warning")
        .setMaxLength(MAX_REASON_LENGTH),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  category: "Moderation",
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ]))
    ) {
      return;
    }

    const target = interaction.options.getMember("user") as GuildMember | null;
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    if (!target) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "Could not find that member.")],
        ephemeral: true,
      });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "You cannot warn yourself.")],
        ephemeral: true,
      });
      return;
    }

    if (target.id === interaction.client.user.id) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "You cannot warn the bot.")],
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
            "You cannot warn a member with an equal or higher role.",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const settings = await getWarnSettings(interaction.guildId!);

    if (settings.reasonRequired && interaction.options.getString("reason") === null) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "A reason is required to warn this member.")],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const warning = await createWarning({
        guildId: interaction.guildId!,
        userId: target.id,
        moderatorId: interaction.user.id,
        reason,
      });

      const warnCount = await getWarningCount(interaction.guildId!, target.id);

      // Check escalation thresholds
      const escalation = await checkAndExecutePunishment(
        interaction.guildId!,
        target.id,
        warnCount,
        target,
      );

      // DM user if enabled
      if (settings.dmOnWarn) {
        try {
          await target.send({
            embeds: [
              warnEmbed(
                "Warning Received",
                `You have been warned in **${interaction.guild!.name}**.\n**Reason:** ${reason}\n**Total warnings:** ${warnCount}`,
              ),
            ],
          });
        } catch {
          // DM failure is non-critical
        }
      }

      let description = `**${target.user.displayName}** has been warned.\n**Reason:** ${reason}\n**Warning #${warnCount}** (ID: ${warning.id})`;

      if (escalation.triggered) {
        description += `\n\n**Escalation triggered:** ${escalation.action} at ${escalation.threshold} warnings`;
      }

      await interaction.editReply({
        embeds: [successEmbed("Member Warned", description)],
      });
    } catch (error) {
      logger.error(
        `Failed to warn ${target.id} in guild ${interaction.guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Warn Failed",
            "Failed to issue the warning. Please try again later.",
          ),
        ],
      });
    }
  },
};

export default command;
