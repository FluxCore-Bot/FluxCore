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
    .setName("ticket-add")
    .setDescription("Add a user to the current ticket")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to add to the ticket")
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

    try {
      const channel = interaction.channel as TextChannel;
      await channel.permissionOverwrites.create(targetUser.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      await interaction.reply({
        embeds: [
          infoEmbed(
            "User Added",
            `<@${targetUser.id}> has been added to this ticket.`,
          ),
        ],
      });
    } catch (error) {
      logger.error(
        `Failed to add user ${targetUser.id} to ticket ${ticket.id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.reply({
        embeds: [errorEmbed("Error", "Failed to add the user. Please check bot permissions.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
