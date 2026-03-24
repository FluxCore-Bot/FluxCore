export interface Warning {
  id: number;
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: Date;
}

export interface WarnPunishment {
  id: number;
  guildId: string;
  threshold: number;
  action: "timeout" | "kick" | "ban";
  duration: number | null;
}

export interface WarnGuildSettings {
  guildId: string;
  dmOnWarn: boolean;
  reasonRequired: boolean;
  maxWarnings: number;
}

export interface CreateWarningInput {
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
}
