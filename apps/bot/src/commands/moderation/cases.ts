import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ComponentType,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import {
  errorEmbed,
  checkPermissions,
} from "@fluxcore/utils";
import { getModCases } from "@fluxcore/systems/moderation/persistence";
import { CASES_PER_PAGE } from "@fluxcore/systems/moderation/constants";

function buildCasesEmbed(
  cases: { id: number; action: string; reason: string | null; createdAt: Date }[],
  total: number,
  page: number,
  targetId: string,
): EmbedBuilder {
  const totalPages = Math.ceil(total / CASES_PER_PAGE);
  const lines = cases.map(
    (c) =>
      `**#${c.id}** \`${c.action}\` — ${c.reason ?? "No reason"} (<t:${Math.floor(c.createdAt.getTime() / 1000)}:R>)`,
  );

  return new EmbedBuilder()
    .setTitle(`Cases for <@${targetId}>`)
    .setDescription(lines.join("\n") || "No cases found.")
    .setColor(0xa3a6ff)
    .setFooter({ text: `Page ${page}/${totalPages} | ${total} total cases` });
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("cases")
    .setDescription("List moderation cases for a user")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to look up")
        .setRequired(true),
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

    const target = interaction.options.getUser("user", true);
    let page = 1;

    const { cases, total } = await getModCases(interaction.guildId!, {
      targetId: target.id,
      page,
    });

    if (total === 0) {
      await interaction.reply({
        embeds: [errorEmbed("No Cases", `No moderation cases found for **${target.displayName}**.`)],
        ephemeral: true,
      });
      return;
    }

    const totalPages = Math.ceil(total / CASES_PER_PAGE);
    const embed = buildCasesEmbed(cases, total, page, target.id);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("cases_prev")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("cases_next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalPages <= 1),
    );

    const reply = await interaction.reply({
      embeds: [embed],
      components: totalPages > 1 ? [row] : [],
      fetchReply: true,
    });

    if (totalPages <= 1) return;

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "cases_next") page++;
      else if (i.customId === "cases_prev") page--;

      const result = await getModCases(interaction.guildId!, {
        targetId: target.id,
        page,
      });

      const newEmbed = buildCasesEmbed(result.cases, result.total, page, target.id);
      const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("cases_prev")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page <= 1),
        new ButtonBuilder()
          .setCustomId("cases_next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages),
      );

      await i.update({ embeds: [newEmbed], components: [newRow] });
    });

    collector.on("end", async () => {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("cases_prev")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("cases_next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      );
      await interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  },
};

export default command;
