import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { successEmbed, errorEmbed, parseDuration, formatDuration, logger } from "@fluxcore/utils";
import { createReminder } from "../../systems/reminders.js";

const MAX_REMINDER = 7 * 24 * 60 * 60 * 1000;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Set a reminder")
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription("When to remind you (e.g., 10m, 2h, 1d)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("What to remind you about")
        .setRequired(true)
        .setMaxLength(1024),
    ),
  category: "Utility",
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction) {
    const durationStr = interaction.options.getString("duration", true);
    const message = interaction.options.getString("message", true);

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Invalid Duration",
            "Use a format like `10s`, `5m`, `2h`, `1d`.",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (durationMs > MAX_REMINDER) {
      await interaction.reply({
        embeds: [
          errorEmbed("Error", "Reminders cannot be longer than 7 days."),
        ],
        ephemeral: true,
      });
      return;
    }

    try {
      await createReminder(
        interaction.user.id,
        message,
        durationMs,
        interaction.channelId,
        interaction.guildId ?? undefined,
      );
    } catch (error) {
      logger.error(
        `Failed to create reminder for ${interaction.user.id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.reply({
        embeds: [
          errorEmbed("Error", "Failed to save reminder. Please try again."),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        successEmbed(
          "Reminder Set",
          `I'll remind you in **${formatDuration(durationMs)}**.`,
        ),
      ],
      ephemeral: true,
    });
  },
};

export default command;
