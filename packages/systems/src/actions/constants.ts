import type { ActionEventType, ActionType } from "./types.js";

export const DEFAULT_MAX_RULES_PER_GUILD = 25;
export const MAX_ACTIONS_PER_RULE = 5;
export const MAX_TEMPLATE_LENGTH = 2000;
export const ACTION_LOG_RETENTION_DAYS = 30;

interface EventTypeInfo {
  label: string;
  description: string;
}

interface ActionTypeInfo {
  label: string;
  description: string;
}

export const EVENT_TYPES: Record<ActionEventType, EventTypeInfo> = {
  memberJoin: {
    label: "Member Join",
    description: "When a new member joins the server",
  },
  memberLeave: {
    label: "Member Leave",
    description: "When a member leaves the server",
  },
  memberBanned: {
    label: "Member Banned",
    description: "When a member is banned",
  },
  memberUnbanned: {
    label: "Member Unbanned",
    description: "When a member is unbanned",
  },
  messageDeleted: {
    label: "Message Deleted",
    description: "When a message is deleted",
  },
  roleAdded: {
    label: "Role Added",
    description: "When a role is added to a member",
  },
  roleRemoved: {
    label: "Role Removed",
    description: "When a role is removed from a member",
  },
  channelCreated: {
    label: "Channel Created",
    description: "When a new channel is created",
  },
  channelDeleted: {
    label: "Channel Deleted",
    description: "When a channel is deleted",
  },
  voiceJoin: {
    label: "Voice Join",
    description: "When a member joins a voice channel",
  },
  voiceLeave: {
    label: "Voice Leave",
    description: "When a member leaves a voice channel",
  },
};

export const ACTION_TYPES: Record<ActionType, ActionTypeInfo> = {
  sendMessage: {
    label: "Send Message",
    description: "Send a message to a channel",
  },
  sendEmbed: {
    label: "Send Embed",
    description: "Send an embed to a channel",
  },
  sendDM: {
    label: "Send DM",
    description: "Send a direct message to the user",
  },
  addRole: {
    label: "Add Role",
    description: "Add a role to the member",
  },
  removeRole: {
    label: "Remove Role",
    description: "Remove a role from the member",
  },
  logToChannel: {
    label: "Log to Channel",
    description: "Log event details to a channel",
  },
};

export const TEMPLATE_VARIABLES: Record<string, string> = {
  "{user}": "User mention (e.g. @User)",
  "{user.name}": "Username",
  "{user.tag}": "User tag (e.g. User#0001)",
  "{user.id}": "User ID",
  "{channel}": "Channel mention",
  "{channel.name}": "Channel name",
  "{channel.id}": "Channel ID",
  "{role}": "Role mention",
  "{role.name}": "Role name",
  "{role.id}": "Role ID",
  "{guild}": "Server name",
  "{guild.memberCount}": "Server member count",
  "{timestamp}": "Current timestamp",
};

export const CONDITION_TYPES = [
  "channel",
  "role",
  "user",
  "exclude-channel",
  "exclude-role",
  "exclude-user",
] as const;

export type ConditionType = (typeof CONDITION_TYPES)[number];
