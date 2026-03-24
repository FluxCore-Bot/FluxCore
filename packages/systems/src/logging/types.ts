export type LogCategory = "message" | "member" | "voice" | "channel" | "role" | "server" | "moderation";

export type LogEventType =
  | "messageDelete" | "messageUpdate" | "messageBulkDelete" | "messagePin" | "messageUnpin"
  | "memberJoin" | "memberLeave" | "memberBan" | "memberUnban" | "memberKick" | "memberNicknameChange" | "memberRoleChange"
  | "voiceJoin" | "voiceLeave" | "voiceSwitch" | "voiceMute" | "voiceDeafen"
  | "channelCreate" | "channelDelete" | "channelUpdate"
  | "roleCreate" | "roleDelete" | "roleUpdate"
  | "serverUpdate" | "emojiUpdate"
  | "modWarn" | "modKick" | "modBan" | "modTempban" | "modTimeout" | "modSoftban" | "modNote" | "modPurge";

export interface LogGuildConfig {
  id: number;
  guildId: string;
  category: LogCategory;
  channelId: string;
  enabled: boolean;
  ignoredChannels: string[];
  ignoredRoles: string[];
  enabledEvents: string[];
}

export interface LogEntry {
  id: number;
  guildId: string;
  category: LogCategory;
  eventType: LogEventType;
  targetId: string | null;
  executorId: string | null;
  content: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateLogEntryInput {
  guildId: string;
  category: LogCategory;
  eventType: LogEventType;
  targetId?: string;
  executorId?: string;
  content?: Record<string, unknown>;
}
