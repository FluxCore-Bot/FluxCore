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
}

/**
 * Clear all cached data for a guild (channels, roles, bot presence).
 */
export function invalidateGuildCache(guildId: string): void {
  cache.delete(`guild:${guildId}`);
  cache.delete(`channels:${guildId}`);
  cache.delete(`roles:${guildId}`);
}

/**
 * Check if the bot is a member of the given guild.
 */
export async function isBotInGuild(guildId: string): Promise<boolean> {
  const cacheKey = `guild:${guildId}`;
  const cached = getCached<boolean>(cacheKey);
  if (cached !== undefined) return cached;

  const guild = await botFetch(`/guilds/${guildId}`);
  const result = guild !== null;
  setCache(cacheKey, result);
  return result;
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
