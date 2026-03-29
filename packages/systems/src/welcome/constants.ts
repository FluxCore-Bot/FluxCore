import type { GuildMember } from "discord.js";
import type { EmbedConfig } from "./types.js";

export const WELCOME_VARIABLES: Record<string, (member: GuildMember) => string> = {
  "{user}": (m) => `<@${m.id}>`,
  "{user.tag}": (m) => m.user.tag,
  "{user.name}": (m) => m.user.username,
  "{user.id}": (m) => m.id,
  "{user.avatar}": (m) => m.user.displayAvatarURL({ size: 256 }),
  "{server}": (m) => m.guild.name,
  "{server.id}": (m) => m.guild.id,
  "{membercount}": (m) => m.guild.memberCount.toLocaleString(),
  "{server.icon}": (m) => m.guild.iconURL({ size: 256 }) ?? "",
};

export const DEFAULT_WELCOME_EMBED: EmbedConfig = {
  title: "Welcome to {server}!",
  description: "Hey {user}, welcome to **{server}**! You are member #{membercount}.",
  color: 0xa3a6ff,
};

export const DEFAULT_FAREWELL_EMBED: EmbedConfig = {
  title: "Goodbye!",
  description: "{user.tag} has left **{server}**. We now have {membercount} members.",
  color: 0x6b7280,
};
