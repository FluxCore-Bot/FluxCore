import type {
  Client,
  GuildBan,
  GuildChannel,
  GuildMember,
  Message,
  PartialGuildMember,
  PartialMessage,
  Role,
  VoiceState,
} from "discord.js";
import { logger } from "@fluxcore/utils";
import { processEvent } from "./executor.js";
import type { ActionEventType, EventContext } from "@fluxcore/systems/actions/types";

function handleError(eventType: string, error: unknown): void {
  logger.error(
    `Action event processing failed for ${eventType}`,
    error instanceof Error ? error : new Error(String(error)),
  );
}

function buildMemberContext(
  eventType: ActionEventType,
  member: GuildMember | PartialGuildMember,
): EventContext {
  return {
    eventType,
    guildId: member.guild.id,
    guildName: member.guild.name,
    userId: member.id,
    userName: member.user?.username ?? member.displayName,
    userTag: member.user?.tag ?? member.displayName,
    userMention: `<@${member.id}>`,
    memberCount: member.guild.memberCount,
    timestamp: new Date().toISOString(),
    member: member.partial ? undefined : member,
  };
}

function buildBanContext(
  eventType: ActionEventType,
  ban: GuildBan,
): EventContext {
  return {
    eventType,
    guildId: ban.guild.id,
    guildName: ban.guild.name,
    userId: ban.user.id,
    userName: ban.user.username,
    userTag: ban.user.tag,
    userMention: `<@${ban.user.id}>`,
    memberCount: ban.guild.memberCount,
    timestamp: new Date().toISOString(),
  };
}

function buildMessageContext(
  eventType: ActionEventType,
  message: Message | PartialMessage,
): EventContext {
  return {
    eventType,
    guildId: message.guildId!,
    guildName: message.guild?.name,
    userId: message.author?.id,
    userName: message.author?.username,
    userTag: message.author?.tag,
    userMention: message.author ? `<@${message.author.id}>` : undefined,
    channelId: message.channelId,
    channelName:
      "name" in message.channel ? (message.channel.name ?? undefined) : undefined,
    channelMention: `<#${message.channelId}>`,
    memberCount: message.guild?.memberCount,
    timestamp: new Date().toISOString(),
  };
}

function buildRoleContext(
  eventType: ActionEventType,
  member: GuildMember,
  role: Role,
): EventContext {
  return {
    eventType,
    guildId: member.guild.id,
    guildName: member.guild.name,
    userId: member.id,
    userName: member.user.username,
    userTag: member.user.tag,
    userMention: `<@${member.id}>`,
    roleId: role.id,
    roleName: role.name,
    roleMention: `<@&${role.id}>`,
    memberCount: member.guild.memberCount,
    timestamp: new Date().toISOString(),
    member,
  };
}

function buildChannelContext(
  eventType: ActionEventType,
  channel: GuildChannel,
): EventContext {
  return {
    eventType,
    guildId: channel.guild.id,
    guildName: channel.guild.name,
    channelId: channel.id,
    channelName: channel.name,
    channelMention: `<#${channel.id}>`,
    memberCount: channel.guild.memberCount,
    timestamp: new Date().toISOString(),
  };
}

function buildVoiceContext(
  eventType: ActionEventType,
  state: VoiceState,
): EventContext {
  return {
    eventType,
    guildId: state.guild.id,
    guildName: state.guild.name,
    userId: state.member?.id ?? state.id,
    userName: state.member?.user.username,
    userTag: state.member?.user.tag,
    userMention: `<@${state.member?.id ?? state.id}>`,
    channelId: state.channelId ?? undefined,
    channelName: state.channel?.name ?? undefined,
    channelMention: state.channelId
      ? `<#${state.channelId}>`
      : undefined,
    memberCount: state.guild.memberCount,
    timestamp: new Date().toISOString(),
    member: state.member ?? undefined,
  };
}

export function registerActionEventListeners(client: Client): void {
  // Member join/leave
  client.on("guildMemberAdd", (member) => {
    const ctx = buildMemberContext("memberJoin", member);
    processEvent(client, ctx).catch((e) => handleError("memberJoin", e));
  });

  client.on("guildMemberRemove", (member) => {
    const ctx = buildMemberContext("memberLeave", member);
    processEvent(client, ctx).catch((e) => handleError("memberLeave", e));
  });

  // Ban/unban
  client.on("guildBanAdd", (ban) => {
    const ctx = buildBanContext("memberBanned", ban);
    processEvent(client, ctx).catch((e) => handleError("memberBanned", e));
  });

  client.on("guildBanRemove", (ban) => {
    const ctx = buildBanContext("memberUnbanned", ban);
    processEvent(client, ctx).catch((e) =>
      handleError("memberUnbanned", e),
    );
  });

  // Message deleted
  client.on("messageDelete", (message) => {
    if (!message.guildId || message.author?.bot) return;
    const ctx = buildMessageContext("messageDeleted", message);
    processEvent(client, ctx).catch((e) =>
      handleError("messageDeleted", e),
    );
  });

  // Role added/removed (diff via guildMemberUpdate)
  client.on("guildMemberUpdate", (oldMember, newMember) => {
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    for (const [roleId, role] of newRoles) {
      if (!oldRoles.has(roleId)) {
        const ctx = buildRoleContext("roleAdded", newMember, role);
        processEvent(client, ctx).catch((e) =>
          handleError("roleAdded", e),
        );
      }
    }

    for (const [roleId, role] of oldRoles) {
      if (!newRoles.has(roleId)) {
        const ctx = buildRoleContext("roleRemoved", newMember, role);
        processEvent(client, ctx).catch((e) =>
          handleError("roleRemoved", e),
        );
      }
    }
  });

  // Channel created/deleted
  client.on("channelCreate", (channel) => {
    if (!("guild" in channel)) return;
    const ctx = buildChannelContext(
      "channelCreated",
      channel as GuildChannel,
    );
    processEvent(client, ctx).catch((e) =>
      handleError("channelCreated", e),
    );
  });

  client.on("channelDelete", (channel) => {
    if (!("guild" in channel)) return;
    const ctx = buildChannelContext(
      "channelDeleted",
      channel as GuildChannel,
    );
    processEvent(client, ctx).catch((e) =>
      handleError("channelDeleted", e),
    );
  });

  // Voice join/leave
  client.on("voiceStateUpdate", (oldState, newState) => {
    if (newState.channelId && newState.channelId !== oldState.channelId) {
      const ctx = buildVoiceContext("voiceJoin", newState);
      processEvent(client, ctx).catch((e) =>
        handleError("voiceJoin", e),
      );
    }
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const ctx = buildVoiceContext("voiceLeave", oldState);
      processEvent(client, ctx).catch((e) =>
        handleError("voiceLeave", e),
      );
    }
  });

  logger.info("Registered action event listeners");
}
