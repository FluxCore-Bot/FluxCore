import type { ButtonInteraction, GuildMember } from "discord.js";
import { logger } from "@fluxcore/utils";
import { GIVEAWAY_BUTTON_PREFIX } from "@fluxcore/systems/giveaways/constants";
import { getGiveaway, addEntrant, removeEntrant } from "@fluxcore/systems/giveaways/persistence";
import { buildGiveawayEmbed } from "@fluxcore/systems/giveaways/embed";

export async function handleGiveawayButton(interaction: ButtonInteraction): Promise<void> {
  const giveawayId = parseInt(
    interaction.customId.slice(GIVEAWAY_BUTTON_PREFIX.length),
    10,
  );

  if (!Number.isFinite(giveawayId)) {
    await interaction.reply({
      content: "Invalid giveaway.",
      ephemeral: true,
    });
    return;
  }

  try {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: "This can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const giveaway = await getGiveaway(giveawayId, guildId);
    if (!giveaway) {
      await interaction.reply({
        content: "This giveaway no longer exists.",
        ephemeral: true,
      });
      return;
    }

    if (giveaway.ended) {
      await interaction.reply({
        content: "This giveaway has already ended.",
        ephemeral: true,
      });
      return;
    }

    // Check role requirements
    if (giveaway.requiredRoleIds.length > 0) {
      const member = interaction.member as GuildMember;
      const hasRequiredRole = giveaway.requiredRoleIds.some((roleId) =>
        member.roles.cache.has(roleId),
      );
      if (!hasRequiredRole) {
        const roleMentions = giveaway.requiredRoleIds.map((id) => `<@&${id}>`).join(", ");
        await interaction.reply({
          content: `You need one of these roles to enter: ${roleMentions}`,
          ephemeral: true,
        });
        return;
      }
    }

    const userId = interaction.user.id;
    const isAlreadyEntered = giveaway.entrantIds.includes(userId);

    let updated;
    if (isAlreadyEntered) {
      updated = await removeEntrant(giveawayId, userId);
      await interaction.reply({
        content: "\u274C You have left the giveaway.",
        ephemeral: true,
      });
    } else {
      updated = await addEntrant(giveawayId, userId);
      await interaction.reply({
        content: "\uD83C\uDF89 You have entered the giveaway! Click again to leave.",
        ephemeral: true,
      });
    }

    // Update entry count on the embed
    try {
      const embed = buildGiveawayEmbed(updated);
      await interaction.message.edit({ embeds: [embed] });
    } catch {
      // Message may not be editable
    }
  } catch (err) {
    logger.error(
      `Failed to handle giveaway button for giveaway ${giveawayId}`,
      err instanceof Error ? err : new Error(String(err)),
    );
    await interaction.reply({
      content: "Something went wrong. Please try again later.",
      ephemeral: true,
    });
  }
}
