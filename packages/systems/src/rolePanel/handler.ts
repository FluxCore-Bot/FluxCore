import type {
  ButtonInteraction,
  StringSelectMenuInteraction,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  GuildMember,
} from "discord.js";
import { getRolePanel, getRolePanelByMessageId } from "./persistence.js";
import { logger } from "@fluxcore/utils";

export async function handleRolePanelButton(
  interaction: ButtonInteraction,
  panelId: number,
  roleId: string,
): Promise<void> {
  const panel = await getRolePanel(panelId);
  if (!panel) {
    await interaction.reply({
      content: "This role panel no longer exists.",
      ephemeral: true,
    });
    return;
  }

  // Verify this role is still part of the panel
  const entry = panel.roles.find((r) => r.roleId === roleId);
  if (!entry) {
    await interaction.reply({
      content: "This role is no longer available in this panel.",
      ephemeral: true,
    });
    return;
  }

  const member = interaction.member as GuildMember;
  const hasRole = member.roles.cache.has(roleId);

  try {
    if (panel.mode === "verify") {
      if (hasRole) {
        await interaction.reply({
          content: "You already have this role.",
          ephemeral: true,
        });
        return;
      }
      await member.roles.add(roleId);
      await interaction.reply({
        content: `Added <@&${roleId}>`,
        ephemeral: true,
      });
      return;
    }

    if (panel.mode === "unique" && !hasRole) {
      // Remove all other roles in this panel first
      const otherRoleIds = panel.roles
        .filter((r) => r.roleId !== roleId)
        .map((r) => r.roleId);
      const toRemove = otherRoleIds.filter((id) => member.roles.cache.has(id));
      if (toRemove.length > 0) await member.roles.remove(toRemove);
    }

    if (hasRole) {
      await member.roles.remove(roleId);
      await interaction.reply({
        content: `Removed <@&${roleId}>`,
        ephemeral: true,
      });
    } else {
      await member.roles.add(roleId);
      await interaction.reply({
        content: `Added <@&${roleId}>`,
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error(
      `Failed to manage role ${roleId} for panel ${panelId}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    await interaction.reply({
      content: "Failed to update your roles. The bot may not have permission to manage this role.",
      ephemeral: true,
    });
  }
}

export async function handleRolePanelDropdown(
  interaction: StringSelectMenuInteraction,
  panelId: number,
  selectedValues: string[],
): Promise<void> {
  const panel = await getRolePanel(panelId);
  if (!panel) {
    await interaction.reply({
      content: "This role panel no longer exists.",
      ephemeral: true,
    });
    return;
  }

  const member = interaction.member as GuildMember;
  const panelRoleIds = panel.roles.map((r) => r.roleId);

  try {
    if (panel.mode === "verify") {
      // Only add, never remove
      const toAdd = selectedValues.filter((id) => !member.roles.cache.has(id));
      if (toAdd.length > 0) await member.roles.add(toAdd);

      const addedMentions = toAdd.map((id) => `<@&${id}>`).join(", ");
      await interaction.reply({
        content: toAdd.length > 0
          ? `Added ${addedMentions}`
          : "You already have the selected roles.",
        ephemeral: true,
      });
      return;
    }

    if (panel.mode === "unique") {
      // Remove all panel roles first, then add selected
      const toRemove = panelRoleIds.filter(
        (id) => member.roles.cache.has(id) && !selectedValues.includes(id),
      );
      const toAdd = selectedValues.filter((id) => !member.roles.cache.has(id));

      if (toRemove.length > 0) await member.roles.remove(toRemove);
      if (toAdd.length > 0) await member.roles.add(toAdd);

      const changes: string[] = [];
      if (toAdd.length > 0) changes.push(`Added ${toAdd.map((id) => `<@&${id}>`).join(", ")}`);
      if (toRemove.length > 0) changes.push(`Removed ${toRemove.map((id) => `<@&${id}>`).join(", ")}`);

      await interaction.reply({
        content: changes.length > 0 ? changes.join("\n") : "No changes made.",
        ephemeral: true,
      });
      return;
    }

    // Toggle mode: add selected, remove unselected panel roles
    const toRemove = panelRoleIds.filter(
      (id) => member.roles.cache.has(id) && !selectedValues.includes(id),
    );
    const toAdd = selectedValues.filter((id) => !member.roles.cache.has(id));

    if (toRemove.length > 0) await member.roles.remove(toRemove);
    if (toAdd.length > 0) await member.roles.add(toAdd);

    const changes: string[] = [];
    if (toAdd.length > 0) changes.push(`Added ${toAdd.map((id) => `<@&${id}>`).join(", ")}`);
    if (toRemove.length > 0) changes.push(`Removed ${toRemove.map((id) => `<@&${id}>`).join(", ")}`);

    await interaction.reply({
      content: changes.length > 0 ? changes.join("\n") : "No changes made.",
      ephemeral: true,
    });
  } catch (error) {
    logger.error(
      `Failed to manage dropdown roles for panel ${panelId}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    await interaction.reply({
      content: "Failed to update your roles. The bot may not have permission to manage these roles.",
      ephemeral: true,
    });
  }
}

export async function handleRolePanelReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  added: boolean,
): Promise<void> {
  if (user.bot) return;

  const message = reaction.message;
  if (!message.guildId) return;

  const panel = await getRolePanelByMessageId(message.guildId, message.id);
  if (!panel || panel.type !== "reaction") return;

  const emojiIdentifier = reaction.emoji.id ?? reaction.emoji.name;
  const entry = panel.roles.find((r) => r.emoji === emojiIdentifier);
  if (!entry) return;

  const guild = message.guild ?? (await reaction.client.guilds.fetch(message.guildId));
  const member = await guild.members.fetch(user.id);

  try {
    if (added) {
      if (panel.mode === "unique") {
        // Remove all other roles in this panel
        const otherRoleIds = panel.roles
          .filter((r) => r.roleId !== entry.roleId)
          .map((r) => r.roleId);
        const toRemove = otherRoleIds.filter((id) => member.roles.cache.has(id));
        if (toRemove.length > 0) {
          await member.roles.remove(toRemove);
          // Also remove their reactions for other roles
          for (const otherEntry of panel.roles) {
            if (otherEntry.roleId === entry.roleId) continue;
            const emoji = otherEntry.emoji;
            if (!emoji) continue;
            const msgReaction = message.reactions.cache.find(
              (r) => (r.emoji.id ?? r.emoji.name) === emoji,
            );
            if (msgReaction) {
              try {
                await msgReaction.users.remove(user.id);
              } catch {
                // May not have permission to remove reactions
              }
            }
          }
        }
      }

      await member.roles.add(entry.roleId);
    } else {
      // Reaction removed
      if (panel.mode === "verify") {
        // Verify mode: cannot remove role by removing reaction
        return;
      }
      await member.roles.remove(entry.roleId);
    }
  } catch (error) {
    logger.error(
      `Failed to handle reaction role for panel ${panel.id}`,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
