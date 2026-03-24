export type ModAction = "ban" | "tempban" | "kick" | "timeout" | "softban" | "warn" | "note";

export interface ModCase {
  id: number;
  guildId: string;
  targetId: string;
  moderatorId: string;
  action: ModAction;
  reason: string | null;
  duration: number | null;
  expiresAt: Date | null;
  active: boolean;
  createdAt: Date;
}

export interface ModGuildSettings {
  guildId: string;
  dmOnPunishment: boolean;
  modLogChannelId: string | null;
}

export interface CreateModCaseInput {
  guildId: string;
  targetId: string;
  moderatorId: string;
  action: ModAction;
  reason?: string;
  duration?: number;
  expiresAt?: Date;
}
