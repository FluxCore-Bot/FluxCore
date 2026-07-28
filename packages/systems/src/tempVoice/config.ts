import { getPrisma } from "@fluxcore/database";
import type { TempVoiceGuildConfig } from "./types.js";
import { logger } from "@fluxcore/utils";

/** guildId → array of configs for that guild */
let guildConfigsCache: Map<string, TempVoiceGuildConfig[]> = new Map();

/** hubChannelId → the config that owns that hub channel (for fast event lookups) */
let hubChannelIndex: Map<string, TempVoiceGuildConfig> = new Map();

/** Database row → the shape the rest of the codebase passes around */
function toConfig(row: {
  id: number;
  hubChannelId: string;
  categoryId: string | null;
  nameTemplate: string;
}): TempVoiceGuildConfig {
  return {
    id: row.id,
    hubChannelId: row.hubChannelId,
    categoryId: row.categoryId,
    nameTemplate: row.nameTemplate,
  };
}

/**
 * Read a guild's configs straight from the database.
 *
 * The in-memory cache below is only populated by the bot process (ready.ts calls
 * loadTempVoiceConfig). Any other process — the dashboard API — must read through
 * to Postgres, which is the single source of truth.
 */
export async function fetchGuildConfigs(
  guildId: string,
): Promise<TempVoiceGuildConfig[]> {
  const rows = await getPrisma().tempVoiceGuildConfig.findMany({
    where: { guildId },
    orderBy: { id: "asc" },
  });
  return rows.map(toConfig);
}

/** Look up the config owning a hub channel, straight from the database. */
export async function fetchConfigByHubChannel(
  hubChannelId: string,
): Promise<TempVoiceGuildConfig | null> {
  const row = await getPrisma().tempVoiceGuildConfig.findUnique({
    where: { hubChannelId },
  });
  return row ? toConfig(row) : null;
}

export async function loadTempVoiceConfig(): Promise<void> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.tempVoiceGuildConfig.findMany();
    guildConfigsCache = new Map();
    hubChannelIndex = new Map();
    for (const row of rows) {
      const config: TempVoiceGuildConfig = {
        id: row.id,
        hubChannelId: row.hubChannelId,
        categoryId: row.categoryId,
        nameTemplate: row.nameTemplate,
      };
      const existing = guildConfigsCache.get(row.guildId) ?? [];
      existing.push(config);
      guildConfigsCache.set(row.guildId, existing);
      hubChannelIndex.set(row.hubChannelId, config);
    }
    const totalConfigs = rows.length;
    const totalGuilds = guildConfigsCache.size;
    logger.info(
      `Loaded ${totalConfigs} temp voice config(s) across ${totalGuilds} guild(s)`,
    );
  } catch (error) {
    logger.error(
      "Failed to load temp voice config from database",
      error instanceof Error ? error : new Error(String(error)),
    );
    guildConfigsCache = new Map();
    hubChannelIndex = new Map();
  }
}

/** Get the config that owns a specific hub channel (used in voiceStateUpdate) */
export function getConfigByHubChannel(
  hubChannelId: string,
): TempVoiceGuildConfig | undefined {
  return hubChannelIndex.get(hubChannelId);
}

/** Get all configs for a guild */
export function getGuildConfigs(guildId: string): TempVoiceGuildConfig[] {
  return guildConfigsCache.get(guildId) ?? [];
}

/** Add a new config. Returns the persisted config with its id. */
export async function addGuildConfig(
  guildId: string,
  config: Omit<TempVoiceGuildConfig, "id">,
): Promise<TempVoiceGuildConfig> {
  const prisma = getPrisma();
  const row = await prisma.tempVoiceGuildConfig.create({
    data: {
      guildId,
      hubChannelId: config.hubChannelId,
      categoryId: config.categoryId,
      nameTemplate: config.nameTemplate,
    },
  });
  const created: TempVoiceGuildConfig = {
    id: row.id,
    hubChannelId: row.hubChannelId,
    categoryId: row.categoryId,
    nameTemplate: row.nameTemplate,
  };
  const existing = guildConfigsCache.get(guildId) ?? [];
  existing.push(created);
  guildConfigsCache.set(guildId, existing);
  hubChannelIndex.set(created.hubChannelId, created);
  return created;
}

/** Update an existing config */
export async function updateGuildConfig(
  guildId: string,
  configId: number,
  updates: Partial<Omit<TempVoiceGuildConfig, "id">>,
): Promise<TempVoiceGuildConfig> {
  const prisma = getPrisma();
  const row = await prisma.tempVoiceGuildConfig.update({
    where: { id: configId, guildId },
    data: {
      ...(updates.hubChannelId !== undefined && {
        hubChannelId: updates.hubChannelId,
      }),
      ...(updates.categoryId !== undefined && {
        categoryId: updates.categoryId,
      }),
      ...(updates.nameTemplate !== undefined && {
        nameTemplate: updates.nameTemplate,
      }),
    },
  });
  const updated: TempVoiceGuildConfig = {
    id: row.id,
    hubChannelId: row.hubChannelId,
    categoryId: row.categoryId,
    nameTemplate: row.nameTemplate,
  };
  const configs = guildConfigsCache.get(guildId) ?? [];
  const idx = configs.findIndex((c) => c.id === configId);
  if (idx !== -1) {
    hubChannelIndex.delete(configs[idx].hubChannelId);
    configs[idx] = updated;
  }
  hubChannelIndex.set(updated.hubChannelId, updated);
  return updated;
}

/** Remove a specific config by its id. Returns true if found & removed. */
export async function removeGuildConfig(
  guildId: string,
  configId: number,
): Promise<boolean> {
  // Delete against the database, not the cache: only the bot process has a
  // populated cache, and the row is what actually has to go.
  const prisma = getPrisma();
  const { count } = await prisma.tempVoiceGuildConfig.deleteMany({
    where: { id: configId, guildId },
  });
  if (count === 0) return false;

  const configs = guildConfigsCache.get(guildId);
  if (configs) {
    const idx = configs.findIndex((c) => c.id === configId);
    if (idx !== -1) {
      hubChannelIndex.delete(configs[idx].hubChannelId);
      configs.splice(idx, 1);
      if (configs.length === 0) {
        guildConfigsCache.delete(guildId);
      }
    }
  }
  return true;
}

/** Reload a single guild's temp voice configs from the database. */
export async function reloadGuildTempVoiceConfig(
  guildId: string,
): Promise<void> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.tempVoiceGuildConfig.findMany({
      where: { guildId },
    });

    // Remove old hub channel index entries for this guild
    const oldConfigs = guildConfigsCache.get(guildId) ?? [];
    for (const old of oldConfigs) {
      hubChannelIndex.delete(old.hubChannelId);
    }

    // Rebuild this guild's cache entries
    if (rows.length === 0) {
      guildConfigsCache.delete(guildId);
    } else {
      const configs: TempVoiceGuildConfig[] = [];
      for (const row of rows) {
        const config: TempVoiceGuildConfig = {
          id: row.id,
          hubChannelId: row.hubChannelId,
          categoryId: row.categoryId,
          nameTemplate: row.nameTemplate,
        };
        configs.push(config);
        hubChannelIndex.set(row.hubChannelId, config);
      }
      guildConfigsCache.set(guildId, configs);
    }

    logger.debug(
      `Reloaded ${rows.length} temp voice config(s) for guild ${guildId}`,
    );
  } catch (error) {
    logger.error(
      `Failed to reload temp voice config for guild ${guildId}`,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/** Get all guild IDs that have at least one config */
export function getAllConfiguredGuildIds(): string[] {
  return [...guildConfigsCache.keys()];
}
