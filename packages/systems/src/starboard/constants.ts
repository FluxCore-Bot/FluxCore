import type { StarboardGuildSettings } from "./types.js";

export const DEFAULT_EMOJI = "\u2B50";
export const DEFAULT_THRESHOLD = 3;
export const STARBOARD_PAGE_SIZE = 20;

export const DEFAULT_SETTINGS: Omit<StarboardGuildSettings, "guildId"> = {
  enabled: true,
  channelId: null,
  emoji: DEFAULT_EMOJI,
  threshold: DEFAULT_THRESHOLD,
  selfStar: false,
  ignoredChannels: [],
  nsfwHandling: "ignore",
};
