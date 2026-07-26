import { EmbedBuilder, type GuildMember } from "discord.js";
import type { EmbedConfig } from "./types.js";
import { WELCOME_VARIABLES } from "./constants.js";

export function replaceWelcomeVariables(text: string, member: GuildMember): string {
  let result = text;
  for (const [variable, resolver] of Object.entries(WELCOME_VARIABLES)) {
    if (result.includes(variable)) {
      result = result.replaceAll(variable, resolver(member));
    }
  }
  return result;
}

export function buildWelcomeEmbed(embedConfig: EmbedConfig, member: GuildMember): EmbedBuilder {
  const embed = new EmbedBuilder();

  if (embedConfig.title) {
    embed.setTitle(replaceWelcomeVariables(embedConfig.title, member));
  }

  if (embedConfig.description) {
    embed.setDescription(replaceWelcomeVariables(embedConfig.description, member));
  }

  if (embedConfig.color !== undefined) {
    embed.setColor(embedConfig.color);
  }

  if (embedConfig.thumbnail) {
    const url = replaceWelcomeVariables(embedConfig.thumbnail, member);
    if (url) embed.setThumbnail(url);
  }

  if (embedConfig.image) {
    const url = replaceWelcomeVariables(embedConfig.image, member);
    if (url) embed.setImage(url);
  }

  if (embedConfig.footer) {
    embed.setFooter({ text: replaceWelcomeVariables(embedConfig.footer, member) });
  }

  if (embedConfig.fields && embedConfig.fields.length > 0) {
    for (const field of embedConfig.fields) {
      embed.addFields({
        name: replaceWelcomeVariables(field.name, member),
        value: replaceWelcomeVariables(field.value, member),
        inline: field.inline ?? false,
      });
    }
  }

  embed.setTimestamp();

  return embed;
}
