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

/** A user's live authority in a guild, from the bot's view of Discord. */
export interface GuildAuthority {
  isOwner: boolean;
  /** Owner, Administrator, or Manage Server. */
  isAdmin: boolean;
  /** Currently in the guild at all. */
  isMember: boolean;
}

/**
 * Authoritative, LIVE authority check, computed from the bot's view of Discord
 * rather than the OAuth session snapshot, so access revoked on Discord is
 * honored — subject only to the short discordApi cache TTL.
 *
 * Answers owner / admin / member in one member fetch, because the delegated
 * (non-admin) permission path needs membership and the admin path needs both.
 */
export async function getGuildAuthority(
  guildId: string,
  userId: string,
): Promise<GuildAuthority> {
  const ownerId = await getGuildOwnerId(guildId);
  if (ownerId === userId) {
    return { isOwner: true, isAdmin: true, isMember: true };
  }

  const member = await getGuildMember(guildId, userId);
  if (!member) {
    return { isOwner: false, isAdmin: false, isMember: false };
  }

  const roles = await getGuildRoles(guildId);
  const perms = computeBasePermissions(guildId, member.roles, roles);
  return {
    isOwner: false,
    isAdmin: canManageGuild(perms.toString()),
    isMember: true,
  };
}

/**
 * True when the user currently has admin authority (owner, Administrator, or
 * Manage Server) in the guild. Thin wrapper over {@link getGuildAuthority}.
 */
export async function isUserGuildAdmin(
  guildId: string,
  userId: string,
): Promise<boolean> {
  const { isAdmin } = await getGuildAuthority(guildId, userId);
  return isAdmin;
}
