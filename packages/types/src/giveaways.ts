export interface Giveaway {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string | null;
  hostId: string;
  prize: string;
  winners: number;
  endsAt: Date;
  ended: boolean;
  winnerIds: string[];
  entrantIds: string[];
  requiredRoleIds: string[];
  createdAt: Date;
}

export interface CreateGiveawayData {
  guildId: string;
  channelId: string;
  hostId: string;
  prize: string;
  winners: number;
  endsAt: Date;
  requiredRoleIds?: string[];
}
