import { getPrisma } from "@fluxcore/database";
import type { StarboardEntry } from "./types.js";
import { STARBOARD_PAGE_SIZE } from "./constants.js";

export async function getStarboardEntry(
  guildId: string,
  originalMessageId: string,
): Promise<StarboardEntry | null> {
  const prisma = getPrisma();
  return prisma.starboardEntry.findUnique({
    where: { guildId_originalMessageId: { guildId, originalMessageId } },
  });
}

export async function upsertStarboardEntry(
  guildId: string,
  originalMessageId: string,
  data: {
    originalChannelId: string;
    authorId: string;
    starCount: number;
    starboardMessageId?: string | null;
  },
): Promise<StarboardEntry> {
  const prisma = getPrisma();
  return prisma.starboardEntry.upsert({
    where: { guildId_originalMessageId: { guildId, originalMessageId } },
    create: {
      guildId,
      originalMessageId,
      originalChannelId: data.originalChannelId,
      authorId: data.authorId,
      starCount: data.starCount,
      starboardMessageId: data.starboardMessageId ?? null,
    },
    update: {
      starCount: data.starCount,
      starboardMessageId: data.starboardMessageId,
    },
  });
}

export async function updateStarboardMessageId(
  guildId: string,
  originalMessageId: string,
  starboardMessageId: string,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.starboardEntry.update({
    where: { guildId_originalMessageId: { guildId, originalMessageId } },
    data: { starboardMessageId },
  });
}

export async function updateStarCount(
  guildId: string,
  originalMessageId: string,
  starCount: number,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.starboardEntry.update({
    where: { guildId_originalMessageId: { guildId, originalMessageId } },
    data: { starCount },
  });
}

export async function deleteStarboardEntry(
  guildId: string,
  originalMessageId: string,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.starboardEntry.deleteMany({
    where: { guildId, originalMessageId },
  });
}

export async function getStarboardEntries(
  guildId: string,
  page = 1,
  limit = STARBOARD_PAGE_SIZE,
): Promise<{ entries: StarboardEntry[]; total: number }> {
  const prisma = getPrisma();

  const [entries, total] = await Promise.all([
    prisma.starboardEntry.findMany({
      where: { guildId },
      orderBy: { starCount: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.starboardEntry.count({ where: { guildId } }),
  ]);

  return { entries, total };
}
