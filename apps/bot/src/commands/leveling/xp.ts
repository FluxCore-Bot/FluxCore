import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { successEmbed, errorEmbed, checkPermissions, logger } from "@fluxcore/utils";
import { setXp, addXp } from "@fluxcore/systems/leveling/persistence";
import { checkAndGrantRewards } from "@fluxcore/systems/leveling/rewards";
import { levelFromXp } from "@fluxcore/systems/leveling/xp";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Manage user XP")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set a user's XP to an exact amount")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The target user").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("XP amount to set")
            .setMinValue(0)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add XP to a user")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The target user").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("XP amount to add")
            .setMinValue(1)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove XP from a user")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The target user").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("XP amount to remove")
            .setMinValue(1)
            .setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  category: "Leveling",
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await checkPermissions(interaction, [PermissionFlagsBits.ManageGuild]))) {
      return;
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "This command can only be used in a server.")],
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    await interaction.deferReply();

    try {
      let result;

      switch (subcommand) {
        case "set": {
          result = await setXp(guildId, targetUser.id, amount);
          break;
        }
        case "add": {
          result = await addXp(guildId, targetUser.id, amount);
          break;
        }
        case "remove": {
          // Remove XP by setting to current minus amount, minimum 0
          const { getUserLevel } = await import("@fluxcore/systems/leveling/persistence");
          const current = await getUserLevel(guildId, targetUser.id);
          const currentXp = current?.xp ?? 0;
          const newXp = Math.max(0, currentXp - amount);
          result = await setXp(guildId, targetUser.id, newXp);
          break;
        }
        default:
          await interaction.editReply({
            embeds: [errorEmbed("Error", "Unknown subcommand.")],
          });
          return;
      }

      const newLevel = levelFromXp(result.totalXp);

      // Check rewards after XP change
      if (interaction.guild) {
        await checkAndGrantRewards(interaction.guild, targetUser.id, newLevel);
      }

      const actionText =
        subcommand === "set"
          ? `Set **${targetUser.displayName}**'s XP to`
          : subcommand === "add"
            ? `Added ${amount.toLocaleString()} XP to **${targetUser.displayName}**. Total:`
            : `Removed ${amount.toLocaleString()} XP from **${targetUser.displayName}**. Total:`;

      await interaction.editReply({
        embeds: [
          successEmbed(
            "XP Updated",
            `${actionText} **${result.totalXp.toLocaleString()}** XP (Level ${newLevel})`,
          ),
        ],
      });
    } catch (error) {
      logger.error(
        `Failed to ${subcommand} XP for ${targetUser.id} in guild ${guildId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [errorEmbed("Error", "Failed to update XP. Please try again later.")],
      });
    }
  },
};

export default command;
