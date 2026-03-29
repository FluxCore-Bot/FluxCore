import type { Guild, GuildMember } from "discord.js";
import { logger } from "@fluxcore/utils";
import type { RaidAction } from "./types.js";
import { DEFAULT_TIMEOUT_DURATION_MS } from "./constants.js";
import { setLockdownState } from "./tracker.js";

/**
 * Execute a raid action on a guild member.
 */
export async function executeRaidAction(
  member: GuildMember,
  action: RaidAction,
  reason: string,
): Promise<boolean> {
  try {
    switch (action) {
      case "kick":
        if (member.kickable) {
          await member.kick(`[Anti-Raid] ${reason}`);
          return true;
        }
        break;
      case "ban":
        if (member.bannable) {
          await member.ban({ reason: `[Anti-Raid] ${reason}`, deleteMessageSeconds: 0 });
          return true;
        }
        break;
      case "timeout":
        if (member.moderatable) {
          await member.timeout(DEFAULT_TIMEOUT_DURATION_MS, `[Anti-Raid] ${reason}`);
          return true;
        }
        break;
    }
    return false;
  } catch (error) {
    logger.error(
      `Failed to execute raid action ${action} on ${member.id} in guild ${member.guild.id}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    return false;
  }
}

/**
 * Lock all text channels in a guild by denying SendMessages for @everyone.
 */
export async function lockdownGuild(guild: Guild, reason: string): Promise<number> {
  const channels = guild.channels.cache.filter((c) => c.isTextBased() && !c.isDMBased());
  let locked = 0;

  for (const [, channel] of channels) {
    if (!("permissionOverwrites" in channel)) continue;
    try {
      await channel.permissionOverwrites.edit(
        guild.roles.everyone,
        { SendMessages: false },
        { reason: `[Anti-Raid Lockdown] ${reason}` },
      );
      locked++;
    } catch {
      // Channel may not be manageable, skip silently
    }
  }

  setLockdownState(guild.id, true);
  return locked;
}

/**
 * Lift lockdown by resetting SendMessages permission for @everyone.
 */
export async function liftLockdown(guild: Guild): Promise<number> {
  const channels = guild.channels.cache.filter((c) => c.isTextBased() && !c.isDMBased());
  let unlocked = 0;

  for (const [, channel] of channels) {
    if (!("permissionOverwrites" in channel)) continue;
    try {
      await channel.permissionOverwrites.edit(
        guild.roles.everyone,
        { SendMessages: null },
        { reason: "Anti-Raid lockdown lifted" },
      );
      unlocked++;
    } catch {
      // Skip silently
    }
  }

  setLockdownState(guild.id, false);
  return unlocked;
}

/**
 * Quarantine a suspected nuke executor by removing all their roles.
 */
export async function quarantineExecutor(
  guild: Guild,
  executorId: string,
  reason: string,
): Promise<boolean> {
  try {
    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member) return false;

    const rolesToRemove = member.roles.cache.filter(
      (role) => role.id !== guild.roles.everyone.id && role.editable,
    );

    if (rolesToRemove.size > 0) {
      await member.roles.remove(rolesToRemove, `[Anti-Nuke] ${reason}`);
    }

    return true;
  } catch (error) {
    logger.error(
      `Failed to quarantine executor ${executorId} in guild ${guild.id}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    return false;
  }
}
