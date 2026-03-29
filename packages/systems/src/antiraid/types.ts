export type RaidAction = "kick" | "ban" | "timeout";

export interface AntiRaidConfig {
  guildId: string;
  enabled: boolean;
  joinThreshold: number;
  joinWindow: number;
  joinAction: RaidAction;
  accountAgeMinDays: number;
  accountAgeAction: RaidAction;
  antiNukeEnabled: boolean;
  antiNukeThreshold: number;
  lockdownOnRaid: boolean;
  whitelistedRoleIds: string[];
  logChannelId: string | null;
}

export interface RaidEvent {
  id: number;
  guildId: string;
  eventType: RaidEventType;
  details: RaidEventDetails;
  triggeredAt: Date;
}

export type RaidEventType = "join_spike" | "account_age" | "nuke_attempt" | "lockdown";

export interface RaidEventDetails {
  userIds?: string[];
  executorId?: string;
  action?: string;
  reason?: string;
  count?: number;
  ageDays?: number;
}
