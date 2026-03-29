import {
  SlashCommandBuilder,
  AttachmentBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { infoEmbed, errorEmbed, logger } from "@fluxcore/utils";
import { getTicketByChannel, closeTicket } from "@fluxcore/systems/tickets/persistence";
import { getTicketSettings } from "@fluxcore/systems/tickets/config";
import { buildTranscriptHtml } from "@fluxcore/systems/tickets/transcript";
import { TRANSCRIPT_FETCH_LIMIT } from "@fluxcore/systems/tickets/constants";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-close")
    .setDescription("Close the current ticket")
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for closing the ticket")
        .setRequired(false),
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
        embeds: [errorEmbed("Error", "This ticket is already closed.")],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const reason = interaction.options.getString("reason") ?? undefined;
      const settings = await getTicketSettings(guildId);

      // Generate transcript
      let transcriptUrl: string | undefined;
      try {
        const channel = interaction.channel as TextChannel;
        const messages = await channel.messages.fetch({ limit: TRANSCRIPT_FETCH_LIMIT });
        const transcriptMessages = messages.reverse().map((m) => ({
          author: m.author.displayName ?? m.author.username,
          authorId: m.author.id,
          avatarUrl: m.author.displayAvatarURL({ size: 64 }),
          content: m.content,
          timestamp: m.createdAt,
          attachments: m.attachments.map((a) => a.url),
        }));

        const html = buildTranscriptHtml(
          ticket,
          transcriptMessages,
          interaction.guild?.name ?? "Unknown",
        );

        const attachment = new AttachmentBuilder(Buffer.from(html), {
          name: `transcript-${ticket.id}.html`,
        });

        if (settings.transcriptChannelId) {
          const transcriptChannel = interaction.guild?.channels.cache.get(
            settings.transcriptChannelId,
          );
          if (transcriptChannel?.isTextBased() && "send" in transcriptChannel) {
            const msg = await transcriptChannel.send({
              embeds: [
                infoEmbed(
                  "Ticket Transcript",
                  `Ticket #${ticket.id} by <@${ticket.userId}>\nClosed by <@${interaction.user.id}>${reason ? `\nReason: ${reason}` : ""}`,
                ),
              ],
              files: [attachment],
            });
            transcriptUrl = msg.url;
          }
        }
      } catch (err) {
        logger.error(
          `Failed to generate transcript for ticket ${ticket.id}`,
          err instanceof Error ? err : new Error(String(err)),
        );
      }

      await closeTicket(ticket.id, reason, transcriptUrl);

      await interaction.editReply({
        embeds: [
          infoEmbed(
            "Ticket Closed",
            `This ticket has been closed by <@${interaction.user.id}>.${reason ? `\n**Reason:** ${reason}` : ""}${transcriptUrl ? `\n[View Transcript](${transcriptUrl})` : ""}`,
          ),
        ],
      });

      // Delete the channel after a short delay
      setTimeout(async () => {
        try {
          const channel = interaction.channel;
          if (channel && "delete" in channel) {
            await channel.delete();
          }
        } catch (err) {
          logger.error(
            `Failed to delete ticket channel ${ticket.channelId}`,
            err instanceof Error ? err : new Error(String(err)),
          );
        }
      }, 5000);
    } catch (error) {
      logger.error(
        `Failed to close ticket in channel ${interaction.channelId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [errorEmbed("Error", "Failed to close the ticket. Please try again.")],
      });
    }
  },
};

export default command;
