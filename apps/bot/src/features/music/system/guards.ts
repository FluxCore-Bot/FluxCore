import type { ChatInputCommandInteraction, ButtonInteraction, GuildMember } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import type { MusicGuildSettings } from "@fluxcore/systems/music/types";
import { errorEmbed } from "@fluxcore/utils";
import { getQueue } from "./queue.js";

type RepliableInteraction = ChatInputCommandInteraction | ButtonInteraction;

export async function requireVoiceChannel(
  interaction: ChatInputCommandInteraction,
): Promise<string | null> {
  const member = interaction.member as GuildMember;
  const channelId = member.voice.channelId;
  if (!channelId) {
    await interaction.reply({
      embeds: [errorEmbed("Not in Voice", "You must be in a voice channel to use this command.")],
      ephemeral: true,
    });
    return null;
  }
  return channelId;
}

export async function requireSameVoiceChannel(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  const member = interaction.member as GuildMember;
  const queue = getQueue(interaction.guildId!);
  if (!queue) return true;

  if (member.voice.channelId !== queue.voiceChannelId) {
    await interaction.reply({
      embeds: [errorEmbed("Wrong Channel", "You must be in the same voice channel as the bot.")],
      ephemeral: true,
    });
    return false;
  }
  return true;
}

async function requireDjOrPermissionImpl(
  interaction: RepliableInteraction,
  settings: MusicGuildSettings,
): Promise<boolean> {
  const member = interaction.member as GuildMember;

  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;

  if (!settings.djRoleId) return true;

  if (member.roles.cache.has(settings.djRoleId)) return true;

  await interaction.reply({
    embeds: [errorEmbed("DJ Only", "This action requires the DJ role or Manage Server permission.")],
    ephemeral: true,
  });
  return false;
}

export const requireDjOrPermission = requireDjOrPermissionImpl;
export const requireDjOrPermissionButton = requireDjOrPermissionImpl;

export async function requireQueue(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  const queue = getQueue(interaction.guildId!);
  if (!queue || !queue.current) {
    await interaction.reply({
      embeds: [errorEmbed("Nothing Playing", "There is nothing currently playing.")],
      ephemeral: true,
    });
    return false;
  }
  return true;
}

export async function requireSameVoiceChannelButton(
  interaction: ButtonInteraction,
): Promise<boolean> {
  const member = interaction.member as GuildMember;
  const queue = getQueue(interaction.guildId!);
  if (!queue) {
    await interaction.reply({
      embeds: [errorEmbed("Nothing Playing", "There is nothing currently playing.")],
      ephemeral: true,
    });
    return false;
  }

  if (member.voice.channelId !== queue.voiceChannelId) {
    await interaction.reply({
      embeds: [errorEmbed("Wrong Channel", "You must be in the same voice channel as the bot.")],
      ephemeral: true,
    });
    return false;
  }
  return true;
}
