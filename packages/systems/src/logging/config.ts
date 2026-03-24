import { getPrisma } from "@fluxcore/database";
import { logger } from "@fluxcore/utils";
import type { LogCategory, LogGuildConfig } from "./types.js";

/** In-memory cache: guildId -> category -> config */
const configCache: Map<string, Map<LogCategory, LogGuildConfig>> = new Map();

function parseJsonArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // invalid JSON — return empty array
  }
  return [];
}

function rowToConfig(row: {
  id: number;
  guildId: string;
  category: string;
  channelId: string;
  enabled: boolean;
  ignoredChannels: string;
  ignoredRoles: string;
  enabledEvents: string;
}): LogGuildConfig {
  return {
    id: row.id,
    guildId: row.guildId,
    category: row.category as LogCategory,
    channelId: row.channelId,
    enabled: row.enabled,
    ignoredChannels: parseJsonArray(row.ignoredChannels),
    ignoredRoles: parseJsonArray(row.ignoredRoles),
    enabledEvents: parseJsonArray(row.enabledEvents),
  };
}

/** Load all log configs for a guild into cache. */
export async function loadLogConfigs(guildId: string): Promise<LogGuildConfig[]> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.logGuildConfig.findMany({ where: { guildId } });
    const guildMap = new Map<LogCategory, LogGuildConfig>();
    const configs: LogGuildConfig[] = [];
    for (const row of rows) {
      const config = rowToConfig(row);
      guildMap.set(config.category, config);
      configs.push(config);
    }
    configCache.set(guildId, guildMap);
    return configs;
  } catch (error) {
    logger.error(
      `Failed to load log configs for guild ${guildId}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    return [];
  }
}

/** Get a log config for a specific guild + category. Loads from DB on cache miss. */
export async function getLogConfig(
  guildId: string,
  category: LogCategory,
): Promise<LogGuildConfig | null> {
  const guildMap = configCache.get(guildId);
  if (guildMap) {
    return guildMap.get(category) ?? null;
  }
  // Cache miss — load all configs for this guild
  await loadLogConfigs(guildId);
  return configCache.get(guildId)?.get(category) ?? null;
}

/** Create or update a log config for a guild + category. */
export async function upsertLogConfig(
  guildId: string,
  category: LogCategory,
  data: {
    channelId: string;
    enabled?: boolean;
    ignoredChannels?: string[];
    ignoredRoles?: string[];
    enabledEvents?: string[];
  },
): Promise<LogGuildConfig> {
  const prisma = getPrisma();
  const row = await prisma.logGuildConfig.upsert({
    where: { guildId_category: { guildId, category } },
    create: {
      guildId,
      category,
      channelId: data.channelId,
      enabled: data.enabled ?? true,
      ignoredChannels: JSON.stringify(data.ignoredChannels ?? []),
      ignoredRoles: JSON.stringify(data.ignoredRoles ?? []),
      enabledEvents: JSON.stringify(data.enabledEvents ?? []),
    },
    update: {
      channelId: data.channelId,
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.ignoredChannels !== undefined && { ignoredChannels: JSON.stringify(data.ignoredChannels) }),
      ...(data.ignoredRoles !== undefined && { ignoredRoles: JSON.stringify(data.ignoredRoles) }),
      ...(data.enabledEvents !== undefined && { enabledEvents: JSON.stringify(data.enabledEvents) }),
    },
  });
  const config = rowToConfig(row);

  // Update cache
  let guildMap = configCache.get(guildId);
  if (!guildMap) {
    guildMap = new Map();
    configCache.set(guildId, guildMap);
  }
  guildMap.set(category, config);

  return config;
}

/** Check whether a channel or member roles should be ignored by this log config. */
export function isIgnored(
  config: LogGuildConfig,
  channelId?: string | null,
  memberRoles?: { cache: Map<string, unknown> } | string[] | null,
): boolean {
  // Check ignored channels
  if (channelId && config.ignoredChannels.includes(channelId)) {
    return true;
  }

  // Check ignored roles
  if (memberRoles && config.ignoredRoles.length > 0) {
    if (Array.isArray(memberRoles)) {
      return memberRoles.some((roleId) => config.ignoredRoles.includes(roleId));
    }
    // discord.js RoleManager with cache
    if ("cache" in memberRoles) {
      for (const roleId of config.ignoredRoles) {
        if (memberRoles.cache.has(roleId)) return true;
      }
    }
  }

  return false;
}
