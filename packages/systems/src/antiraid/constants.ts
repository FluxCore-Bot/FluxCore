import type { AntiRaidConfig, RaidAction } from "./types.js";

export const VALID_RAID_ACTIONS: RaidAction[] = ["kick", "ban", "timeout"];

export const DEFAULT_JOIN_THRESHOLD = 10;
export const DEFAULT_JOIN_WINDOW = 10;
export const DEFAULT_ACCOUNT_AGE_MIN_DAYS = 0;
export const DEFAULT_ANTI_NUKE_THRESHOLD = 3;
export const ANTI_NUKE_WINDOW_MS = 10_000;
export const DEFAULT_TIMEOUT_DURATION_MS = 600_000; // 10 minutes
export const RAID_EVENT_PAGE_SIZE = 20;

export const DEFAULT_CONFIG: Omit<AntiRaidConfig, "guildId"> = {
  enabled: false,
  joinThreshold: DEFAULT_JOIN_THRESHOLD,
  joinWindow: DEFAULT_JOIN_WINDOW,
  joinAction: "kick",
  accountAgeMinDays: DEFAULT_ACCOUNT_AGE_MIN_DAYS,
  accountAgeAction: "kick",
  antiNukeEnabled: false,
  antiNukeThreshold: DEFAULT_ANTI_NUKE_THRESHOLD,
  lockdownOnRaid: false,
  whitelistedRoleIds: [],
  logChannelId: null,
};
