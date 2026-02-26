import type { GuildMember } from "discord.js";

/** Supported event types that admins can listen to */
export type ActionEventType =
  | "memberJoin"
  | "memberLeave"
  | "memberBanned"
  | "memberUnbanned"
  | "messageDeleted"
  | "roleAdded"
  | "roleRemoved"
  | "channelCreated"
  | "channelDeleted"
  | "voiceJoin"
  | "voiceLeave"
  | "messageCreated"
  | "reactionAdded"
  | "reactionRemoved"
  | "nicknameChanged"
  | "memberTimeout"
  | "threadCreated"
  | "boostStart"
  | "boostEnd";

/** Supported action types that can be triggered */
export type ActionType =
  | "sendMessage"
  | "sendEmbed"
  | "sendDM"
  | "addRole"
  | "removeRole"
  | "logToChannel"
  | "sendWebhook"
  | "setNickname"
  | "createThread"
  | "addReaction";

/** Embed configuration for sendEmbed actions */
export interface ActionEmbedConfig {
  title?: string;
  description?: string;
  color?: number;
  footer?: string;
}

/** Webhook configuration for sendWebhook actions */
export interface ActionWebhookConfig {
  url: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  bodyTemplate?: string;
}

/** A single action configuration within a rule */
export interface ActionConfig {
  type: ActionType;
  channelId?: string;
  roleId?: string;
  message?: string;
  embed?: ActionEmbedConfig;
  webhook?: ActionWebhookConfig;
  nickname?: string;
  threadName?: string;
  emoji?: string;
}

/** Filter conditions for when the rule should fire */
export interface ActionConditions {
  channelIds?: string[];
  roleIds?: string[];
  userIds?: string[];
  excludeChannelIds?: string[];
  excludeRoleIds?: string[];
  excludeUserIds?: string[];
}

/** Full rule as used in memory */
export interface ActionRule {
  id: number;
  guildId: string;
  name: string;
  enabled: boolean;
  eventType: ActionEventType;
  actions: ActionConfig[];
  conditions: ActionConditions;
  priority: number;
  createdBy: string;
}

/** Context object built from a Discord event */
export interface EventContext {
  eventType: ActionEventType;
  guildId: string;
  guildName?: string;
  userId?: string;
  userName?: string;
  userTag?: string;
  userMention?: string;
  channelId?: string;
  channelName?: string;
  channelMention?: string;
  roleId?: string;
  roleName?: string;
  roleMention?: string;
  memberCount?: number;
  timestamp: string;
  member?: GuildMember;
  /** Event-specific key-value data resolved by the template engine */
  extra?: Record<string, string>;
}

/** Guild-level action system settings */
export interface ActionGuildSettings {
  maxRules: number;
  globalEnabled: boolean;
  logChannelId: string | null;
}
