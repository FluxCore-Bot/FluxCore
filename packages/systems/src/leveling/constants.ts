import type { LevelGuildSettings } from "./types.js";

export const DEFAULT_XP_PER_MESSAGE = 15;
export const XP_RANDOMNESS = 10;
export const DEFAULT_COOLDOWN = 60;
export const MAX_LEVEL = 100;
export const LEADERBOARD_PAGE_SIZE = 10;

export const DEFAULT_SETTINGS: Omit<LevelGuildSettings, "guildId"> = {
  enabled: true,
  xpPerMessage: DEFAULT_XP_PER_MESSAGE,
  xpCooldownSeconds: DEFAULT_COOLDOWN,
  voiceXpPerMinute: 5,
  voiceXpEnabled: true,
  announceChannel: null,
  announceMessage: "{user} just reached **Level {level}**!",
  announceEnabled: true,
  noXpChannels: [],
  noXpRoles: [],
  xpMultipliers: {},
};
