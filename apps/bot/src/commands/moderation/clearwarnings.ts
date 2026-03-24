import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import {
  successEmbed,
  errorEmbed,
  checkPermissions,
  logger,
} from "@fluxcore/utils";
import { deleteWarning, deleteAllWarnings, getWarningById } from "@fluxcore/systems/warnings/persistence";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("Clear warnings for a member")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to clear warnings for")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription("Specific warning ID to remove (omit to clear all)"),
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

    const user = interaction.options.getUser("user", true);
    const warningId = interaction.options.getInteger("id");

    await interaction.deferReply();

    try {
      if (warningId !== null) {
        // Delete specific warning
        const warning = await getWarningById(warningId, interaction.guildId!);
        if (!warning || warning.userId !== user.id) {
          await interaction.editReply({
            embeds: [
              errorEmbed(
                "Not Found",
                `Warning #${warningId} was not found for this user.`,
              ),
            ],
          });
          return;
        }

        await deleteWarning(warningId, interaction.guildId!);
        await interaction.editReply({
          embeds: [
            successEmbed(
              "Warning Removed",
              `Warning **#${warningId}** has been removed from **${user.displayName}**.`,
            ),
          ],
        });
      } else {
        // Delete all warnings for user
        const count = await deleteAllWarnings(interaction.guildId!, user.id);

        if (count === 0) {
          await interaction.editReply({
            embeds: [
              errorEmbed(
                "No Warnings",
                `**${user.displayName}** has no warnings to clear.`,
              ),
            ],
          });
          return;
        }

        await interaction.editReply({
          embeds: [
            successEmbed(
              "Warnings Cleared",
              `Cleared **${count}** warning(s) from **${user.displayName}**.`,
            ),
          ],
        });
      }
    } catch (error) {
      logger.error(
        `Failed to clear warnings for ${user.id} in guild ${interaction.guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Error",
            "Failed to clear warnings. Please try again later.",
          ),
        ],
      });
    }
  },
};

export default command;
