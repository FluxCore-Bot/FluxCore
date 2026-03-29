export interface UserLevel {
  id: number;
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  messageCount: number;
  voiceMinutes: number;
  lastMessageXp: Date | null;
  updatedAt: Date;
}

export interface LevelReward {
  id: number;
  guildId: string;
  level: number;
  roleId: string;
}

export interface LevelGuildSettings {
  guildId: string;
  enabled: boolean;
  xpPerMessage: number;
  xpCooldownSeconds: number;
  voiceXpPerMinute: number;
  voiceXpEnabled: boolean;
  announceChannel: string | null;
  announceMessage: string;
  announceEnabled: boolean;
  noXpChannels: string[];
  noXpRoles: string[];
  xpMultipliers: XpMultipliers;
}

export interface XpMultipliers {
  channels?: Record<string, number>;
  roles?: Record<string, number>;
}

export interface AddXpResult {
  leveledUp: boolean;
  newLevel: number;
  oldLevel: number;
  totalXp: number;
}
