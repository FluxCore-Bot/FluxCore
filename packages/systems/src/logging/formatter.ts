import { EmbedBuilder } from "discord.js";
import type {
  GuildMember,
  Message,
  PartialMessage,
  GuildChannel,
  Role,
  Guild,
  VoiceState,
  GuildBan,
} from "discord.js";
import { LOG_COLORS } from "./constants.js";

/** Format a message delete log embed. */
export function formatMessageDelete(message: Message | PartialMessage): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(LOG_COLORS.message)
    .setAuthor({
      name: message.author?.tag ?? "Unknown",
      iconURL: message.author?.displayAvatarURL(),
    })
    .setTitle("Message Deleted")
    .addFields(
      { name: "Channel", value: `<#${message.channelId}>`, inline: true },
      { name: "Author", value: message.author ? `<@${message.author.id}>` : "Unknown", inline: true },
    )
    .setFooter({ text: `Message ID: ${message.id}` })
    .setTimestamp();

  if (message.content) {
    embed.setDescription(message.content.slice(0, 4096));
  }

  if (message.attachments && message.attachments.size > 0) {
    const attachmentList = message.attachments.map((a) => `[${a.name}](${a.proxyURL})`).join("\n");
    embed.addFields({ name: "Attachments", value: attachmentList.slice(0, 1024) });
  }

  return embed;
}

/** Format a message update (edit) log embed. */
export function formatMessageUpdate(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(LOG_COLORS.message)
    .setAuthor({
      name: newMessage.author?.tag ?? "Unknown",
      iconURL: newMessage.author?.displayAvatarURL(),
    })
    .setTitle("Message Edited")
    .addFields(
      { name: "Channel", value: `<#${newMessage.channelId}>`, inline: true },
      { name: "Author", value: newMessage.author ? `<@${newMessage.author.id}>` : "Unknown", inline: true },
      { name: "Jump to Message", value: `[Click here](${newMessage.url})`, inline: true },
    )
    .setFooter({ text: `Message ID: ${newMessage.id}` })
    .setTimestamp();

  if (oldMessage.content) {
    embed.addFields({ name: "Before", value: oldMessage.content.slice(0, 1024) });
  }
  if (newMessage.content) {
    embed.addFields({ name: "After", value: newMessage.content.slice(0, 1024) });
  }

  return embed;
}

/** Format a bulk delete log embed. */
export function formatBulkDelete(channelId: string, count: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(LOG_COLORS.message)
    .setTitle("Messages Bulk Deleted")
    .addFields(
      { name: "Channel", value: `<#${channelId}>`, inline: true },
      { name: "Count", value: count.toString(), inline: true },
    )
    .setTimestamp();
}

/** Format a member join log embed. */
export function formatMemberJoin(member: GuildMember): EmbedBuilder {
  const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
  return new EmbedBuilder()
    .setColor(LOG_COLORS.member)
    .setAuthor({
      name: member.user.tag,
      iconURL: member.user.displayAvatarURL(),
    })
    .setTitle("Member Joined")
    .addFields(
      { name: "User", value: `<@${member.id}>`, inline: true },
      { name: "Account Created", value: `${accountAge} day(s) ago`, inline: true },
      { name: "Member Count", value: member.guild.memberCount.toLocaleString(), inline: true },
    )
    .setFooter({ text: `User ID: ${member.id}` })
    .setTimestamp();
}

/** Format a member leave log embed. */
export function formatMemberLeave(member: GuildMember): EmbedBuilder {
  const roles = member.roles.cache
    .filter((r) => r.id !== member.guild.id)
    .map((r) => `<@&${r.id}>`)
    .join(", ");

  const embed = new EmbedBuilder()
    .setColor(LOG_COLORS.member)
    .setAuthor({
      name: member.user.tag,
      iconURL: member.user.displayAvatarURL(),
    })
    .setTitle("Member Left")
    .addFields(
      { name: "User", value: `<@${member.id}>`, inline: true },
      { name: "Member Count", value: member.guild.memberCount.toLocaleString(), inline: true },
    )
    .setFooter({ text: `User ID: ${member.id}` })
    .setTimestamp();

  if (roles) {
    embed.addFields({ name: "Roles", value: roles.slice(0, 1024) });
  }

  return embed;
}

/** Format a ban log embed. */
export function formatBan(ban: GuildBan): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(LOG_COLORS.member)
    .setAuthor({
      name: ban.user.tag,
      iconURL: ban.user.displayAvatarURL(),
    })
    .setTitle("Member Banned")
    .addFields(
      { name: "User", value: `<@${ban.user.id}>`, inline: true },
      { name: "Reason", value: ban.reason ?? "No reason provided", inline: true },
    )
    .setFooter({ text: `User ID: ${ban.user.id}` })
    .setTimestamp();
}

/** Format an unban log embed. */
export function formatUnban(ban: GuildBan): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(LOG_COLORS.member)
    .setAuthor({
      name: ban.user.tag,
      iconURL: ban.user.displayAvatarURL(),
    })
    .setTitle("Member Unbanned")
    .addFields({ name: "User", value: `<@${ban.user.id}>`, inline: true })
    .setFooter({ text: `User ID: ${ban.user.id}` })
    .setTimestamp();
}

