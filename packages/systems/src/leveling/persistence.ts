import { getPrisma } from "@fluxcore/database";
import type { UserLevel, AddXpResult } from "./types.js";
import { levelFromXp } from "./xp.js";
import { LEADERBOARD_PAGE_SIZE } from "./constants.js";

export async function getUserLevel(guildId: string, userId: string): Promise<UserLevel | null> {
  const prisma = getPrisma();
  return prisma.userLevel.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
}

export async function addXp(
  guildId: string,
  userId: string,
  amount: number,
): Promise<AddXpResult> {
  const prisma = getPrisma();

  const existing = await prisma.userLevel.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  const oldXp = existing?.xp ?? 0;
  const oldLevel = existing?.level ?? 0;
  const newXp = oldXp + amount;
  const newLevel = levelFromXp(newXp);

  await prisma.userLevel.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: {
      guildId,
      userId,
      xp: newXp,
      level: newLevel,
      messageCount: 1,
      lastMessageXp: new Date(),
    },
    update: {
      xp: newXp,
      level: newLevel,
      messageCount: { increment: 1 },
      lastMessageXp: new Date(),
    },
  });

  return {
    leveledUp: newLevel > oldLevel,
    newLevel,
    oldLevel,
    totalXp: newXp,
  };
}

export async function addVoiceXp(
  guildId: string,
  userId: string,
  amount: number,
  minutes: number,
): Promise<AddXpResult> {
  const prisma = getPrisma();

  const existing = await prisma.userLevel.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  const oldXp = existing?.xp ?? 0;
  const oldLevel = existing?.level ?? 0;
  const newXp = oldXp + amount;
  const newLevel = levelFromXp(newXp);

  await prisma.userLevel.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: {
      guildId,
      userId,
      xp: newXp,
      level: newLevel,
      voiceMinutes: minutes,
    },
    update: {
      xp: newXp,
      level: newLevel,
      voiceMinutes: { increment: minutes },
    },
  });

  return {
    leveledUp: newLevel > oldLevel,
    newLevel,
    oldLevel,
    totalXp: newXp,
  };
}

export async function setXp(
  guildId: string,
  userId: string,
  amount: number,
): Promise<AddXpResult> {
  const prisma = getPrisma();

  const existing = await prisma.userLevel.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  const oldLevel = existing?.level ?? 0;
  const newLevel = levelFromXp(amount);

  await prisma.userLevel.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: {
      guildId,
      userId,
      xp: amount,
      level: newLevel,
    },
    update: {
      xp: amount,
      level: newLevel,
    },
  });

  return {
    leveledUp: newLevel > oldLevel,
    newLevel,
    oldLevel,
    totalXp: amount,
  };
}

export async function getLeaderboard(
  guildId: string,
  page = 1,
  limit = LEADERBOARD_PAGE_SIZE,
): Promise<{ entries: UserLevel[]; total: number }> {
  const prisma = getPrisma();

  const [entries, total] = await Promise.all([
    prisma.userLevel.findMany({
      where: { guildId },
      orderBy: { xp: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.userLevel.count({ where: { guildId } }),
  ]);

  return { entries, total };
}

export async function getUserRank(guildId: string, userId: string): Promise<number> {
  const prisma = getPrisma();

  const user = await prisma.userLevel.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  if (!user) return 0;

  const rank = await prisma.userLevel.count({
    where: {
      guildId,
      xp: { gt: user.xp },
    },
  });

  return rank + 1;
}
