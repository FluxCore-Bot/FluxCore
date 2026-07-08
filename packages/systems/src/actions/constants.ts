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
  messageCreated: {
    label: "Message Created",
    description: "When a message is sent in a channel",
  },
  reactionAdded: {
    label: "Reaction Added",
    description: "When a reaction is added to a message",
  },
  reactionRemoved: {
    label: "Reaction Removed",
    description: "When a reaction is removed from a message",
  },
  nicknameChanged: {
    label: "Nickname Changed",
    description: "When a member's nickname is changed",
  },
  memberTimeout: {
    label: "Member Timeout",
    description: "When a member is timed out",
  },
  threadCreated: {
    label: "Thread Created",
    description: "When a new thread is created",
  },
  boostStart: {
    label: "Boost Start",
    description: "When a member starts boosting the server",
  },
  boostEnd: {
    label: "Boost End",
    description: "When a member stops boosting the server",
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
  sendWebhook: {
    label: "Send Webhook",
    description: "Send an HTTP request to an external URL",
  },
  setNickname: {
    label: "Set Nickname",
    description: "Set the member's nickname",
  },
  createThread: {
    label: "Create Thread",
    description: "Create a new thread in the channel",
  },
  addReaction: {
    label: "Add Reaction",
    description: "Add a reaction to the triggering message",
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
  "{message.content}": "Message content (messageCreated/messageDeleted)",
  "{message.id}": "Message ID",
  "{message.url}": "Message URL",
  "{emoji}": "Emoji (unicode or custom)",
  "{emoji.name}": "Emoji name",
  "{ban.reason}": "Ban reason",
  "{old.nickname}": "Previous nickname",
  "{new.nickname}": "New nickname",
  "{boost.since}": "Boost start timestamp",
  "{timeout.until}": "Timeout expiration timestamp",
  "{voice.channel}": "Voice channel mention",
  "{voice.channel.name}": "Voice channel name",
  "{thread.name}": "Thread name",
  "{thread.id}": "Thread ID",
};

/** Describes a form field for a specific action type */
export interface ActionFieldDescriptor {
  key: string;
  label: string;
  type: "channel" | "role" | "text" | "textarea" | "color" | "select";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  maxLength?: number;
}

/** Maps each action type to its required form fields */
export const ACTION_TYPE_FIELDS: Record<ActionType, ActionFieldDescriptor[]> = {
  sendMessage: [
    { key: "channelId", label: "Channel", type: "channel", required: true },
    { key: "message", label: "Message", type: "textarea", placeholder: "Use {user}, {channel}, etc.", required: true, maxLength: 2000 },
  ],
  sendEmbed: [
    { key: "channelId", label: "Channel", type: "channel", required: true },
    { key: "embed.title", label: "Embed Title", type: "text", placeholder: "Embed title...", maxLength: 256 },
    { key: "embed.description", label: "Embed Description", type: "textarea", placeholder: "Embed description... supports {user}, {channel}, etc.", maxLength: 2000 },
    { key: "embed.color", label: "Embed Color", type: "color" },
    { key: "embed.footer", label: "Embed Footer", type: "text", placeholder: "Footer text...", maxLength: 256 },
  ],
  sendDM: [
    { key: "message", label: "Message", type: "textarea", placeholder: "DM message... supports {user}, {guild}, etc.", required: true, maxLength: 2000 },
  ],
  addRole: [
    { key: "roleId", label: "Role", type: "role", required: true },
  ],
  removeRole: [
    { key: "roleId", label: "Role", type: "role", required: true },
  ],
  logToChannel: [
    { key: "channelId", label: "Channel", type: "channel", required: true },
  ],
  sendWebhook: [
    { key: "webhook.url", label: "Webhook URL", type: "text", placeholder: "https://...", required: true },
    { key: "webhook.method", label: "HTTP Method", type: "select", options: [{ value: "POST", label: "POST" }, { value: "PUT", label: "PUT" }] },
    { key: "webhook.headers", label: "Headers (JSON)", type: "textarea", placeholder: '{"Authorization": "Bearer ..."}', maxLength: 1000 },
    { key: "webhook.bodyTemplate", label: "Body Template", type: "textarea", placeholder: "JSON body... supports {user}, {channel}, etc.", maxLength: 2000 },
  ],
  setNickname: [
    { key: "nickname", label: "Nickname", type: "text", placeholder: "New nickname... supports {user.name}", required: true, maxLength: 32 },
  ],
  createThread: [
    { key: "channelId", label: "Channel", type: "channel", required: true },
    { key: "threadName", label: "Thread Name", type: "text", placeholder: "Thread name... supports {user.name}, etc.", required: true, maxLength: 100 },
  ],
  addReaction: [
    { key: "emoji", label: "Emoji", type: "text", placeholder: "Unicode emoji or custom emoji ID", required: true },
  ],
};

const GENERAL_VARIABLES = [
  "{user}", "{user.name}", "{user.tag}", "{user.id}",
  "{channel}", "{channel.name}", "{channel.id}",
  "{guild}", "{guild.memberCount}",
  "{timestamp}",
];

/** Maps each event type to its available template variables */
export const EVENT_TYPE_VARIABLES: Record<ActionEventType, string[]> = {
  memberJoin: [...GENERAL_VARIABLES],
  memberLeave: [...GENERAL_VARIABLES],
  memberBanned: [...GENERAL_VARIABLES, "{ban.reason}"],
  memberUnbanned: [...GENERAL_VARIABLES, "{ban.reason}"],
  messageCreated: [...GENERAL_VARIABLES, "{message.content}", "{message.id}", "{message.url}"],
  messageDeleted: [...GENERAL_VARIABLES, "{message.content}", "{message.id}", "{message.url}"],
  reactionAdded: [...GENERAL_VARIABLES, "{emoji}", "{emoji.name}", "{message.id}", "{message.url}"],
  reactionRemoved: [...GENERAL_VARIABLES, "{emoji}", "{emoji.name}", "{message.id}", "{message.url}"],
  roleAdded: [...GENERAL_VARIABLES, "{role}", "{role.name}", "{role.id}"],
  roleRemoved: [...GENERAL_VARIABLES, "{role}", "{role.name}", "{role.id}"],
  channelCreated: [...GENERAL_VARIABLES],
  channelDeleted: [...GENERAL_VARIABLES],
  voiceJoin: [...GENERAL_VARIABLES, "{voice.channel}", "{voice.channel.name}"],
  voiceLeave: [...GENERAL_VARIABLES, "{voice.channel}", "{voice.channel.name}"],
  nicknameChanged: [...GENERAL_VARIABLES, "{old.nickname}", "{new.nickname}"],
  memberTimeout: [...GENERAL_VARIABLES, "{timeout.until}"],
  threadCreated: [...GENERAL_VARIABLES, "{thread.name}", "{thread.id}"],
  boostStart: [...GENERAL_VARIABLES, "{boost.since}"],
  boostEnd: [...GENERAL_VARIABLES],
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

/**
 * Allowed character set for action rule names. Restricts user-supplied
 * names so they cannot inject markdown, mention syntax, code fences, or
 * invisible characters into embeds, autocomplete output, or audit logs.
 */
export const RULE_NAME_REGEX = /^[a-zA-Z0-9 _-]{1,50}$/;

export function isValidRuleName(name: string): boolean {
  return typeof name === "string" && RULE_NAME_REGEX.test(name);
}
