import { EmbedBuilder, type ColorResolvable } from "discord.js";

const COLORS = {
  success: 0x57f287 as ColorResolvable,
  error: 0xed4245 as ColorResolvable,
  info: 0x5865f2 as ColorResolvable,
  warn: 0xfee75c as ColorResolvable,
};

export function successEmbed(
  title: string,
  description?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(title)
    .setTimestamp();
  if (description) embed.setDescription(description);
  return embed;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle(title)
    .setTimestamp();
  if (description) embed.setDescription(description);
  return embed;
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(title)
    .setTimestamp();
  if (description) embed.setDescription(description);
  return embed;
}

export function warnEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.warn)
    .setTitle(title)
    .setTimestamp();
  if (description) embed.setDescription(description);
  return embed;
}
