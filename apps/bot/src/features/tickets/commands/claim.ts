import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { infoEmbed, errorEmbed, logger } from "@fluxcore/utils";
import { getTicketByChannel, claimTicket } from "@fluxcore/systems/tickets/persistence";
import { getTicketSettings } from "@fluxcore/systems/tickets/config";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-claim")
    .setDescription("Claim the current ticket"),
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
        embeds: [errorEmbed("Error", "This ticket is already closed.")],
        ephemeral: true,
      });
      return;
    }

    if (ticket.claimedBy) {
      await interaction.reply({
        embeds: [errorEmbed("Error", `This ticket is already claimed by <@${ticket.claimedBy}>.`)],
        ephemeral: true,
      });
      return;
    }

    // Check if user is staff
    const settings = await getTicketSettings(guildId);
    const member = interaction.member;
    const memberRoles = member && "cache" in (member.roles ?? {})
      ? (member.roles as { cache: Map<string, unknown> }).cache
      : null;

    const isStaff = settings.staffRoleIds.length === 0 ||
      settings.staffRoleIds.some((roleId) => memberRoles?.has(roleId));

    if (!isStaff) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "You do not have permission to claim tickets.")],
        ephemeral: true,
      });
      return;
    }

    try {
      await claimTicket(ticket.id, interaction.user.id);

      await interaction.reply({
        embeds: [
          infoEmbed(
            "Ticket Claimed",
            `<@${interaction.user.id}> has claimed this ticket.`,
          ),
        ],
      });
    } catch (error) {
      logger.error(
        `Failed to claim ticket ${ticket.id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.reply({
        embeds: [errorEmbed("Error", "Failed to claim the ticket. Please try again.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
