import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import {
  successEmbed,
  errorEmbed,
  checkPermissions,
  checkBotPermissions,
  logger,
} from "@fluxcore/utils";
import { lockdownGuild, liftLockdown } from "@fluxcore/systems/antiraid/actions";
import { isLockdownActive } from "@fluxcore/systems/antiraid/tracker";
import { createRaidEvent } from "@fluxcore/systems/antiraid/persistence";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Manage server lockdown mode")
    .addSubcommand((sub) =>
      sub
        .setName("activate")
        .setDescription("Lock all channels to prevent @everyone from sending messages")
        .addStringOption((option) =>
          option.setName("reason").setDescription("Reason for lockdown"),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("lift").setDescription("Lift an active server lockdown"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  category: "Admin",
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [PermissionFlagsBits.ManageGuild])) ||
      !(await checkBotPermissions(interaction, [PermissionFlagsBits.ManageChannels]))
    ) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "activate") {
      if (isLockdownActive(interaction.guildId!)) {
        await interaction.reply({
          embeds: [errorEmbed("Already Locked", "The server is already in lockdown mode. Use `/lockdown lift` to remove it.")],
          ephemeral: true,
        });
        return;
      }

      const reason = interaction.options.getString("reason") ?? "Manual lockdown";
      await interaction.deferReply();

      const lockedCount = await lockdownGuild(interaction.guild!, reason);

      await createRaidEvent(interaction.guildId!, "lockdown", {
        executorId: interaction.user.id,
        action: "activate",
        reason,
        count: lockedCount,
      });

      logger.info(`Lockdown activated in guild ${interaction.guildId} by ${interaction.user.id} (${lockedCount} channels)`);

      await interaction.editReply({
        embeds: [
          successEmbed(
            "Server Locked Down",
            `Locked **${lockedCount}** channels. Members can no longer send messages.\n**Reason:** ${reason}\n\nUse \`/lockdown lift\` to restore access.`,
          ),
        ],
      });
    } else if (subcommand === "lift") {
      if (!isLockdownActive(interaction.guildId!)) {
        await interaction.reply({
          embeds: [errorEmbed("Not Locked", "The server is not currently in lockdown mode.")],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      const unlockedCount = await liftLockdown(interaction.guild!);

      await createRaidEvent(interaction.guildId!, "lockdown", {
        executorId: interaction.user.id,
        action: "lift",
        count: unlockedCount,
      });

      logger.info(`Lockdown lifted in guild ${interaction.guildId} by ${interaction.user.id} (${unlockedCount} channels)`);

      await interaction.editReply({
        embeds: [
          successEmbed(
            "Lockdown Lifted",
            `Unlocked **${unlockedCount}** channels. Normal messaging has been restored.`,
          ),
        ],
      });
    }
  },
};

export default command;
