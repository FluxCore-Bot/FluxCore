import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { infoEmbed } from "@fluxcore/utils";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Shows the bot's latency"),
  category: "General",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({
      embeds: [infoEmbed("Pinging...", "Measuring latency...")],
      fetchReply: true,
    });

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const ws = interaction.client.ws.ping;

    await interaction.editReply({
      embeds: [
        infoEmbed("Pong!").addFields(
          { name: "Roundtrip", value: `${roundtrip}ms`, inline: true },
          { name: "Websocket", value: `${ws}ms`, inline: true },
        ),
      ],
    });
  },
};

export default command;
