import type { GuildMember } from "discord.js";
import type { LevelGuildSettings } from "./types.js";

/**
 * XP required to go from `level` to `level + 1`.
 */
export function xpForLevel(level: number): number {
  return Math.floor(5 * Math.pow(level, 2) + 50 * level + 100);
}

/**
 * Total cumulative XP required to reach a given level from level 0.
 */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

/**
 * Calculate the level from a total XP amount.
 */
export function levelFromXp(totalXp: number): number {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return level;
}

/**
 * Apply channel and role XP multipliers to a base XP amount.
 */
export function applyMultipliers(
  baseXp: number,
  settings: LevelGuildSettings,
  channelId: string,
  member: GuildMember,
): number {
  let multiplier = 1;
  const multipliers = settings.xpMultipliers;

  if (multipliers.channels?.[channelId]) {
    multiplier *= multipliers.channels[channelId];
  }

  // Check role multipliers — use the highest matching
  if (multipliers.roles) {
    const roles = multipliers.roles;
    const roleMultipliers = member.roles.cache
      .filter((r) => roles[r.id] !== undefined)
      .map((r) => roles[r.id]);

    if (roleMultipliers.length > 0) {
      multiplier *= Math.max(...roleMultipliers);
    }
  }

  return Math.floor(baseXp * multiplier);
}
