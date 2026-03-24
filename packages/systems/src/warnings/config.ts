import { getPrisma } from "@fluxcore/database";
import type { WarnGuildSettings, WarnPunishment } from "./types.js";
import { DEFAULT_WARN_SETTINGS } from "./constants.js";

export async function getWarnSettings(guildId: string): Promise<WarnGuildSettings> {
  const prisma = getPrisma();
  const row = await prisma.warnGuildSettings.findUnique({ where: { guildId } });
  if (!row) return { guildId, ...DEFAULT_WARN_SETTINGS };
  return row;
}

export async function upsertWarnSettings(
  guildId: string,
  data: Partial<Omit<WarnGuildSettings, "guildId">>,
): Promise<WarnGuildSettings> {
  const prisma = getPrisma();
  const row = await prisma.warnGuildSettings.upsert({
    where: { guildId },
    create: { guildId, ...data },
    update: data,
  });
  return row;
}

export async function getPunishments(guildId: string): Promise<WarnPunishment[]> {
  const prisma = getPrisma();
  const rows = await prisma.warnPunishment.findMany({
    where: { guildId },
    orderBy: { threshold: "asc" },
  });
  return rows as WarnPunishment[];
}

export async function addPunishment(
  guildId: string,
  threshold: number,
  action: string,
  duration?: number | null,
): Promise<WarnPunishment> {
  const prisma = getPrisma();
  const row = await prisma.warnPunishment.create({
    data: {
      guildId,
      threshold,
      action,
      duration: duration ?? null,
    },
  });
  return row as WarnPunishment;
}

export async function removePunishment(id: number, guildId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.warnPunishment.deleteMany({
    where: { id, guildId },
  });
}
