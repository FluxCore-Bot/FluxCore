import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { Giveaway } from "./types.js";
import { GIVEAWAY_BUTTON_PREFIX } from "./constants.js";

/**
 * Build the active giveaway embed.
 */
export function buildGiveawayEmbed(giveaway: Giveaway): EmbedBuilder {
  const lines: string[] = [
    `**Prize:** ${giveaway.prize}`,
    `**Winners:** ${giveaway.winners}`,
    `**Hosted by:** <@${giveaway.hostId}>`,
  ];

  if (giveaway.requiredRoleIds.length > 0) {
    const roleMentions = giveaway.requiredRoleIds.map((id) => `<@&${id}>`).join(", ");
    lines.push(`**Required Role:** ${roleMentions}`);
  }

  const unixTimestamp = Math.floor(giveaway.endsAt.getTime() / 1000);
  lines.push(`**Ends:** <t:${unixTimestamp}:R>`);
  lines.push("");
  lines.push(`Click the button below to enter!`);
  lines.push(`**Entries:** ${giveaway.entrantIds.length}`);

  return new EmbedBuilder()
    .setTitle("\uD83C\uDF89 GIVEAWAY \uD83C\uDF89")
    .setDescription(lines.join("\n"))
    .setColor(0xa3a6ff)
    .setTimestamp(giveaway.endsAt);
}

/**
 * Build the ended giveaway embed.
 */
export function buildEndedGiveawayEmbed(giveaway: Giveaway): EmbedBuilder {
  const winnerMentions =
    giveaway.winnerIds.length > 0
      ? giveaway.winnerIds.map((id) => `<@${id}>`).join(", ")
      : "No valid entries";

  const lines: string[] = [
    `**Prize:** ${giveaway.prize}`,
    `**Winners:** ${winnerMentions}`,
    `**Entries:** ${giveaway.entrantIds.length}`,
  ];

  return new EmbedBuilder()
    .setTitle("\uD83C\uDF89 GIVEAWAY ENDED \uD83C\uDF89")
    .setDescription(lines.join("\n"))
    .setColor(0x3a3a4a)
    .setTimestamp(giveaway.endsAt);
}

/**
 * Build the enter button row for an active giveaway.
 */
export function buildGiveawayButton(giveawayId: number): ActionRowBuilder<ButtonBuilder> {
  const button = new ButtonBuilder()
    .setCustomId(`${GIVEAWAY_BUTTON_PREFIX}${giveawayId}`)
    .setLabel("Enter Giveaway")
    .setEmoji("\uD83C\uDF89")
    .setStyle(ButtonStyle.Primary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}
