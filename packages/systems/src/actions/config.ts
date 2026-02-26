import { getPrisma } from "@fluxcore/database";
import { logger } from "@fluxcore/utils";
import { DEFAULT_MAX_RULES_PER_GUILD } from "./constants.js";
import type { ActionGuildSettings } from "./types.js";

let settingsCache: Record<string, ActionGuildSettings> = {};

export async function loadActionGuildSettings(): Promise<void> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.actionGuildSettings.findMany();
    settingsCache = {};
    for (const row of rows) {
      settingsCache[row.guildId] = {
        maxRules: row.maxRules,
        globalEnabled: row.globalEnabled,
        logChannelId: row.logChannelId,
      };
    }
    logger.info(
      `Loaded action guild settings for ${rows.length} guild(s)`,
    );
  } catch (error) {
    logger.error(
      "Failed to load action guild settings from database",
      error instanceof Error ? error : new Error(String(error)),
    );
    settingsCache = {};
  }
}

export function getGuildSettings(
  guildId: string,
): ActionGuildSettings | undefined {
  return settingsCache[guildId];
}

export function getGuildSettingsOrDefault(
  guildId: string,
): ActionGuildSettings {
  return (
    settingsCache[guildId] ?? {
      maxRules: DEFAULT_MAX_RULES_PER_GUILD,
      globalEnabled: true,
      logChannelId: null,
    }
  );
}

export async function setGuildSettings(
  guildId: string,
  settings: ActionGuildSettings,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.actionGuildSettings.upsert({
    where: { guildId },
    update: {
      maxRules: settings.maxRules,
      globalEnabled: settings.globalEnabled,
      logChannelId: settings.logChannelId,
    },
    create: {
      guildId,
      maxRules: settings.maxRules,
      globalEnabled: settings.globalEnabled,
      logChannelId: settings.logChannelId,
    },
  });
  settingsCache[guildId] = settings;
}
