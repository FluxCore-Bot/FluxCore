import { getPrisma } from "@fluxcore/database";
import type { AntiRaidConfig, RaidAction } from "./types.js";
import { DEFAULT_CONFIG } from "./constants.js";

function rowToConfig(row: {
  guildId: string;
  enabled: boolean;
  joinThreshold: number;
  joinWindow: number;
  joinAction: string;
  accountAgeMinDays: number;
  accountAgeAction: string;
  antiNukeEnabled: boolean;
  antiNukeThreshold: number;
  lockdownOnRaid: boolean;
  whitelistedRoleIds: string;
  logChannelId: string | null;
}): AntiRaidConfig {
  return {
    guildId: row.guildId,
    enabled: row.enabled,
    joinThreshold: row.joinThreshold,
    joinWindow: row.joinWindow,
    joinAction: row.joinAction as RaidAction,
    accountAgeMinDays: row.accountAgeMinDays,
    accountAgeAction: row.accountAgeAction as RaidAction,
    antiNukeEnabled: row.antiNukeEnabled,
    antiNukeThreshold: row.antiNukeThreshold,
    lockdownOnRaid: row.lockdownOnRaid,
    whitelistedRoleIds: JSON.parse(row.whitelistedRoleIds) as string[],
    logChannelId: row.logChannelId,
  };
}

// In-memory cache for hot path access during raid detection
const configCache = new Map<string, AntiRaidConfig>();

export async function getAntiRaidConfig(guildId: string): Promise<AntiRaidConfig> {
  const cached = configCache.get(guildId);
  if (cached) return cached;

  const prisma = getPrisma();
  const row = await prisma.antiRaidConfig.findUnique({ where: { guildId } });
  if (!row) {
    const defaults = { guildId, ...DEFAULT_CONFIG };
    return defaults;
  }

  const config = rowToConfig(row);
  configCache.set(guildId, config);
  return config;
}

export async function upsertAntiRaidConfig(
  guildId: string,
  data: Partial<Omit<AntiRaidConfig, "guildId">>,
): Promise<AntiRaidConfig> {
  const prisma = getPrisma();

  const dbData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "whitelistedRoleIds") {
      dbData[key] = JSON.stringify(value);
    } else {
      dbData[key] = value;
    }
  }

  const row = await prisma.antiRaidConfig.upsert({
    where: { guildId },
    create: { guildId, ...dbData },
    update: dbData,
  });

  const config = rowToConfig(row);
  configCache.set(guildId, config);
  return config;
}

export function invalidateAntiRaidCache(guildId: string): void {
  configCache.delete(guildId);
}
