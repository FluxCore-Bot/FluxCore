import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { getMusicSettings } from "@fluxcore/systems/music/config";
import { successEmbed, errorEmbed } from "@fluxcore/utils";
import { requireSameVoiceChannel, requireDjOrPermission, requireQueue } from "../system/guards.js";
import { getQueue } from "../system/queue.js";
import { queueEmbed } from "../system/embeds.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("View or manage the music queue")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View the current queue")
        .addIntegerOption((opt) =>
          opt.setName("page").setDescription("Page number").setMinValue(1).setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a track from the queue")
        .addIntegerOption((opt) =>
          opt
            .setName("position")
            .setDescription("Position of the track to remove")
            .setRequired(true)
            .setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Clear the entire queue"),
    ),
  category: "Music",
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireQueue(interaction))) return;

    const sub = interaction.options.getSubcommand();
    const queue = getQueue(interaction.guildId!)!;

    if (sub === "view") {
      const page = interaction.options.getInteger("page") ?? 1;
      await interaction.reply({ embeds: [queueEmbed(queue, page)] });
      return;
    }

    if (!(await requireSameVoiceChannel(interaction))) return;
    if (!(await requireDjOrPermission(interaction, getMusicSettings(interaction.guildId!)))) return;

    if (sub === "remove") {
      const position = interaction.options.getInteger("position", true);
      const removed = queue.remove(position - 1);

      if (!removed) {
        await interaction.reply({
          embeds: [errorEmbed("Invalid Position", `No track at position **${position}**.`)],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [successEmbed("Removed", `Removed **${removed.title}** from the queue.`)],
      });
      return;
    }

    if (sub === "clear") {
      const count = queue.tracks.length;
      queue.clear();
      await interaction.reply({
        embeds: [successEmbed("Queue Cleared", `Removed **${count}** track(s) from the queue.`)],
      });
      return;
    }
  },
};

export default command;
