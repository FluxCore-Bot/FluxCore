import type { SuggestionGuildSettings } from "./types.js";

export const SUGGESTIONS_PAGE_SIZE = 10;

export const VALID_STATUSES = ["pending", "approved", "denied", "implemented"] as const;

export const STATUS_COLORS: Record<string, number> = {
  pending: 0xffa500,    // Orange
  approved: 0x57f287,   // Green
  denied: 0xed4245,     // Red
  implemented: 0x5865f2, // Blurple
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  implemented: "Implemented",
};

export const MAX_SUGGESTION_LENGTH = 2000;

export const DEFAULT_SETTINGS: Omit<SuggestionGuildSettings, "guildId"> = {
  enabled: true,
  channelId: null,
  reviewChannelId: null,
  dmOnStatusChange: true,
  autoThread: false,
  anonymousMode: false,
};
