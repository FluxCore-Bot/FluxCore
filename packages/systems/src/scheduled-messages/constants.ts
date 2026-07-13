/** Interval in milliseconds for checking due scheduled messages */
export const SCHEDULER_CHECK_INTERVAL_MS = 1_000; // 1 second

/** Maximum number of scheduled messages per guild */
export const MAX_SCHEDULED_MESSAGES_PER_GUILD = 25;

/** Maximum length for message name */
export const MAX_NAME_LENGTH = 100;

/** Maximum length for message content */
export const MAX_CONTENT_LENGTH = 2000;

/** Maximum length for embed description */
export const MAX_EMBED_DESCRIPTION_LENGTH = 4096;

/** Commonly used timezones for the dashboard selector */
export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;
