import type { TicketGuildSettings } from "./types.js";

export const MAX_FORM_FIELDS = 5;
export const MAX_CATEGORIES = 10;
export const MAX_OPEN_PER_USER_DEFAULT = 3;
export const TICKETS_PAGE_SIZE = 20;
export const TRANSCRIPT_FETCH_LIMIT = 100;
export const AUTO_CLOSE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const AUTO_CLOSE_WARNING_HOURS = 1;

export const NAMING_VARIABLES = ["{number}", "{username}"] as const;

export const TICKET_BUTTON_PREFIX = "ticket_" as const;
export const TICKET_CLAIM_ID = "ticket_claim" as const;
export const TICKET_CLOSE_ID = "ticket_close" as const;

export const DEFAULT_SETTINGS: Omit<TicketGuildSettings, "guildId"> = {
  staffRoleIds: [],
  transcriptChannelId: null,
  maxOpenPerUser: MAX_OPEN_PER_USER_DEFAULT,
  autoCloseHours: 0,
  namingFormat: "ticket-{number}",
  ticketCounter: 0,
};
