export const MAX_REASON_LENGTH = 500;
export const VALID_ESCALATION_ACTIONS = ["timeout", "kick", "ban"] as const;
export const WARNINGS_PER_PAGE = 10;
export const DEFAULT_WARN_SETTINGS: Omit<import("./types.js").WarnGuildSettings, "guildId"> = {
  dmOnWarn: true,
  reasonRequired: false,
  maxWarnings: 0,
};
