import { getPrisma } from "@fluxcore/database";
import type { MusicGuildSettings, MusicMode } from "./types.js";
import { DEFAULT_VOLUME, DEFAULT_AUTO_DISCONNECT_SECS } from "./constants.js";
import { logger } from "@fluxcore/utils";

const settingsCache: Map<string, MusicGuildSettings> = new Map();

type SettingsChangeCallback = (
  guildId: string,
  oldSettings: MusicGuildSettings,
  newSettings: MusicGuildSettings,
) => void | Promise<void>;

let onChangeCallback: SettingsChangeCallback | null = null;

/** Register a callback invoked whenever a guild's music settings change. */
export function onMusicSettingsChanged(cb: SettingsChangeCallback): void {
  onChangeCallback = cb;
}

function settingsEqual(a: MusicGuildSettings, b: MusicGuildSettings): boolean {
  return (
    a.mode === b.mode &&
    a.djRoleId === b.djRoleId &&
    a.defaultVolume === b.defaultVolume &&
    a.maxQueueSize === b.maxQueueSize &&
    a.autoDisconnectSecs === b.autoDisconnectSecs &&
    a.twentyFourSeven === b.twentyFourSeven &&
    a.lastChannelId === b.lastChannelId
  );
}

const DEFAULT_SETTINGS: Omit<MusicGuildSettings, "guildId"> = {
  mode: "open",
  djRoleId: null,
  defaultVolume: DEFAULT_VOLUME,
  maxQueueSize: 100,
  autoDisconnectSecs: DEFAULT_AUTO_DISCONNECT_SECS,
  twentyFourSeven: false,
  lastChannelId: null,
};

function rowToSettings(row: {
  guildId: string;
  mode: string;
  djRoleId: string | null;
  defaultVolume: number;
  maxQueueSize: number;
  autoDisconnectSecs: number;
  twentyFourSeven: boolean;
  lastChannelId: string | null;
}): MusicGuildSettings {
  return {
    guildId: row.guildId,
    mode: row.mode as MusicMode,
    djRoleId: row.djRoleId,
    defaultVolume: row.defaultVolume,
    maxQueueSize: row.maxQueueSize,
    autoDisconnectSecs: row.autoDisconnectSecs,
    twentyFourSeven: row.twentyFourSeven,
    lastChannelId: row.lastChannelId,
  };
}

export async function loadMusicSettings(): Promise<void> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.musicGuildSettings.findMany();
    settingsCache.clear();
    for (const row of rows) {
      settingsCache.set(row.guildId, rowToSettings(row));
    }
    logger.info(`Loaded music settings for ${settingsCache.size} guild(s)`);
    if (settingsCache.size > 1000) {
      logger.warn(
        `Music settings cache contains ${settingsCache.size} guilds. Consider implementing lazy loading for better startup performance.`,
      );
    }
  } catch (error) {
    logger.error(
      "Failed to load music settings from database",
      error instanceof Error ? error : new Error(String(error)),
    );
    settingsCache.clear();
  }
}

/** Reload settings for a single guild, triggering the change callback if they differ. */
export async function loadMusicSettingsForGuild(guildId: string): Promise<void> {
  try {
    const prisma = getPrisma();
    const row = await prisma.musicGuildSettings.findUnique({ where: { guildId } });
    const oldSettings = settingsCache.get(guildId) ?? { guildId, ...DEFAULT_SETTINGS };
    const newSettings = row ? rowToSettings(row) : { guildId, ...DEFAULT_SETTINGS };

    if (row) {
      settingsCache.set(guildId, newSettings);
    } else {
      settingsCache.delete(guildId);
    }

    if (onChangeCallback && !settingsEqual(oldSettings, newSettings)) {
      try {
        await onChangeCallback(guildId, oldSettings, newSettings);
      } catch (err) {
        logger.error(
          `Music settings change callback failed for guild ${guildId}`,
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    }
  } catch (error) {
    logger.error(
      `Failed to reload music settings for guild ${guildId}`,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

export function getMusicSettings(guildId: string): MusicGuildSettings {
  return settingsCache.get(guildId) ?? { guildId, ...DEFAULT_SETTINGS };
}

/** Read settings directly from the database, bypassing the in-memory cache. */
export async function fetchMusicSettings(guildId: string): Promise<MusicGuildSettings> {
  const prisma = getPrisma();
  const row = await prisma.musicGuildSettings.findUnique({ where: { guildId } });
  if (!row) return { guildId, ...DEFAULT_SETTINGS };
  return rowToSettings(row);
}

export async function upsertMusicSettings(
  guildId: string,
  data: Partial<Omit<MusicGuildSettings, "guildId">>,
): Promise<MusicGuildSettings> {
  const prisma = getPrisma();
  const row = await prisma.musicGuildSettings.upsert({
    where: { guildId },
    create: {
      guildId,
      ...data,
    },
    update: data,
  });
  const settings = rowToSettings(row);
  settingsCache.set(guildId, settings);
  return settings;
}

export function getAllMusicGuildIds(): string[] {
  return [...settingsCache.keys()];
}

export function get247Guilds(): MusicGuildSettings[] {
  return [...settingsCache.values()].filter((s) => s.twentyFourSeven && s.lastChannelId);
}
