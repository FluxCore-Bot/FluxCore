/** Persisted per-guild configuration */
export interface TempVoiceGuildConfig {
  /** Auto-incremented database ID */
  id: number;
  /** The hub voice channel ID that triggers temp channel creation */
  hubChannelId: string;
  /** The category ID under which temp channels are created (same parent as hub) */
  categoryId: string | null;
  /** Channel name template. {user} is replaced with the creator's display name */
  nameTemplate: string;
}

/** Shape of the JSON config file on disk (legacy, used for migration only) */
export interface TempVoiceConfigFile {
  guilds: Record<string, TempVoiceGuildConfig>;
}

/** Runtime state for an active temp channel */
export interface ActiveTempChannel {
  channelId: string;
  guildId: string;
  ownerId: string;
  /** The config ID that spawned this temp channel */
  configId: number;
  panelMessageId: string | null;
  isLocked: boolean;
  isHidden: boolean;
  isTextClosed: boolean;
  /** User IDs denied Connect on this channel */
  bannedUserIds: string[];
  /** User IDs denied ViewChannel on this channel */
  hiddenFromUserIds: string[];
}

/** Persisted per-user-per-guild temp voice settings, restored on next channel creation */
export interface SavedTempVoiceSettings {
  channelName: string | null;
  userLimit: number;
  isLocked: boolean;
  isHidden: boolean;
  isTextClosed: boolean;
  bannedUserIds: string[];
  hiddenFromUserIds: string[];
}
