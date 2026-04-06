import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
  ChannelType,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { errorEmbed, successEmbed, checkPermissions, logger } from "@fluxcore/utils";
import { getSuggestionSettings } from "@fluxcore/systems/suggestions/config";
import { getSuggestion, updateSuggestionStatus } from "@fluxcore/systems/suggestions/persistence";
import { STATUS_COLORS, STATUS_LABELS } from "@fluxcore/systems/suggestions/constants";
import type { SuggestionStatus } from "@fluxcore/systems/suggestions/types";

async function updateSuggestionEmbed(
  interaction: ChatInputCommandInteraction,
  suggestionId: number,
  messageId: string | null,
  channelId: string | null,
  status: SuggestionStatus,
  statusReason: string | null,
  content: string,
  userId: string,
  anonymousMode: boolean,
  createdAt: Date,
): Promise<void> {
  if (!messageId || !channelId) return;

  const channel = interaction.guild?.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel || channel.type !== ChannelType.GuildText) return;

  try {
    const message = await channel.messages.fetch(messageId);
    const displayName = anonymousMode ? "Anonymous" : `<@${userId}>`;

    const embed = new EmbedBuilder()
      .setTitle(`Suggestion #${suggestionId}`)
      .setDescription(content)
      .setColor(STATUS_COLORS[status] ?? STATUS_COLORS.pending)
      .setTimestamp(createdAt);

    const footerParts = [`Status: ${STATUS_LABELS[status] ?? status}`];
    if (statusReason) {
      footerParts.push(`Reason: ${statusReason}`);
    }
    footerParts.push(`By ${anonymousMode ? "Anonymous" : displayName}`);
    embed.setFooter({ text: footerParts.join(" | ") });

    if (statusReason) {
      embed.addFields({
        name: `${STATUS_LABELS[status] ?? status} by ${interaction.user.displayName}`,
        value: statusReason,
      });
    }

    await message.edit({ embeds: [embed] });
  } catch (error) {
    logger.error(
      `Failed to update suggestion embed #${suggestionId}`,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

async function dmSuggestionAuthor(
  interaction: ChatInputCommandInteraction,
  userId: string,
  suggestionId: number,
  status: SuggestionStatus,
  reason: string | null,
  guildName: string,
): Promise<void> {
  try {
    const user = await interaction.client.users.fetch(userId);
    const embed = new EmbedBuilder()
      .setTitle("Suggestion Update")
      .setDescription(
        `Your suggestion (#${suggestionId}) in **${guildName}** has been **${STATUS_LABELS[status] ?? status}**.` +
          (reason ? `\n\n**Reason:** ${reason}` : ""),
      )
      .setColor(STATUS_COLORS[status] ?? STATUS_COLORS.pending)
      .setTimestamp();

    await user.send({ embeds: [embed] });
  } catch {
    // DMs may be disabled, silently ignore
  }
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("suggestion")
    .setDescription("Manage suggestions")
    .addSubcommand((sub) =>
      sub
        .setName("approve")
        .setDescription("Approve a suggestion")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Suggestion ID").setRequired(true).setMinValue(1),
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for approval").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("deny")
        .setDescription("Deny a suggestion")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Suggestion ID").setRequired(true).setMinValue(1),
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for denial").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("implement")
        .setDescription("Mark a suggestion as implemented")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Suggestion ID").setRequired(true).setMinValue(1),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  category: "Suggestions",
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await checkPermissions(interaction, [PermissionFlagsBits.ManageGuild]))) {
      return;
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "This command can only be used in a server.")],
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const suggestionId = interaction.options.getInteger("id", true);
    const reason = interaction.options.getString("reason") ?? null;

    await interaction.deferReply({ ephemeral: true });

    try {
      const settings = await getSuggestionSettings(guildId);
      const existing = await getSuggestion(suggestionId, guildId);

      if (!existing) {
        await interaction.editReply({
          embeds: [errorEmbed("Not Found", `Suggestion #${suggestionId} was not found.`)],
        });
        return;
      }

      let newStatus: SuggestionStatus;
      switch (subcommand) {
        case "approve":
          newStatus = "approved";
          break;
        case "deny":
          newStatus = "denied";
          break;
        case "implement":
          newStatus = "implemented";
          break;
        default:
          await interaction.editReply({
            embeds: [errorEmbed("Error", "Unknown subcommand.")],
          });
          return;
      }

      const updated = await updateSuggestionStatus(
        suggestionId,
        guildId,
        newStatus,
        interaction.user.id,
        reason ?? undefined,
      );

      if (!updated) {
        await interaction.editReply({
          embeds: [errorEmbed("Error", "Failed to update suggestion.")],
        });
        return;
      }

      // Update the embed in the suggestions channel
      await updateSuggestionEmbed(
        interaction,
        suggestionId,
        existing.messageId,
        settings.channelId,
        newStatus,
        reason,
        existing.content,
        existing.userId,
        settings.anonymousMode,
        existing.createdAt,
      );

      // DM the suggestion author if enabled
      if (settings.dmOnStatusChange) {
        await dmSuggestionAuthor(
          interaction,
          existing.userId,
          suggestionId,
          newStatus,
          reason,
          interaction.guild?.name ?? "Unknown Server",
        );
      }

      await interaction.editReply({
        embeds: [
          successEmbed(
            "Suggestion Updated",
            `Suggestion #${suggestionId} has been **${STATUS_LABELS[newStatus]}**.` +
              (reason ? `\n**Reason:** ${reason}` : ""),
          ),
        ],
      });
    } catch (error) {
      logger.error(
        `Failed to update suggestion #${suggestionId} in guild ${guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [errorEmbed("Error", "Failed to update suggestion. Please try again later.")],
      });
    }
  },
};

export default command;
