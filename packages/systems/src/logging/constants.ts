import type { LogCategory, LogEventType } from "./types.js";

/** Discord embed colors (hex numbers) per log category. */
export const LOG_COLORS: Record<LogCategory, number> = {
  message: 0x60a5fa,    // info blue
  member: 0xa3a6ff,     // primary
  voice: 0xac8aff,      // secondary
  channel: 0xfee75c,    // warning
  role: 0xfee75c,       // warning
  server: 0xfee75c,     // warning
  moderation: 0xff6e84, // danger
};

export const LOG_CATEGORIES: LogCategory[] = [
  "message",
  "member",
  "voice",
  "channel",
  "role",
  "server",
  "moderation",
];

export const EVENT_TYPES_BY_CATEGORY: Record<LogCategory, LogEventType[]> = {
  message: ["messageDelete", "messageUpdate", "messageBulkDelete", "messagePin", "messageUnpin"],
  member: ["memberJoin", "memberLeave", "memberBan", "memberUnban", "memberKick", "memberNicknameChange", "memberRoleChange"],
  voice: ["voiceJoin", "voiceLeave", "voiceSwitch", "voiceMute", "voiceDeafen"],
  channel: ["channelCreate", "channelDelete", "channelUpdate"],
  role: ["roleCreate", "roleDelete", "roleUpdate"],
  server: ["serverUpdate", "emojiUpdate"],
  moderation: ["modWarn", "modKick", "modBan", "modTempban", "modTimeout", "modSoftban", "modNote", "modPurge"],
};

/** Number of days to retain log entries before cleanup. */
export const LOG_RETENTION_DAYS = 90;
