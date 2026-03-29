import { EmbedBuilder, type GuildMember } from "discord.js";
import type { EmbedConfig } from "./types.js";
import { WELCOME_VARIABLES } from "./constants.js";

function replaceVariables(text: string, member: GuildMember): string {
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
    embed.setTitle(replaceVariables(embedConfig.title, member));
  }

  if (embedConfig.description) {
    embed.setDescription(replaceVariables(embedConfig.description, member));
  }

  if (embedConfig.color !== undefined) {
    embed.setColor(embedConfig.color);
  }

  if (embedConfig.thumbnail) {
    const url = replaceVariables(embedConfig.thumbnail, member);
    if (url) embed.setThumbnail(url);
  }

  if (embedConfig.image) {
    const url = replaceVariables(embedConfig.image, member);
    if (url) embed.setImage(url);
  }

  if (embedConfig.footer) {
    embed.setFooter({ text: replaceVariables(embedConfig.footer, member) });
  }

  if (embedConfig.fields && embedConfig.fields.length > 0) {
    for (const field of embedConfig.fields) {
      embed.addFields({
        name: replaceVariables(field.name, member),
        value: replaceVariables(field.value, member),
        inline: field.inline ?? false,
      });
    }
  }

  embed.setTimestamp();

  return embed;
}
