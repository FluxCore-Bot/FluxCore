import { getPrisma } from "@fluxcore/database";
import type { TempVoiceGuildConfig } from "./types.js";
import { logger } from "@fluxcore/utils";

let configCache: Record<string, TempVoiceGuildConfig> = {};

export async function loadTempVoiceConfig(): Promise<void> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.tempVoiceGuildConfig.findMany();
    configCache = {};
    for (const row of rows) {
      configCache[row.guildId] = {
        hubChannelId: row.hubChannelId,
        categoryId: row.categoryId,
        nameTemplate: row.nameTemplate,
      };
    }
    logger.info(
      `Loaded temp voice config for ${rows.length} guild(s)`,
    );
  } catch (error) {
    logger.error(
      "Failed to load temp voice config from database",
      error instanceof Error ? error : new Error(String(error)),
    );
    configCache = {};
  }
}

export function getGuildConfig(guildId: string): TempVoiceGuildConfig | undefined {
  return configCache[guildId];
}

export async function setGuildConfig(guildId: string, config: TempVoiceGuildConfig): Promise<void> {
  const prisma = getPrisma();
  await prisma.tempVoiceGuildConfig.upsert({
    where: { guildId },
    update: {
      hubChannelId: config.hubChannelId,
      categoryId: config.categoryId,
      nameTemplate: config.nameTemplate,
    },
    create: {
      guildId,
      hubChannelId: config.hubChannelId,
      categoryId: config.categoryId,
      nameTemplate: config.nameTemplate,
    },
  });
  configCache[guildId] = config;
}

export async function removeGuildConfig(guildId: string): Promise<boolean> {
  if (!configCache[guildId]) return false;
  const prisma = getPrisma();
  await prisma.tempVoiceGuildConfig.delete({ where: { guildId } });
  delete configCache[guildId];
  return true;
}

export function getAllConfiguredGuildIds(): string[] {
  return Object.keys(configCache);
}
