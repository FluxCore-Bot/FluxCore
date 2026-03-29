import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbed,
} from "discord.js";
import type { TicketPanel } from "./types.js";
import { TICKET_BUTTON_PREFIX, TICKET_CLAIM_ID, TICKET_CLOSE_ID } from "./constants.js";

export function buildPanelComponents(
  panel: TicketPanel,
): ActionRowBuilder<ButtonBuilder>[] {
  const categories = panel.categories;
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const button = new ButtonBuilder()
      .setCustomId(`${TICKET_BUTTON_PREFIX}${panel.id}_${cat.name}`)
      .setLabel(cat.label)
      .setStyle(ButtonStyle.Primary);

    if (cat.emoji) {
      button.setEmoji(cat.emoji);
    }

    currentRow.addComponents(button);

    // Max 5 buttons per row
    if ((i + 1) % 5 === 0 && i < categories.length - 1) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
  }

  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

export function buildPanelEmbed(panel: TicketPanel): EmbedBuilder {
  let embedData: Partial<APIEmbed>;
  try {
    embedData = JSON.parse(panel.embed) as Partial<APIEmbed>;
  } catch {
    embedData = {};
  }

  const embed = new EmbedBuilder();

  embed.setTitle(embedData.title ?? panel.name);
  embed.setDescription(
    embedData.description ?? "Click a button below to open a ticket.",
  );
  embed.setColor(embedData.color ?? 0xa3a6ff);

  if (embedData.footer) {
    embed.setFooter(embedData.footer);
  }

  return embed;
}

export function buildTicketWelcomeEmbed(
  userId: string,
  categoryName: string | null,
  formResponses: Record<string, string>,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`Ticket${categoryName ? ` -- ${categoryName}` : ""}`)
    .setDescription(
      `Welcome <@${userId}>! Staff will be with you shortly.\n\nUse the buttons below to manage this ticket.`,
    )
    .setColor(0xa3a6ff)
    .setTimestamp();

  // Add form responses as fields
  const entries = Object.entries(formResponses);
  if (entries.length > 0) {
    for (const [question, answer] of entries) {
      embed.addFields({ name: question, value: answer || "N/A", inline: false });
    }
  }

  return embed;
}

export function buildTicketActionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET_CLAIM_ID)
      .setLabel("Claim")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🎫"),
    new ButtonBuilder()
      .setCustomId(TICKET_CLOSE_ID)
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒"),
  );
}
