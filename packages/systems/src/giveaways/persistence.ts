import { getPrisma } from "@fluxcore/database";
import type { Giveaway, CreateGiveawayData } from "./types.js";
import { GIVEAWAY_PAGE_SIZE } from "./constants.js";

function rowToGiveaway(row: {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string | null;
  hostId: string;
  prize: string;
  winners: number;
  endsAt: Date;
  ended: boolean;
  winnerIds: string;
  entrantIds: string;
  requiredRoleIds: string;
  createdAt: Date;
}): Giveaway {
  return {
    id: row.id,
    guildId: row.guildId,
    channelId: row.channelId,
    messageId: row.messageId,
    hostId: row.hostId,
    prize: row.prize,
    winners: row.winners,
    endsAt: row.endsAt,
    ended: row.ended,
    winnerIds: JSON.parse(row.winnerIds) as string[],
    entrantIds: JSON.parse(row.entrantIds) as string[],
    requiredRoleIds: JSON.parse(row.requiredRoleIds) as string[],
    createdAt: row.createdAt,
  };
}

export async function createGiveaway(data: CreateGiveawayData): Promise<Giveaway> {
  const prisma = getPrisma();
  const row = await prisma.giveaway.create({
    data: {
      guildId: data.guildId,
      channelId: data.channelId,
      hostId: data.hostId,
      prize: data.prize,
      winners: data.winners,
      endsAt: data.endsAt,
      requiredRoleIds: JSON.stringify(data.requiredRoleIds ?? []),
    },
  });
  return rowToGiveaway(row);
}

export async function getGiveaway(id: number, guildId: string): Promise<Giveaway | null> {
  const prisma = getPrisma();
  const row = await prisma.giveaway.findFirst({
    where: { id, guildId },
  });
  if (!row) return null;
  return rowToGiveaway(row);
}

export async function getActiveGiveaways(guildId: string): Promise<Giveaway[]> {
  const prisma = getPrisma();
  const rows = await prisma.giveaway.findMany({
    where: { guildId, ended: false },
    orderBy: { endsAt: "asc" },
  });
  return rows.map(rowToGiveaway);
}

export async function listGiveaways(
  guildId: string,
  options: { active?: boolean; page?: number; limit?: number } = {},
): Promise<{ giveaways: Giveaway[]; total: number }> {
  const prisma = getPrisma();
  const page = options.page ?? 1;
  const limit = options.limit ?? GIVEAWAY_PAGE_SIZE;
  const skip = (page - 1) * limit;

  const where: { guildId: string; ended?: boolean } = { guildId };
  if (options.active !== undefined) {
    where.ended = !options.active;
  }

  const [rows, total] = await Promise.all([
    prisma.giveaway.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.giveaway.count({ where }),
  ]);

  return { giveaways: rows.map(rowToGiveaway), total };
}

export async function setGiveawayMessageId(id: number, messageId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.giveaway.update({
    where: { id },
    data: { messageId },
  });
}

export async function addEntrant(id: number, userId: string): Promise<Giveaway> {
  const prisma = getPrisma();
  const row = await prisma.giveaway.findUniqueOrThrow({ where: { id } });
  const entrants = JSON.parse(row.entrantIds) as string[];
  if (!entrants.includes(userId)) {
    entrants.push(userId);
  }
  const updated = await prisma.giveaway.update({
    where: { id },
    data: { entrantIds: JSON.stringify(entrants) },
  });
  return rowToGiveaway(updated);
}

export async function removeEntrant(id: number, userId: string): Promise<Giveaway> {
  const prisma = getPrisma();
  const row = await prisma.giveaway.findUniqueOrThrow({ where: { id } });
  const entrants = (JSON.parse(row.entrantIds) as string[]).filter((e) => e !== userId);
  const updated = await prisma.giveaway.update({
    where: { id },
    data: { entrantIds: JSON.stringify(entrants) },
  });
  return rowToGiveaway(updated);
}

export async function endGiveaway(id: number, winnerIds: string[]): Promise<Giveaway> {
  const prisma = getPrisma();
  const updated = await prisma.giveaway.update({
    where: { id },
    data: {
      ended: true,
      winnerIds: JSON.stringify(winnerIds),
    },
  });
  return rowToGiveaway(updated);
}

export async function getDueGiveaways(): Promise<Giveaway[]> {
  const prisma = getPrisma();
  const rows = await prisma.giveaway.findMany({
    where: {
      ended: false,
      endsAt: { lte: new Date() },
    },
  });
  return rows.map(rowToGiveaway);
}

export async function getActiveGiveawayCount(guildId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.giveaway.count({ where: { guildId, ended: false } });
}
