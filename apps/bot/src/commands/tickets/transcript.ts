import {
  SlashCommandBuilder,
  AttachmentBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { infoEmbed, errorEmbed, logger } from "@fluxcore/utils";
import { getTicketByChannel } from "@fluxcore/systems/tickets/persistence";
import { buildTranscriptHtml } from "@fluxcore/systems/tickets/transcript";
import { TRANSCRIPT_FETCH_LIMIT } from "@fluxcore/systems/tickets/constants";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-transcript")
    .setDescription("Generate and post a transcript of the current ticket"),
  category: "Tickets",
  cooldown: 10,
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

    await interaction.deferReply();

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

      await interaction.editReply({
        embeds: [
          infoEmbed(
            "Ticket Transcript",
            `Transcript for ticket #${ticket.id} (${messages.size} messages)`,
          ),
        ],
        files: [attachment],
      });
    } catch (error) {
      logger.error(
        `Failed to generate transcript for ticket in channel ${interaction.channelId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [errorEmbed("Error", "Failed to generate transcript. Please try again.")],
      });
    }
  },
};

export default command;
