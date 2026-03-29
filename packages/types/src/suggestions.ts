export type SuggestionStatus = "pending" | "approved" | "denied" | "implemented";

export interface Suggestion {
  id: number;
  guildId: string;
  userId: string;
  messageId: string | null;
  content: string;
  status: SuggestionStatus;
  statusReason: string | null;
  statusBy: string | null;
  upvotes: number;
  downvotes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SuggestionGuildSettings {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  reviewChannelId: string | null;
  dmOnStatusChange: boolean;
  autoThread: boolean;
  anonymousMode: boolean;
}
