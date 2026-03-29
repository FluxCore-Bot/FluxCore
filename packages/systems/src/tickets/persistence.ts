import { getPrisma } from "@fluxcore/database";
import type { Ticket, TicketPanel, TicketCategory, TicketStatus } from "./types.js";
import { TICKETS_PAGE_SIZE } from "./constants.js";

// === Ticket CRUD ===

function rowToTicket(row: {
  id: number;
  guildId: string;
  channelId: string;
  userId: string;
  categoryName: string | null;
  panelId: number | null;
  status: string;
  claimedBy: string | null;
  closeReason: string | null;
  formResponses: string;
  transcriptUrl: string | null;
  createdAt: Date;
  closedAt: Date | null;
}): Ticket {
  return {
    id: row.id,
    guildId: row.guildId,
    channelId: row.channelId,
    userId: row.userId,
    categoryName: row.categoryName,
    panelId: row.panelId,
    status: row.status as TicketStatus,
    claimedBy: row.claimedBy,
    closeReason: row.closeReason,
    formResponses: JSON.parse(row.formResponses) as Record<string, string>,
    transcriptUrl: row.transcriptUrl,
    createdAt: row.createdAt,
    closedAt: row.closedAt,
  };
}

function rowToPanel(row: {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string | null;
  name: string;
  embed: string;
  categories: string;
  createdBy: string;
  createdAt: Date;
}): TicketPanel {
  return {
    id: row.id,
    guildId: row.guildId,
    channelId: row.channelId,
    messageId: row.messageId,
    name: row.name,
    embed: row.embed,
    categories: JSON.parse(row.categories) as TicketCategory[],
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export async function createTicket(data: {
  guildId: string;
  channelId: string;
  userId: string;
  categoryName?: string;
  panelId?: number;
  formResponses?: Record<string, string>;
}): Promise<Ticket> {
  const prisma = getPrisma();
  const row = await prisma.ticket.create({
    data: {
      guildId: data.guildId,
      channelId: data.channelId,
      userId: data.userId,
      categoryName: data.categoryName ?? null,
      panelId: data.panelId ?? null,
      formResponses: data.formResponses ? JSON.stringify(data.formResponses) : "{}",
    },
  });
  return rowToTicket(row);
}

export async function getTicketByChannel(channelId: string): Promise<Ticket | null> {
  const prisma = getPrisma();
  const row = await prisma.ticket.findUnique({ where: { channelId } });
  if (!row) return null;
  return rowToTicket(row);
}

export async function getTicketById(id: number): Promise<Ticket | null> {
  const prisma = getPrisma();
  const row = await prisma.ticket.findUnique({ where: { id } });
  if (!row) return null;
  return rowToTicket(row);
}

export async function getTickets(
  guildId: string,
  filters: { status?: TicketStatus; userId?: string; page?: number; limit?: number } = {},
): Promise<{ tickets: Ticket[]; total: number }> {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? TICKETS_PAGE_SIZE;

  const where: Record<string, unknown> = { guildId };
  if (filters.status) where.status = filters.status;
  if (filters.userId) where.userId = filters.userId;

  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return { tickets: rows.map(rowToTicket), total };
}

export async function getOpenTicketCount(guildId: string, userId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.ticket.count({
    where: { guildId, userId, status: { not: "closed" } },
  });
}

export async function updateTicket(
  id: number,
  data: Partial<{
    status: TicketStatus;
    claimedBy: string | null;
    closeReason: string | null;
    transcriptUrl: string | null;
    closedAt: Date | null;
  }>,
): Promise<Ticket> {
  const prisma = getPrisma();
  const row = await prisma.ticket.update({
    where: { id },
    data,
  });
  return rowToTicket(row);
}

export async function closeTicket(
  id: number,
  reason?: string,
  transcriptUrl?: string,
): Promise<Ticket> {
  return updateTicket(id, {
    status: "closed",
    closeReason: reason ?? null,
    transcriptUrl: transcriptUrl ?? null,
    closedAt: new Date(),
  });
}

export async function claimTicket(id: number, claimedBy: string): Promise<Ticket> {
  return updateTicket(id, {
    status: "claimed",
    claimedBy,
  });
}

export async function getInactiveTickets(
  guildId: string,
  beforeDate: Date,
): Promise<Ticket[]> {
  const prisma = getPrisma();
  // Find open/claimed tickets with no recent activity
  // We use createdAt as a proxy; in production you'd track lastActivityAt
  const rows = await prisma.ticket.findMany({
    where: {
      guildId,
      status: { not: "closed" },
      createdAt: { lt: beforeDate },
    },
  });
  return rows.map(rowToTicket);
}

// === Panel CRUD ===

export async function getTicketPanels(guildId: string): Promise<TicketPanel[]> {
  const prisma = getPrisma();
  const rows = await prisma.ticketPanel.findMany({
    where: { guildId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(rowToPanel);
}

export async function getTicketPanel(id: number): Promise<TicketPanel | null> {
  const prisma = getPrisma();
  const row = await prisma.ticketPanel.findUnique({ where: { id } });
  if (!row) return null;
  return rowToPanel(row);
}

export async function createTicketPanel(data: {
  guildId: string;
  channelId: string;
  name: string;
  embed?: string;
  categories?: TicketCategory[];
  createdBy: string;
}): Promise<TicketPanel> {
  const prisma = getPrisma();
  const row = await prisma.ticketPanel.create({
    data: {
      guildId: data.guildId,
      channelId: data.channelId,
      name: data.name,
      embed: data.embed ?? "{}",
      categories: data.categories ? JSON.stringify(data.categories) : "[]",
      createdBy: data.createdBy,
    },
  });
  return rowToPanel(row);
}

export async function updateTicketPanel(
  id: number,
  data: Partial<{
    channelId: string;
    name: string;
    embed: string;
    categories: TicketCategory[];
    messageId: string | null;
  }>,
): Promise<TicketPanel> {
  const prisma = getPrisma();

  const dbData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "categories") {
      dbData[key] = JSON.stringify(value);
    } else {
      dbData[key] = value;
    }
  }

  const row = await prisma.ticketPanel.update({
    where: { id },
    data: dbData,
  });
  return rowToPanel(row);
}

export async function deleteTicketPanel(id: number, guildId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.ticketPanel.deleteMany({
    where: { id, guildId },
  });
}

export async function updatePanelMessageId(
  id: number,
  messageId: string,
): Promise<TicketPanel> {
  return updateTicketPanel(id, { messageId });
}
