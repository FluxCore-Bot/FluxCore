import { getPrisma } from "@fluxcore/database";
import type { LevelGuildSettings, LevelReward, XpMultipliers } from "./types.js";
import { DEFAULT_SETTINGS } from "./constants.js";

function rowToSettings(row: {
  guildId: string;
  enabled: boolean;
  xpPerMessage: number;
  xpCooldownSeconds: number;
  voiceXpPerMinute: number;
  voiceXpEnabled: boolean;
  announceChannel: string | null;
  announceMessage: string;
  announceEnabled: boolean;
  noXpChannels: string;
  noXpRoles: string;
  xpMultipliers: string;
}): LevelGuildSettings {
  return {
    guildId: row.guildId,
    enabled: row.enabled,
    xpPerMessage: row.xpPerMessage,
    xpCooldownSeconds: row.xpCooldownSeconds,
    voiceXpPerMinute: row.voiceXpPerMinute,
    voiceXpEnabled: row.voiceXpEnabled,
    announceChannel: row.announceChannel,
    announceMessage: row.announceMessage,
    announceEnabled: row.announceEnabled,
    noXpChannels: JSON.parse(row.noXpChannels) as string[],
    noXpRoles: JSON.parse(row.noXpRoles) as string[],
    xpMultipliers: JSON.parse(row.xpMultipliers) as XpMultipliers,
  };
}

export async function getLevelSettings(guildId: string): Promise<LevelGuildSettings> {
  const prisma = getPrisma();
  const row = await prisma.levelGuildSettings.findUnique({ where: { guildId } });
  if (!row) return { guildId, ...DEFAULT_SETTINGS };
  return rowToSettings(row);
}

export async function upsertLevelSettings(
  guildId: string,
  data: Partial<Omit<LevelGuildSettings, "guildId">>,
): Promise<LevelGuildSettings> {
  const prisma = getPrisma();

  // Convert arrays/objects to JSON strings for storage
  const dbData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "noXpChannels" || key === "noXpRoles" || key === "xpMultipliers") {
      dbData[key] = JSON.stringify(value);
    } else {
      dbData[key] = value;
    }
  }

  const row = await prisma.levelGuildSettings.upsert({
    where: { guildId },
    create: { guildId, ...dbData },
    update: dbData,
  });
  return rowToSettings(row);
}

export async function getLevelRewards(guildId: string): Promise<LevelReward[]> {
  const prisma = getPrisma();
  return prisma.levelReward.findMany({
    where: { guildId },
    orderBy: { level: "asc" },
  });
}

export async function addLevelReward(
  guildId: string,
  level: number,
  roleId: string,
): Promise<LevelReward> {
  const prisma = getPrisma();
  return prisma.levelReward.create({
    data: { guildId, level, roleId },
  });
}

export async function removeLevelReward(id: number, guildId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.levelReward.deleteMany({
    where: { id, guildId },
  });
}
