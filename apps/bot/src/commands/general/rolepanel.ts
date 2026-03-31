import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
  type TextChannel,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { successEmbed, errorEmbed, checkPermissions, logger } from "@fluxcore/utils";
import { getRolePanels, getRolePanelByName, updatePanelMessageId } from "@fluxcore/systems/rolePanel/persistence";
import { buildButtonComponents, buildDropdownComponent, buildPanelEmbed } from "@fluxcore/systems/rolePanel/builder";

export async function handleRolePanelAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused();
  const guildId = interaction.guildId;
  if (!guildId) return;

  try {
    const panels = await getRolePanels(guildId);
    const filtered = panels
      .filter((p) => p.name.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25)
      .map((p) => ({
        name: `${p.name} (${p.type}, ${p.roles.length} roles)`,
        value: p.name,
      }));

    await interaction.respond(filtered);
  } catch {
    await interaction.respond([]);
  }
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rolepanel")
    .setDescription("Manage role panels")
    .addSubcommand((sub) =>
      sub
        .setName("send")
        .setDescription("Send a role panel to a channel")
        .addStringOption((option) =>
          option
            .setName("panel_name")
            .setDescription("Name of the panel to send")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel to send the panel to (overrides default)")
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  category: "General",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [PermissionFlagsBits.ManageRoles]))
    ) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "send") {
      await handleSend(interaction);
    }
  },
};

async function handleSend(interaction: ChatInputCommandInteraction): Promise<void> {
  const panelName = interaction.options.getString("panel_name", true);
  const channelOverride = interaction.options.getChannel("channel") as TextChannel | null;
  const guildId = interaction.guildId!;

  await interaction.deferReply({ ephemeral: true });

  try {
    const panel = await getRolePanelByName(guildId, panelName);
    if (!panel) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Panel Not Found",
            `No panel named **${panelName}** found. Create one in the dashboard first.`,
          ),
        ],
      });
      return;
    }

    if (panel.roles.length === 0) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "No Roles",
            "This panel has no roles configured. Add roles in the dashboard first.",
          ),
        ],
      });
      return;
    }

    const targetChannelId = channelOverride?.id ?? panel.channelId;
    const channel = interaction.guild!.channels.cache.get(targetChannelId) as TextChannel | undefined;

    if (!channel) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Channel Not Found",
            "The target channel could not be found. Make sure the bot has access to it.",
          ),
        ],
      });
      return;
    }

    const embed = buildPanelEmbed(panel);
    const components: (ReturnType<typeof buildButtonComponents>[number] | ReturnType<typeof buildDropdownComponent>)[] = [];

    if (panel.type === "button") {
      components.push(...buildButtonComponents(panel));
    } else if (panel.type === "dropdown") {
      components.push(buildDropdownComponent(panel));
    }

    const sentMessage = await channel.send({
      embeds: [embed],
      components: panel.type !== "reaction" ? components : [],
    });

    await updatePanelMessageId(panel.id, sentMessage.id);

    // For reaction panels, add emoji reactions to the message
    if (panel.type === "reaction") {
      for (const entry of panel.roles) {
        if (entry.emoji) {
          try {
            await sentMessage.react(entry.emoji);
          } catch {
            logger.warn(
              `Failed to add reaction ${entry.emoji} for panel ${panel.id}`,
            );
          }
        }
      }
    }

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Panel Sent",
          `Role panel **${panel.name}** has been sent to <#${targetChannelId}>.`,
        ),
      ],
    });
  } catch (error) {
    logger.error(
      `Failed to send role panel "${panelName}" in guild ${guildId}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    await interaction.editReply({
      embeds: [
        errorEmbed(
          "Send Failed",
          "Failed to send the role panel. Please check bot permissions and try again.",
        ),
      ],
    });
  }
}

export default command;
