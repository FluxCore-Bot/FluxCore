import type { GuildMember } from "discord.js";
import { getPrisma } from "@fluxcore/database";
import { logger } from "@fluxcore/utils";

export async function checkAndExecutePunishment(
  guildId: string,
  userId: string,
  warnCount: number,
  member: GuildMember,
): Promise<{ triggered: boolean; action?: string; threshold?: number }> {
  const prisma = getPrisma();
  // Find matching punishment threshold
  const punishment = await prisma.warnPunishment.findFirst({
    where: { guildId, threshold: { lte: warnCount } },
    orderBy: { threshold: "desc" },
  });

  if (!punishment) return { triggered: false };

  // Only execute if warnCount exactly matches threshold (to avoid re-triggering)
  if (punishment.threshold !== warnCount) return { triggered: false };

  try {
    switch (punishment.action) {
      case "timeout":
        await member.timeout((punishment.duration ?? 3600) * 1000, `Warn escalation: ${warnCount} warnings`);
        break;
      case "kick":
        await member.kick(`Warn escalation: ${warnCount} warnings`);
        break;
      case "ban":
        await member.ban({ reason: `Warn escalation: ${warnCount} warnings` });
        break;
    }
    return { triggered: true, action: punishment.action, threshold: punishment.threshold };
  } catch (error) {
    logger.error(
      `Failed to execute warn escalation for ${userId}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    return { triggered: false };
  }
}
