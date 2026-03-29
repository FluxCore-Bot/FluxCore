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

export interface ScheduledMessageRow {
  id: number;
  guildId: string;
  channelId: string;
  name: string;
  message: ScheduledMessageContent;
  cronExpr: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdBy: string;
  createdAt: Date;
}
