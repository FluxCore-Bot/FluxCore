import { logger } from "@fluxcore/utils";
import { reloadGuild } from "./cache.js";
import { loadActionGuildSettings } from "./config.js";

const POLL_INTERVAL_MS = 10_000;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastCheckedId = 0;

async function pollInvalidations(): Promise<void> {
  try {
    const { getPrisma } = await import("@fluxcore/database");
    const prisma = getPrisma();
    const records = await prisma.actionCacheInvalidation.findMany({
      where: { id: { gt: lastCheckedId } },
      orderBy: { id: "asc" },
    });

    if (records.length === 0) return;

    const guildsToReload = new Set<string>();
    let needSettingsReload = false;

    for (const record of records) {
      if (record.action === "reloadSettings") {
        needSettingsReload = true;
      }
      guildsToReload.add(record.guildId);
      lastCheckedId = record.id;
    }

    if (needSettingsReload) {
      await loadActionGuildSettings();
    }

    for (const guildId of guildsToReload) {
      await reloadGuild(guildId);
    }

    if (guildsToReload.size > 0) {
      logger.debug(
        `Cache sync: reloaded ${guildsToReload.size} guild(s) from ${records.length} invalidation(s)`,
      );
    }

    // Clean up old invalidation records (older than 1 hour)
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.actionCacheInvalidation.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
  } catch (error) {
    logger.error(
      "Cache sync poll failed",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

export async function startCacheSyncPolling(): Promise<void> {
  if (pollTimer) return;
  try {
    const { getPrisma } = await import("@fluxcore/database");
    const prisma = getPrisma();
    const result = await prisma.actionCacheInvalidation.aggregate({
      _max: { id: true },
    });
    lastCheckedId = result._max.id ?? 0;
    pollTimer = setInterval(pollInvalidations, POLL_INTERVAL_MS);
    logger.info("Started action cache sync polling");
  } catch (err) {
    logger.error(
      "Failed to initialize cache sync polling",
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}

export function stopCacheSyncPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
