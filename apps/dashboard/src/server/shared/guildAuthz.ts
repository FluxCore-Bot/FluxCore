import {
  getGuildOwnerId,
  getGuildMember,
  getGuildRoles,
  type DiscordRole,
} from "./discordApi.js";
import { canManageGuild } from "./guildPermissions.js";

/**
 * Compute a member's base guild-level permission bitfield from their roles
 * (@everyone + assigned roles), ignoring channel overwrites. The @everyone
 * role always shares the guild's ID.
 */
function computeBasePermissions(
  guildId: string,
  memberRoleIds: string[],
  guildRoles: DiscordRole[],
): bigint {
  const byId = new Map(guildRoles.map((r) => [r.id, r]));

  let perms = BigInt(byId.get(guildId)?.permissions ?? "0");
  for (const roleId of memberRoleIds) {
    const role = byId.get(roleId);
    if (role) perms |= BigInt(role.permissions);
  }
  return perms;
}

/**
 * Authoritative, LIVE check of whether a user currently has admin authority
 * (owner, Administrator, or Manage Server) in a guild, computed from the bot's
 * view of Discord.
 *
 * Unlike the OAuth session snapshot (captured at login and refreshed lazily),
 * this reflects Discord's current state, so revoked access is honored — subject
 * only to the short discordApi cache TTL. This is the source of truth for the
 * dashboard's guild-admin gate.
 */
export async function isUserGuildAdmin(
  guildId: string,
  userId: string,
): Promise<boolean> {
  const ownerId = await getGuildOwnerId(guildId);
  if (ownerId === userId) return true;

  const member = await getGuildMember(guildId, userId);
  if (!member) return false; // left/kicked → no authority

  const roles = await getGuildRoles(guildId);
  const perms = computeBasePermissions(guildId, member.roles, roles);
  return canManageGuild(perms.toString());
}
