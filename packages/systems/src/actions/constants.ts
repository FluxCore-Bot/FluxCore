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
  type: "channel" | "role" | "text" | "textarea" | "color" | "select" | "json";
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
    // "json", not "textarea": the model types this as Record<string,string>,
    // so a raw textarea wrote a string into it and the rule became unsavable.
    { key: "webhook.headers", label: "Headers (JSON)", type: "json", placeholder: '{"X-Request-Id": "abc"}', maxLength: 1000 },
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

/**
 * Tokens every event context populates: the acting guild and the timestamp.
 *
 * Deliberately does NOT include {user*} or {channel*}. Those are only
 * available on the events whose context actually carries them — see
 * eventBridge.ts. Promising a token the bot never populates is worse than
 * omitting it: the dashboard preview renders "#general" while the bot posts
 * "Unknown Channel", and the editor's unknown-token warning stays silent
 * because the token looks legitimate.
 */
const GUILD_VARIABLES = ["{guild}", "{guild.memberCount}", "{timestamp}"];

/** Populated wherever the event has an acting user. */
const USER_VARIABLES = ["{user}", "{user.name}", "{user.tag}", "{user.id}"];

/** Populated wherever the event happened in a channel. */
const CHANNEL_VARIABLES = ["{channel}", "{channel.name}", "{channel.id}"];

const MEMBER_EVENT = [...USER_VARIABLES, ...GUILD_VARIABLES];
const MESSAGE_EVENT = [...USER_VARIABLES, ...CHANNEL_VARIABLES, ...GUILD_VARIABLES];

/**
 * Maps each event type to the template variables its context ACTUALLY
 * populates. Pinned against eventBridge.ts by
 * packages/systems/tests/unit/actions-event-variables.test.ts.
 */
export const EVENT_TYPE_VARIABLES: Record<ActionEventType, string[]> = {
  // buildMemberContext — a member, no channel
  memberJoin: [...MEMBER_EVENT],
  memberLeave: [...MEMBER_EVENT],
  nicknameChanged: [...MEMBER_EVENT, "{old.nickname}", "{new.nickname}"],
  memberTimeout: [...MEMBER_EVENT, "{timeout.until}"],
  boostStart: [...MEMBER_EVENT, "{boost.since}"],
  boostEnd: [...MEMBER_EVENT],

  // buildBanContext — a user, no channel
  memberBanned: [...MEMBER_EVENT, "{ban.reason}"],
  memberUnbanned: [...MEMBER_EVENT, "{ban.reason}"],

  // buildRoleContext — a member and a role, no channel
  roleAdded: [...MEMBER_EVENT, "{role}", "{role.name}", "{role.id}"],
  roleRemoved: [...MEMBER_EVENT, "{role}", "{role.name}", "{role.id}"],

  // buildMessageContext / buildReactionContext — user and channel
  messageCreated: [...MESSAGE_EVENT, "{message.content}", "{message.id}", "{message.url}"],
  messageDeleted: [...MESSAGE_EVENT, "{message.content}", "{message.id}", "{message.url}"],
  reactionAdded: [...MESSAGE_EVENT, "{emoji}", "{emoji.name}", "{message.id}", "{message.url}"],
  reactionRemoved: [...MESSAGE_EVENT, "{emoji}", "{emoji.name}", "{message.id}", "{message.url}"],

  // buildVoiceContext — user and channel
  voiceJoin: [...MESSAGE_EVENT, "{voice.channel}", "{voice.channel.name}"],
  voiceLeave: [...MESSAGE_EVENT, "{voice.channel}", "{voice.channel.name}"],

  // buildChannelContext — a channel, and NO acting user on the gateway event
  channelCreated: [...CHANNEL_VARIABLES, ...GUILD_VARIABLES],
  channelDeleted: [...CHANNEL_VARIABLES, ...GUILD_VARIABLES],

  // threadCreate — the owner is a bare id, so no username or tag is resolved
  threadCreated: [
    "{user}",
    "{user.id}",
    ...CHANNEL_VARIABLES,
    ...GUILD_VARIABLES,
    "{thread.name}",
    "{thread.id}",
  ],
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

/** The three data a trigger filter can key on. */
export type ConditionSubject = "channel" | "role" | "user";

/**
 * Which filter subjects each event type can actually be filtered by — i.e.
 * which of `channelId`, `member` and `userId` the bot populates on that
 * event's EventContext (see apps/bot/.../eventBridge.ts).
 *
 * Trigger filters fail closed: a configured filter the context cannot answer
 * stops the rule from firing. So offering a filter the trigger can never
 * satisfy does not merely do nothing — it silently disables the rule. The
 * dashboard reads this map to only offer filters that can work, and to flag
 * rules that already carry one that cannot.
 *
 * - `channel` — context.channelId is set
 * - `role`    — context.member is set (role filters read member.roles)
 * - `user`    — context.userId is set
 */
export const EVENT_CONDITION_SUPPORT: Record<ActionEventType, ConditionSubject[]> = {
  // buildMemberContext — member present unless the gateway sent a partial
  memberJoin: ["user", "role"],
  memberLeave: ["user", "role"],
  nicknameChanged: ["user", "role"],
  memberTimeout: ["user", "role"],
  boostStart: ["user", "role"],
  boostEnd: ["user", "role"],

  // buildBanContext — the user is no longer a member, so there is no member
  // object to read roles from, on either ban or unban
  memberBanned: ["user"],
  memberUnbanned: ["user"],

  // buildMessageContext / buildReactionContext — full context
  messageCreated: ["user", "role", "channel"],
  messageDeleted: ["user", "role", "channel"],
  reactionAdded: ["user", "role", "channel"],
  reactionRemoved: ["user", "role", "channel"],

  // buildRoleContext — member present, but no channel
  roleAdded: ["user", "role"],
  roleRemoved: ["user", "role"],

  // buildChannelContext — no acting user is available on the gateway event
  channelCreated: ["channel"],
  channelDeleted: ["channel"],

  // buildVoiceContext — full context
  voiceJoin: ["user", "role", "channel"],
  voiceLeave: ["user", "role", "channel"],

  // threadCreate — channelId is the NEW thread, and the owner is a bare id
  threadCreated: ["user", "channel"],
};

/** Whether `eventType` can be filtered by `subject`. */
export function supportsCondition(
  eventType: string,
  subject: ConditionSubject,
): boolean {
  const supported = EVENT_CONDITION_SUPPORT[eventType as ActionEventType];
  return supported ? supported.includes(subject) : false;
}

/**
 * Allowed character set for action rule names. Restricts user-supplied
 * names so they cannot inject markdown, mention syntax, code fences, or
 * invisible characters into embeds, autocomplete output, or audit logs.
 */
export const RULE_NAME_REGEX = /^[a-zA-Z0-9 _-]{1,50}$/;

export function isValidRuleName(name: string): boolean {
  return typeof name === "string" && RULE_NAME_REGEX.test(name);
}