/** Format a nickname change log embed. */
export function formatNicknameChange(
  member: GuildMember,
  oldNickname: string | null,
  newNickname: string | null,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(LOG_COLORS.member)
    .setAuthor({
      name: member.user.tag,
      iconURL: member.user.displayAvatarURL(),
    })
    .setTitle("Nickname Changed")
    .addFields(
      { name: "User", value: `<@${member.id}>`, inline: true },
      { name: "Before", value: oldNickname ?? "None", inline: true },
      { name: "After", value: newNickname ?? "None", inline: true },
    )
    .setFooter({ text: `User ID: ${member.id}` })
    .setTimestamp();
}

/** Format a role change log embed. */
export function formatRoleChange(
  member: GuildMember,
  addedRoles: string[],
  removedRoles: string[],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(LOG_COLORS.member)
    .setAuthor({
      name: member.user.tag,
      iconURL: member.user.displayAvatarURL(),
    })
    .setTitle("Member Roles Updated")
    .addFields({ name: "User", value: `<@${member.id}>`, inline: true })
    .setFooter({ text: `User ID: ${member.id}` })
    .setTimestamp();

  if (addedRoles.length > 0) {
    embed.addFields({ name: "Added", value: addedRoles.map((id) => `<@&${id}>`).join(", ").slice(0, 1024), inline: true });
  }
  if (removedRoles.length > 0) {
    embed.addFields({ name: "Removed", value: removedRoles.map((id) => `<@&${id}>`).join(", ").slice(0, 1024), inline: true });
  }

  return embed;
}

/** Format a voice state log embed (join/leave/switch). */
export function formatVoiceEvent(
  type: "join" | "leave" | "switch",
  state: VoiceState,
  oldChannelId?: string | null,
): EmbedBuilder {
  const titles: Record<string, string> = {
    join: "Voice Channel Joined",
    leave: "Voice Channel Left",
    switch: "Voice Channel Switched",
  };

  const embed = new EmbedBuilder()
    .setColor(LOG_COLORS.voice)
    .setAuthor({
      name: state.member?.user.tag ?? "Unknown",
      iconURL: state.member?.user.displayAvatarURL(),
    })
    .setTitle(titles[type])
    .setFooter({ text: `User ID: ${state.member?.id ?? "Unknown"}` })
    .setTimestamp();

  if (type === "switch" && oldChannelId) {
    embed.addFields(
      { name: "From", value: `<#${oldChannelId}>`, inline: true },
      { name: "To", value: `<#${state.channelId}>`, inline: true },
    );
  } else if (type === "join" && state.channelId) {
    embed.addFields({ name: "Channel", value: `<#${state.channelId}>`, inline: true });
  } else if (type === "leave" && oldChannelId) {
    embed.addFields({ name: "Channel", value: `<#${oldChannelId}>`, inline: true });
  }

  return embed;
}

/** Format a channel create/delete/update log embed. */
export function formatChannelEvent(
  type: "create" | "delete" | "update",
  channel: GuildChannel,
): EmbedBuilder {
  const titles: Record<string, string> = {
    create: "Channel Created",
    delete: "Channel Deleted",
    update: "Channel Updated",
  };

  return new EmbedBuilder()
    .setColor(LOG_COLORS.channel)
    .setTitle(titles[type])
    .addFields(
      { name: "Channel", value: type === "delete" ? channel.name : `<#${channel.id}>`, inline: true },
      { name: "Type", value: String(channel.type), inline: true },
    )
    .setFooter({ text: `Channel ID: ${channel.id}` })
    .setTimestamp();
}

/** Format a role create/delete/update log embed. */
export function formatRoleEvent(type: "create" | "delete" | "update", role: Role): EmbedBuilder {
  const titles: Record<string, string> = {
    create: "Role Created",
    delete: "Role Deleted",
    update: "Role Updated",
  };

  return new EmbedBuilder()
    .setColor(LOG_COLORS.role)
    .setTitle(titles[type])
    .addFields(
      { name: "Role", value: type === "delete" ? role.name : `<@&${role.id}>`, inline: true },
      { name: "Color", value: role.hexColor, inline: true },
    )
    .setFooter({ text: `Role ID: ${role.id}` })
    .setTimestamp();
}

/** Format a guild update log embed. */
export function formatGuildUpdate(oldGuild: Guild, newGuild: Guild): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(LOG_COLORS.server)
    .setTitle("Server Settings Updated")
    .setTimestamp();

  const changes: string[] = [];
  if (oldGuild.name !== newGuild.name) changes.push(`**Name:** ${oldGuild.name} -> ${newGuild.name}`);
  if (oldGuild.iconURL() !== newGuild.iconURL()) changes.push("**Icon** was changed");
  if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
    changes.push(`**Verification Level:** ${oldGuild.verificationLevel} -> ${newGuild.verificationLevel}`);
  }
  if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
    changes.push(`**AFK Channel:** ${oldGuild.afkChannelId ? `<#${oldGuild.afkChannelId}>` : "None"} -> ${newGuild.afkChannelId ? `<#${newGuild.afkChannelId}>` : "None"}`);
  }

  embed.setDescription(changes.length > 0 ? changes.join("\n") : "Settings were updated");
  return embed;
}
