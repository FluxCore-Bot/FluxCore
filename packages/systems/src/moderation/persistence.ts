import { getPrisma } from "@fluxcore/database";
import type { ModCase, ModGuildSettings, CreateModCaseInput } from "./types.js";
import { CASES_PER_PAGE } from "./constants.js";

export async function createModCase(input: CreateModCaseInput): Promise<ModCase> {
  const prisma = getPrisma();
  const row = await prisma.modCase.create({
    data: {
      guildId: input.guildId,
      targetId: input.targetId,
      moderatorId: input.moderatorId,
      action: input.action,
      reason: input.reason ?? null,
      duration: input.duration ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });
  return row as ModCase;
}

export async function getModCases(
  guildId: string,
  filters?: { targetId?: string; action?: string; page?: number; limit?: number },
): Promise<{ cases: ModCase[]; total: number }> {
  const prisma = getPrisma();
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? CASES_PER_PAGE;

  const where: Record<string, unknown> = { guildId };
  if (filters?.targetId) where.targetId = filters.targetId;
  if (filters?.action) where.action = filters.action;

  const [cases, total] = await Promise.all([
    prisma.modCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.modCase.count({ where }),
  ]);

  return { cases: cases as ModCase[], total };
}

export async function getModCaseById(id: number, guildId: string): Promise<ModCase | null> {
  const prisma = getPrisma();
  const row = await prisma.modCase.findFirst({ where: { id, guildId } });
  return (row as ModCase) ?? null;
}

export async function updateModCase(
  id: number,
  guildId: string,
  data: { reason?: string },
): Promise<ModCase> {
  const prisma = getPrisma();
  const row = await prisma.modCase.update({
    where: { id },
    data: {
      ...data,
      // Ensure we only update cases belonging to this guild
      guildId,
    },
  });
  return row as ModCase;
}

export async function deleteModCase(id: number, guildId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.modCase.deleteMany({ where: { id, guildId } });
}

export async function getExpiredTempbans(): Promise<ModCase[]> {
  const prisma = getPrisma();
  const rows = await prisma.modCase.findMany({
    where: {
      action: "tempban",
      active: true,
      expiresAt: { lte: new Date() },
    },
  });
  return rows as ModCase[];
}

export async function deactivateModCase(id: number): Promise<void> {
  const prisma = getPrisma();
  await prisma.modCase.update({
    where: { id },
    data: { active: false },
  });
}

export async function getModSettings(guildId: string): Promise<ModGuildSettings> {
  const prisma = getPrisma();
  const row = await prisma.modGuildSettings.findUnique({ where: { guildId } });
  if (row) return row as ModGuildSettings;
  return { guildId, dmOnPunishment: true, modLogChannelId: null };
}

export async function upsertModSettings(
  guildId: string,
  data: Partial<Omit<ModGuildSettings, "guildId">>,
): Promise<ModGuildSettings> {
  const prisma = getPrisma();
  const row = await prisma.modGuildSettings.upsert({
    where: { guildId },
    create: {
      guildId,
      dmOnPunishment: data.dmOnPunishment ?? true,
      modLogChannelId: data.modLogChannelId ?? null,
    },
    update: data,
  });
  return row as ModGuildSettings;
}
