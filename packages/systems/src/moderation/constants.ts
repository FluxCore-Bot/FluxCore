export const VALID_MOD_ACTIONS = ["ban", "tempban", "kick", "timeout", "softban", "warn", "note"] as const;
export const MAX_PURGE_AMOUNT = 100;
export const MAX_REASON_LENGTH = 500;
export const CASES_PER_PAGE = 10;
export const TEMPBAN_CHECK_INTERVAL_MS = 60_000; // 60 seconds
export const DURATION_PRESETS: Record<string, number> = {
  "1h": 3600,
  "6h": 21600,
  "12h": 43200,
  "1d": 86400,
  "3d": 259200,
  "7d": 604800,
  "14d": 1209600,
  "30d": 2592000,
};
