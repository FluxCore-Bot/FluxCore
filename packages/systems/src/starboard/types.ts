export interface StarboardEntry {
  id: number;
  guildId: string;
  originalMessageId: string;
  originalChannelId: string;
  starboardMessageId: string | null;
  authorId: string;
  starCount: number;
  createdAt: Date;
}

export interface StarboardGuildSettings {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  emoji: string;
  threshold: number;
  selfStar: boolean;
  ignoredChannels: string[];
  nsfwHandling: "ignore" | "separate";
}
