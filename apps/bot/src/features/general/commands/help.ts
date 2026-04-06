import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { ExtendedClient } from "../../../shared/client/ExtendedClient.js";
import type { Command } from "@fluxcore/types";
import { infoEmbed } from "@fluxcore/utils";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows all available commands"),
  category: "General",
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as ExtendedClient;

    const categories = new Map<string, Command[]>();
    for (const cmd of client.commands.values()) {
      const cat = cmd.category ?? "Uncategorized";
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(cmd);
    }

    const embed = infoEmbed("Commands");

    for (const [category, cmds] of categories) {
      const lines = cmds.map((c) => {
        const cooldownStr = c.cooldown ? ` (${c.cooldown}s cooldown)` : "";
        return `\`/${c.data.name}\` — ${c.data.description}${cooldownStr}`;
      });
      embed.addFields({ name: category, value: lines.join("\n") });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
