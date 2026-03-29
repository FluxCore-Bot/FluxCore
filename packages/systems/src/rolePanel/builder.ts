import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
} from "discord.js";
import type { RolePanel } from "./types.js";

export function buildButtonComponents(
  panel: RolePanel,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  for (const entry of panel.roles) {
    if (currentRow.components.length >= 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }

    const button = new ButtonBuilder()
      .setCustomId(`rp_${panel.id}_${entry.roleId}`)
      .setLabel(entry.label)
      .setStyle(entry.style ?? ButtonStyle.Secondary);

    if (entry.emoji) button.setEmoji(entry.emoji);
    currentRow.addComponents(button);
  }

  if (currentRow.components.length > 0) rows.push(currentRow);
  return rows;
}

export function buildDropdownComponent(
  panel: RolePanel,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`rpd_${panel.id}`)
    .setPlaceholder("Select roles...")
    .setMinValues(panel.minRoles ?? 0)
    .setMaxValues(panel.maxRoles ?? panel.roles.length)
    .addOptions(
      panel.roles.map((entry) => ({
        label: entry.label,
        value: entry.roleId,
        description: entry.description,
        emoji: entry.emoji ? { name: entry.emoji } : undefined,
      })),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

interface EmbedConfig {
  title?: string;
  description?: string;
  color?: number;
  footer?: string;
}

export function buildPanelEmbed(panel: RolePanel): EmbedBuilder {
  let embedConfig: EmbedConfig = {};
  try {
    embedConfig = JSON.parse(panel.embed) as EmbedConfig;
  } catch {
    // Use defaults
  }

  const embed = new EmbedBuilder();

  if (embedConfig.title) {
    embed.setTitle(embedConfig.title);
  } else {
    embed.setTitle(panel.name);
  }

  if (embedConfig.description) {
    embed.setDescription(embedConfig.description);
  } else {
    // Build a default description listing roles
    const roleList = panel.roles
      .map((r) => {
        const emoji = r.emoji ? `${r.emoji} ` : "";
        return `${emoji}${r.label}`;
      })
      .join("\n");
    embed.setDescription(roleList || "Select a role below.");
  }

  if (embedConfig.color) {
    embed.setColor(embedConfig.color);
  } else {
    embed.setColor(0xa3a6ff); // Primary accent color
  }

  if (embedConfig.footer) {
    embed.setFooter({ text: embedConfig.footer });
  }

  return embed;
}
