import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type MessageActionRowComponentBuilder,
  ComponentType,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import {
  errorEmbed,
  checkPermissions,
} from "@fluxcore/utils";
import { getWarnings } from "@fluxcore/systems/warnings/persistence";
import { WARNINGS_PER_PAGE } from "@fluxcore/systems/warnings/constants";

function buildWarningsEmbed(
  warnings: { id: number; moderatorId: string; reason: string; createdAt: Date }[],
  total: number,
  page: number,
  userId: string,
): EmbedBuilder {
  const totalPages = Math.max(1, Math.ceil(total / WARNINGS_PER_PAGE));
  const embed = new EmbedBuilder()
    .setTitle(`Warnings for <@${userId}>`)
    .setColor(0xffa500)
    .setFooter({ text: `Page ${page}/${totalPages} | ${total} total warning(s)` });

  if (warnings.length === 0) {
    embed.setDescription("No warnings found.");
  } else {
    const lines = warnings.map(
      (w) =>
        `**#${w.id}** | <@${w.moderatorId}> | ${w.reason} | <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`,
    );
    embed.setDescription(lines.join("\n"));
  }

  return embed;
}

function buildPaginationRow(page: number, totalPages: number): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("warnings_prev")
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId("warnings_next")
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
  );
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View warning history for a member")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to view warnings for")
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

    const user = interaction.options.getUser("user", true);
    let page = 1;

    await interaction.deferReply();

    const { warnings, total } = await getWarnings(
      interaction.guildId!,
      user.id,
      page,
      WARNINGS_PER_PAGE,
    );

    const totalPages = Math.max(1, Math.ceil(total / WARNINGS_PER_PAGE));
    const embed = buildWarningsEmbed(warnings, total, page, user.id);

    const message = await interaction.editReply({
      embeds: [embed],
      components: totalPages > 1 ? [buildPaginationRow(page, totalPages)] : [],
    });

    if (totalPages <= 1) return;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.customId === "warnings_prev") {
        page = Math.max(1, page - 1);
      } else if (buttonInteraction.customId === "warnings_next") {
        page = Math.min(totalPages, page + 1);
      }

      const result = await getWarnings(
        interaction.guildId!,
        user.id,
        page,
        WARNINGS_PER_PAGE,
      );

      const updatedEmbed = buildWarningsEmbed(result.warnings, result.total, page, user.id);
      const updatedTotalPages = Math.max(1, Math.ceil(result.total / WARNINGS_PER_PAGE));

      await buttonInteraction.update({
        embeds: [updatedEmbed],
        components: [buildPaginationRow(page, updatedTotalPages)],
      });
    });

    collector.on("end", async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch {
        // Message may have been deleted
      }
    });
  },
};

export default command;
