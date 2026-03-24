import type { Client } from "discord.js";
import { logger } from "@fluxcore/utils";
import { getExpiredTempbans, deactivateModCase } from "./persistence.js";
import { TEMPBAN_CHECK_INTERVAL_MS } from "./constants.js";

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export async function checkExpiredTempbans(client: Client): Promise<void> {
  const expired = await getExpiredTempbans();
  for (const modCase of expired) {
    try {
      const guild = await client.guilds.fetch(modCase.guildId);
      await guild.members.unban(modCase.targetId, "Tempban expired");
      await deactivateModCase(modCase.id);
      logger.debug(`Unbanned ${modCase.targetId} in ${modCase.guildId} (tempban expired)`);
    } catch (error) {
      logger.error(`Failed to unban ${modCase.targetId}`, error instanceof Error ? error : new Error(String(error)));
      // Still deactivate to prevent retry loops
      await deactivateModCase(modCase.id).catch(() => {});
    }
  }
}

export function startTempbanScheduler(client: Client): void {
  // Run immediately on startup
  checkExpiredTempbans(client).catch((err: unknown) =>
    logger.error("Tempban check failed", err instanceof Error ? err : new Error(String(err)))
  );

  schedulerTimer = setInterval(() => {
    checkExpiredTempbans(client).catch((err: unknown) =>
      logger.error("Tempban check failed", err instanceof Error ? err : new Error(String(err)))
    );
  }, TEMPBAN_CHECK_INTERVAL_MS);
  (schedulerTimer as unknown as { unref: () => void }).unref();
}

export function stopTempbanScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
