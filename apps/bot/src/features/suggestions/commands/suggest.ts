import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
  ChannelType,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { errorEmbed, successEmbed, logger } from "@fluxcore/utils";
import { getSuggestionSettings } from "@fluxcore/systems/suggestions/config";
import { createSuggestion, updateSuggestionMessageId } from "@fluxcore/systems/suggestions/persistence";
import { STATUS_COLORS, MAX_SUGGESTION_LENGTH } from "@fluxcore/systems/suggestions/constants";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Submit a suggestion")
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("Your suggestion (max 2000 characters)")
        .setRequired(true)
        .setMaxLength(MAX_SUGGESTION_LENGTH),
    ),
  category: "Suggestions",
  cooldown: 30,
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "This command can only be used in a server.")],
        ephemeral: true,
      });
      return;
    }

    const settings = await getSuggestionSettings(guildId);
    if (!settings.enabled) {
      await interaction.reply({
        embeds: [errorEmbed("Disabled", "The suggestions system is not enabled on this server.")],
        ephemeral: true,
      });
      return;
    }

    if (!settings.channelId) {
      await interaction.reply({
        embeds: [errorEmbed("Not Configured", "No suggestions channel has been set. Ask a server admin to configure it in the dashboard.")],
        ephemeral: true,
      });
      return;
    }

    const text = interaction.options.getString("text", true);

    await interaction.deferReply({ ephemeral: true });

    try {
      const suggestion = await createSuggestion(guildId, interaction.user.id, text);

      const channel = interaction.guild?.channels.cache.get(settings.channelId) as TextChannel | undefined;
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply({
          embeds: [errorEmbed("Error", "Suggestions channel not found or is not a text channel.")],
        });
        return;
      }

      const displayName = settings.anonymousMode ? "Anonymous" : interaction.user.displayName;
      const embed = new EmbedBuilder()
        .setTitle(`Suggestion #${suggestion.id}`)
        .setDescription(text)
        .setColor(STATUS_COLORS.pending)
        .setFooter({ text: `Status: Pending | By ${displayName}` })
        .setTimestamp(suggestion.createdAt);

      if (!settings.anonymousMode) {
        embed.setAuthor({
          name: interaction.user.displayName,
          iconURL: interaction.user.displayAvatarURL({ size: 64 }),
        });
      }

      const message = await channel.send({ embeds: [embed] });

      // Add voting reactions
      await message.react("\u{1F44D}");
      await message.react("\u{1F44E}");

      // Create discussion thread if enabled
      if (settings.autoThread) {
        await message.startThread({
          name: `Discussion: Suggestion #${suggestion.id}`,
        });
      }

      await updateSuggestionMessageId(suggestion.id, message.id);

      await interaction.editReply({
        embeds: [successEmbed("Suggestion Submitted", `Your suggestion (#${suggestion.id}) has been posted in <#${settings.channelId}>.`)],
      });
    } catch (error) {
      logger.error(
        `Failed to create suggestion in guild ${guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [errorEmbed("Error", "Failed to submit suggestion. Please try again later.")],
      });
    }
  },
};

export default command;
