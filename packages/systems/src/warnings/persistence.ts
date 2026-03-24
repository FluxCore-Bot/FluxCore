import { getPrisma } from "@fluxcore/database";
import type { Warning, CreateWarningInput } from "./types.js";
import { WARNINGS_PER_PAGE } from "./constants.js";

export async function createWarning(input: CreateWarningInput): Promise<Warning> {
  const prisma = getPrisma();
  const row = await prisma.warning.create({
    data: {
      guildId: input.guildId,
      userId: input.userId,
      moderatorId: input.moderatorId,
      reason: input.reason,
    },
  });
  return row;
}

export async function getWarnings(
  guildId: string,
  userId?: string,
  page = 1,
  limit = WARNINGS_PER_PAGE,
): Promise<{ warnings: Warning[]; total: number }> {
  const prisma = getPrisma();
  const where = userId ? { guildId, userId } : { guildId };

  const [warnings, total] = await Promise.all([
    prisma.warning.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.warning.count({ where }),
  ]);

  return { warnings, total };
}

export async function getWarningById(id: number, guildId: string): Promise<Warning | null> {
  const prisma = getPrisma();
  return prisma.warning.findFirst({
    where: { id, guildId },
  });
}

export async function deleteWarning(id: number, guildId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.warning.deleteMany({
    where: { id, guildId },
  });
}

export async function deleteAllWarnings(guildId: string, userId: string): Promise<number> {
  const prisma = getPrisma();
  const result = await prisma.warning.deleteMany({
    where: { guildId, userId },
  });
  return result.count;
}

export async function getWarningCount(guildId: string, userId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.warning.count({
    where: { guildId, userId },
  });
}
