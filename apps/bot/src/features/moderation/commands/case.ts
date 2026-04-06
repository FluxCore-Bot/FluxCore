import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import {
  errorEmbed,
  checkPermissions,
} from "@fluxcore/utils";
import { getModCaseById } from "@fluxcore/systems/moderation/persistence";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("case")
    .setDescription("View a moderation case by ID")
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription("The case ID to look up")
        .setRequired(true)
        .setMinValue(1),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  category: "Moderation",
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ]))
    ) {
      return;
    }

    const caseId = interaction.options.getInteger("id", true);
    const modCase = await getModCaseById(caseId, interaction.guildId!);

    if (!modCase) {
      await interaction.reply({
        embeds: [errorEmbed("Not Found", `Case **#${caseId}** was not found.`)],
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Case #${modCase.id}`)
      .setColor(0xa3a6ff)
      .addFields(
        { name: "Action", value: modCase.action, inline: true },
        { name: "Target", value: `<@${modCase.targetId}>`, inline: true },
        { name: "Moderator", value: `<@${modCase.moderatorId}>`, inline: true },
        { name: "Reason", value: modCase.reason ?? "No reason provided" },
        { name: "Active", value: modCase.active ? "Yes" : "No", inline: true },
        { name: "Created", value: `<t:${Math.floor(modCase.createdAt.getTime() / 1000)}:f>`, inline: true },
      );

    if (modCase.duration) {
      embed.addFields({ name: "Duration", value: `${modCase.duration}s`, inline: true });
    }
    if (modCase.expiresAt) {
      embed.addFields({ name: "Expires", value: `<t:${Math.floor(modCase.expiresAt.getTime() / 1000)}:R>`, inline: true });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
