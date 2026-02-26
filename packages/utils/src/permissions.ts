import {
  type ChatInputCommandInteraction,
  type GuildMember,
  type PermissionResolvable,
  PermissionsBitField,
} from "discord.js";
import { errorEmbed } from "./embeds.js";

export async function checkPermissions(
  interaction: ChatInputCommandInteraction,
  permissions: PermissionResolvable[],
): Promise<boolean> {
  const member = interaction.member as GuildMember | null;
  if (!member) {
    await interaction.reply({
      embeds: [
        errorEmbed("Error", "This command can only be used in a server."),
      ],
      ephemeral: true,
    });
    return false;
  }

  const missing = permissions.filter(
    (perm) => !member.permissions.has(perm),
  );

  if (missing.length > 0) {
    const names = missing.map((p) =>
      new PermissionsBitField(p).toArray().join(", "),
    );
    await interaction.reply({
      embeds: [
        errorEmbed(
          "Missing Permissions",
          `You need the following permissions: ${names.join(", ")}`,
        ),
      ],
      ephemeral: true,
    });
    return false;
  }

  return true;
}

export async function checkBotPermissions(
  interaction: ChatInputCommandInteraction,
  permissions: PermissionResolvable[],
): Promise<boolean> {
  const botMember = interaction.guild?.members.me;
  if (!botMember) {
    await interaction.reply({
      embeds: [
        errorEmbed("Error", "Could not resolve bot member in this server."),
      ],
      ephemeral: true,
    });
    return false;
  }

  const missing = permissions.filter(
    (perm) => !botMember.permissions.has(perm),
  );

  if (missing.length > 0) {
    const names = missing.map((p) =>
      new PermissionsBitField(p).toArray().join(", "),
    );
    await interaction.reply({
      embeds: [
        errorEmbed(
          "Bot Missing Permissions",
          `I need the following permissions: ${names.join(", ")}`,
        ),
      ],
      ephemeral: true,
    });
    return false;
  }

  return true;
}

export function isAboveTarget(
  actor: GuildMember,
  target: GuildMember,
): boolean {
  return actor.roles.highest.position > target.roles.highest.position;
}
