import type { Guild } from "discord.js";
import { getLevelRewards } from "./config.js";
import { logger } from "@fluxcore/utils";

/**
 * Check and grant role rewards for a user at or below the given level.
 * Assigns any missing reward roles to the member.
 */
export async function checkAndGrantRewards(
  guild: Guild,
  userId: string,
  newLevel: number,
): Promise<void> {
  const rewards = await getLevelRewards(guild.id);
  const applicable = rewards.filter((r) => r.level <= newLevel);

  if (applicable.length === 0) return;

  let member;
  try {
    member = await guild.members.fetch(userId);
  } catch {
    logger.debug(`Could not fetch member ${userId} for reward grant in guild ${guild.id}`);
    return;
  }

  for (const reward of applicable) {
    if (member.roles.cache.has(reward.roleId)) continue;

    try {
      await member.roles.add(reward.roleId, `Level reward: reached level ${reward.level}`);
      logger.debug(`Granted role ${reward.roleId} to ${userId} for level ${reward.level}`);
    } catch (error) {
      logger.warn(
        `Failed to grant reward role ${reward.roleId} to ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
