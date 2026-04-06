import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { infoEmbed, errorEmbed, logger } from "@fluxcore/utils";
import { getTicketByChannel } from "@fluxcore/systems/tickets/persistence";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-remove")
    .setDescription("Remove a user from the current ticket")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to remove from the ticket")
        .setRequired(true),
    ),
  category: "Tickets",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "This command can only be used in a server.")],
        ephemeral: true,
      });
      return;
    }

    const ticket = await getTicketByChannel(interaction.channelId);
    if (!ticket) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "This channel is not a ticket.")],
        ephemeral: true,
      });
      return;
    }

    if (ticket.status === "closed") {
      await interaction.reply({
        embeds: [errorEmbed("Error", "This ticket is closed.")],
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser("user", true);

    // Don't allow removing the ticket creator
    if (targetUser.id === ticket.userId) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "You cannot remove the ticket creator.")],
        ephemeral: true,
      });
      return;
    }

    try {
      const channel = interaction.channel as TextChannel;
      await channel.permissionOverwrites.delete(targetUser.id);

      await interaction.reply({
        embeds: [
          infoEmbed(
            "User Removed",
            `<@${targetUser.id}> has been removed from this ticket.`,
          ),
        ],
      });
    } catch (error) {
      logger.error(
        `Failed to remove user ${targetUser.id} from ticket ${ticket.id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.reply({
        embeds: [errorEmbed("Error", "Failed to remove the user. Please check bot permissions.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
