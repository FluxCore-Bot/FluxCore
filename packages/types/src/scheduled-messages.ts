export interface ScheduledMessageEmbed {
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: string;
  image?: string;
  footer?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
}

export interface ScheduledMessageContent {
  type: "text" | "embed";
  content?: string;
  embed?: ScheduledMessageEmbed;
}

export interface ScheduledMessage {
  id: number;
  guildId: string;
  channelId: string;
  name: string;
  message: ScheduledMessageContent;
  cronExpr: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateScheduledMessageInput {
  channelId: string;
  name: string;
  message: ScheduledMessageContent;
  cronExpr: string;
  timezone?: string;
  enabled?: boolean;
}

export interface UpdateScheduledMessageInput {
  channelId?: string;
  name?: string;
  message?: ScheduledMessageContent;
  cronExpr?: string;
  timezone?: string;
  enabled?: boolean;
}

export const CRON_PRESETS = {
  "Every hour": "0 * * * *",
  "Every 6 hours": "0 */6 * * *",
  "Daily at 9am": "0 9 * * *",
  "Daily at midnight": "0 0 * * *",
  "Weekly (Monday 9am)": "0 9 * * 1",
  "Monthly (1st at 9am)": "0 9 1 * *",
} as const;

export type CronPresetLabel = keyof typeof CRON_PRESETS;
