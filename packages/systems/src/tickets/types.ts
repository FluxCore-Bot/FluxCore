export interface TicketCategory {
  name: string;
  label: string;
  emoji?: string;
  description?: string;
  staffRoleIds?: string[];
  formFields?: TicketFormField[];
}

export interface TicketFormField {
  label: string;
  placeholder?: string;
  style: "short" | "paragraph";
  required: boolean;
  maxLength?: number;
}

export interface TicketPanel {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string | null;
  name: string;
  embed: string;
  categories: TicketCategory[];
  createdBy: string;
  createdAt: Date;
}

export type TicketStatus = "open" | "claimed" | "closed";

export interface Ticket {
  id: number;
  guildId: string;
  channelId: string;
  userId: string;
  categoryName: string | null;
  panelId: number | null;
  status: TicketStatus;
  claimedBy: string | null;
  closeReason: string | null;
  formResponses: Record<string, string>;
  transcriptUrl: string | null;
  createdAt: Date;
  closedAt: Date | null;
}

export interface TicketGuildSettings {
  guildId: string;
  staffRoleIds: string[];
  transcriptChannelId: string | null;
  maxOpenPerUser: number;
  autoCloseHours: number;
  namingFormat: string;
  ticketCounter: number;
}
