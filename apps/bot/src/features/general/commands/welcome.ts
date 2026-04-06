import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { successEmbed, errorEmbed, checkPermissions, logger } from "@fluxcore/utils";
import { getWelcomeConfig } from "@fluxcore/systems/welcome/config";
import { buildWelcomeEmbed } from "@fluxcore/systems/welcome/builder";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Welcome system commands")
    .addSubcommand((sub) =>
      sub.setName("test").setDescription("Send a test welcome message using the current config"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  category: "General",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [PermissionFlagsBits.ManageGuild]))
    ) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "test") {
      await handleTest(interaction);
    }
  },
};

async function handleTest(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const config = await getWelcomeConfig(interaction.guildId!);

    if (!config || !config.welcomeEnabled) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Not Configured",
            "Welcome messages are not enabled. Configure them from the dashboard.",
          ),
        ],
      });
      return;
    }

    if (!config.welcomeChannelId) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "No Channel",
            "No welcome channel has been configured. Set one from the dashboard.",
          ),
        ],
      });
      return;
    }

    const channel = interaction.guild!.channels.cache.get(config.welcomeChannelId);
    if (!channel?.isTextBased()) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Invalid Channel",
            "The configured welcome channel no longer exists or is not a text channel.",
          ),
        ],
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const embed = buildWelcomeEmbed(config.welcomeMessage, member);
    await channel.send({ embeds: [embed] });

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Test Sent",
          `A test welcome message has been sent to <#${config.welcomeChannelId}>.`,
        ),
      ],
    });
  } catch (error) {
    logger.error(
      `Failed to send test welcome message in guild ${interaction.guildId}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    await interaction.editReply({
      embeds: [
        errorEmbed(
          "Test Failed",
          "Failed to send the test welcome message. Please try again later.",
        ),
      ],
    });
  }
}

export default command;
