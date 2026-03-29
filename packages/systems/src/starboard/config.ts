import { getPrisma } from "@fluxcore/database";
import type { StarboardGuildSettings } from "./types.js";
import { DEFAULT_SETTINGS } from "./constants.js";

function rowToSettings(row: {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  emoji: string;
  threshold: number;
  selfStar: boolean;
  ignoredChannels: string;
  nsfwHandling: string;
}): StarboardGuildSettings {
  return {
    guildId: row.guildId,
    enabled: row.enabled,
    channelId: row.channelId,
    emoji: row.emoji,
    threshold: row.threshold,
    selfStar: row.selfStar,
    ignoredChannels: JSON.parse(row.ignoredChannels) as string[],
    nsfwHandling: row.nsfwHandling as "ignore" | "separate",
  };
}

export async function getStarboardSettings(guildId: string): Promise<StarboardGuildSettings> {
  const prisma = getPrisma();
  const row = await prisma.starboardGuildSettings.findUnique({ where: { guildId } });
  if (!row) return { guildId, ...DEFAULT_SETTINGS };
  return rowToSettings(row);
}

export async function upsertStarboardSettings(
  guildId: string,
  data: Partial<Omit<StarboardGuildSettings, "guildId">>,
): Promise<StarboardGuildSettings> {
  const prisma = getPrisma();

  const dbData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "ignoredChannels") {
      dbData[key] = JSON.stringify(value);
    } else {
      dbData[key] = value;
    }
  }

  const row = await prisma.starboardGuildSettings.upsert({
    where: { guildId },
    create: { guildId, ...dbData },
    update: dbData,
  });
  return rowToSettings(row);
}
