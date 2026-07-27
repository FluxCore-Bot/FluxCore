import { config } from "@fluxcore/config";
import { logger } from "@fluxcore/utils";

const DISCORD_API = "https://discord.com/api/v10";

// --- Simple TTL cache ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 60_000; // 60 seconds

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

// Periodic cleanup to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) cache.delete(key);
  }
}, 5 * 60_000).unref();

// --- Bot-authenticated fetch helper ---

async function botFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bot ${config.token}` },
  });
  if (!res.ok) {
    if (res.status === 404 || res.status === 403) return null;
    logger.error(
      `Discord API error: ${res.status} on ${path}`,
      new Error(`Status ${res.status}`),
    );
    return null;
  }
  return res.json() as Promise<T>;
}

// --- Public API ---

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  /** Permission bitfield for the role, as a decimal string. */
  permissions: string;
}

export interface DiscordGuildMember {
  /** IDs of the roles assigned to the member. */
  roles: string[];
  /** Guild-specific nickname, when set. */
  nick?: string | null;
  /**
   * The underlying user. Present on the real payload; typed optional because
   * this shape is also used for live authorization, where only `roles` is read.
   */
  user?: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };
}

/**
 * Clear all cached data for a guild (channels, roles, owner, bot presence,
 * and every cached member entry for that guild).
 */
export function invalidateGuildCache(guildId: string): void {
  cache.delete(`guild:${guildId}`);
  cache.delete(`guild_owner:${guildId}`);
  cache.delete(`channels:${guildId}`);
  cache.delete(`roles:${guildId}`);

  const memberPrefix = `member:${guildId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(memberPrefix)) cache.delete(key);
  }
}

interface DiscordGuild {
  id: string;
  owner_id: string;
}

/**
 * Check if the bot is a member of the given guild.
 */
export async function isBotInGuild(guildId: string): Promise<boolean> {
  const cacheKey = `guild:${guildId}`;
  const cached = getCached<boolean>(cacheKey);
  if (cached !== undefined) return cached;

  const guild = await botFetch<DiscordGuild>(`/guilds/${guildId}`);
  const result = guild !== null;
  setCache(cacheKey, result);
  if (guild) setCache(`guild_owner:${guildId}`, guild.owner_id);
  return result;
}

/**
 * Get the owner ID of a guild.
 */
export async function getGuildOwnerId(guildId: string): Promise<string | null> {
  const cacheKey = `guild_owner:${guildId}`;
  const cached = getCached<string>(cacheKey);
  if (cached !== undefined) return cached;

  const guild = await botFetch<DiscordGuild>(`/guilds/${guildId}`);
  if (!guild) return null;
  setCache(cacheKey, guild.owner_id);
  setCache(`guild:${guildId}`, true);
  return guild.owner_id;
}

/**
 * Get channels for a guild. Returns empty array if bot is not in guild.
 */
export async function getGuildChannels(
  guildId: string,
): Promise<DiscordChannel[]> {
  const cacheKey = `channels:${guildId}`;
  const cached = getCached<DiscordChannel[]>(cacheKey);
  if (cached !== undefined) return cached;

  const channels = await botFetch<DiscordChannel[]>(
    `/guilds/${guildId}/channels`,
  );
  const result = channels ?? [];
  setCache(cacheKey, result);
  return result;
}

/**
 * Get a guild member (their assigned role IDs) via the bot token.
 * Returns null when the user is not a member of the guild (404) — used for
 * live authorization, so it is authoritative and independent of the user's
 * cached OAuth session. Caches the result (including "not a member") briefly.
 */
export async function getGuildMember(
  guildId: string,
  userId: string,
): Promise<DiscordGuildMember | null> {
  const cacheKey = `member:${guildId}:${userId}`;
  const cached = getCached<DiscordGuildMember | null>(cacheKey);
  if (cached !== undefined) return cached;

  const member = await botFetch<DiscordGuildMember>(
    `/guilds/${guildId}/members/${userId}`,
  );
  setCache(cacheKey, member);
  return member;
}

/**
 * Get roles for a guild. Returns empty array if bot is not in guild.
 */
export async function getGuildRoles(guildId: string): Promise<DiscordRole[]> {
  const cacheKey = `roles:${guildId}`;
  const cached = getCached<DiscordRole[]>(cacheKey);
  if (cached !== undefined) return cached;

  const roles = await botFetch<DiscordRole[]>(`/guilds/${guildId}/roles`);
  const result = roles ?? [];
  setCache(cacheKey, result);
  return result;
}

export interface DiscordGuildMemberSummary {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

/**
 * Search a guild's members by name prefix, via the bot token.
 *
 * Exists so trigger filters can offer a real member picker: before this there
 * was no members endpoint anywhere in the dashboard, so the only way to filter
 * by member was to paste a raw 17-20 digit snowflake, and saved filters
 * rendered as bare digits.
 *
 * Uses Discord's `members/search`, which needs the GUILD_MEMBERS intent (the
 * bot already declares it). Results are cached per (guild, query) on the same
 * short TTL as the channel and role lookups.
 */
export async function searchGuildMembers(
  guildId: string,
  query: string,
  limit = 25,
): Promise<DiscordGuildMemberSummary[]> {
  const trimmed = query.trim().slice(0, 100);
  if (trimmed.length === 0) return [];

  const cacheKey = `members:${guildId}:${trimmed.toLowerCase()}:${limit}`;
  const cached = getCached<DiscordGuildMemberSummary[]>(cacheKey);
  if (cached !== undefined) return cached;

  const raw = await botFetch<
    Array<{
      nick?: string | null;
      user: { id: string; username: string; global_name?: string | null; avatar: string | null };
    }>
  >(
    `/guilds/${guildId}/members/search?query=${encodeURIComponent(trimmed)}&limit=${limit}`,
  );

  const members: DiscordGuildMemberSummary[] = (raw ?? []).map((m) => ({
    id: m.user.id,
    username: m.user.username,
    displayName: m.nick ?? m.user.global_name ?? m.user.username,
    avatar: m.user.avatar,
  }));
  setCache(cacheKey, members);
  return members;
}

/**
 * Resolve specific member ids to names, so a saved filter can render as
 * "Ada" rather than "123456789012345678". Missing members (left the guild,
 * deleted account) are simply absent from the result.
 */
export async function getGuildMembersByIds(
  guildId: string,
  ids: string[],
): Promise<DiscordGuildMemberSummary[]> {
  const unique = Array.from(new Set(ids)).slice(0, 50);
  const results = await Promise.all(
    unique.map(async (id) => {
      const member = await getGuildMember(guildId, id);
      if (!member?.user) return null;
      return {
        id: member.user.id,
        username: member.user.username,
        displayName: member.nick ?? member.user.global_name ?? member.user.username,
        avatar: member.user.avatar ?? null,
      } satisfies DiscordGuildMemberSummary;
    }),
  );
  return results.filter((m): m is DiscordGuildMemberSummary => m !== null);
}

/**
 * Check if a specific channel exists in a guild.
 * Reuses the channels cache, so no extra API call if channels were recently fetched.
 */
export async function channelExistsInGuild(
  guildId: string,
  channelId: string,
): Promise<boolean> {
  const channels = await getGuildChannels(guildId);
  return channels.some((ch) => ch.id === channelId);
}
