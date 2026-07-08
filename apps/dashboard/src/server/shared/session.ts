import { randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyReply } from "fastify";
import { getPrisma } from "@fluxcore/database";
import { encrypt, decrypt, isEncrypted } from "./crypto.js";
import { fetchGuilds } from "./auth.js";
import { logger } from "@fluxcore/utils";

/**
 * Encrypt a Discord OAuth access token for storage.
 * ALL writes to DashboardSession.accessToken MUST go through this helper.
 */
function encryptAccessToken(token: string): string {
  if (!token) throw new Error("encryptAccessToken: empty token");
  return encrypt(token);
}

/**
 * Decrypt a stored access token, with a defensive fallback for the
 * (now-illegal) case of legacy plaintext rows: if the value does not
 * decrypt cleanly, log a security warning and refuse to use it.
 */
function decryptAccessToken(stored: string): string {
  if (!isEncrypted(stored)) {
    logger.error(
      "DashboardSession.accessToken is not encrypted; refusing to use. Run scripts/migrate-encrypt-session-tokens.ts",
    );
    throw new Error("Session token is not encrypted");
  }
  return decrypt(stored);
}

const isProduction = process.env.NODE_ENV === "production";

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export interface OAuthGuild {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
}

export interface Session {
  userId: string;
  username: string;
  avatar: string | null;
  accessToken: string;
  guilds: OAuthGuild[];
  createdAt: number;
}

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_TTL = 30_000; // 30 seconds
const GUILD_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

interface CachedSession {
  session: Session;
  cacheExpiresAt: number;
  sessionExpiresAt: number;
  guildsRefreshedAt: number;
}

const sessionCache = new Map<string, CachedSession>();

export async function createSession(
  data: Omit<Session, "createdAt">,
): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL);

  const prisma = getPrisma();
  await prisma.dashboardSession.create({
    data: {
      id,
      userId: data.userId,
      username: data.username,
      avatar: data.avatar,
      accessToken: encryptAccessToken(data.accessToken),
      guilds: JSON.stringify(data.guilds),
      guildsRefreshedAt: now,
      createdAt: now,
      expiresAt,
    },
  });

  return id;
}

export async function getSession(id: string): Promise<Session | null> {
  const cached = sessionCache.get(id);
  if (cached && cached.cacheExpiresAt > Date.now()) {
    return cached.session;
  }
  sessionCache.delete(id);

  const prisma = getPrisma();
  const row = await prisma.dashboardSession.findUnique({
    where: { id },
  });

  // Defense-in-depth: constant-time compare the supplied cookie id
  // against the stored row id, and perform a dummy decryption on the
  // not-found path so the timing of "missing", "tampered", and
  // "expired" converges.
  const suppliedBuf = Buffer.from(id, "utf8");
  const storedBuf = Buffer.from(row?.id ?? id, "utf8");
  const idsMatch =
    row !== null &&
    suppliedBuf.length === storedBuf.length &&
    timingSafeEqual(suppliedBuf, storedBuf);

  if (!row || !idsMatch) {
    // Equalise work with the success path: perform a throwaway
    // decryption so timing does not branch on row presence.
    try {
      decrypt(encrypt("dummy"));
    } catch {
      /* ignore */
    }
    return null;
  }

  if (row.expiresAt < new Date()) {
    await prisma.dashboardSession.deleteMany({ where: { id: row.id } });
    return null;
  }

  const session: Session = {
    userId: row.userId,
    username: row.username,
    avatar: row.avatar,
    accessToken: decryptAccessToken(row.accessToken),
    guilds: safeJsonParse<OAuthGuild[]>(row.guilds, []),
    createdAt: row.createdAt.getTime(),
  };

  const cachedEntry: CachedSession = {
    session,
    cacheExpiresAt: Date.now() + CACHE_TTL,
    sessionExpiresAt: row.expiresAt.getTime(),
    guildsRefreshedAt: row.guildsRefreshedAt.getTime(),
  };
  sessionCache.set(id, cachedEntry);

  // Auto-refresh stale guild data in the background
  if (Date.now() - cachedEntry.guildsRefreshedAt > GUILD_REFRESH_INTERVAL) {
    refreshSessionGuilds(id, session.accessToken, cachedEntry).catch(() => {});
  }

  return session;
}

/**
 * Extend session expiry if past 50% of TTL (sliding window).
 * Also refreshes the cookie maxAge on the reply.
 */
export async function touchSession(
  id: string,
  reply: FastifyReply,
): Promise<void> {
  const cached = sessionCache.get(id);
  if (!cached) return;

  const remaining = cached.sessionExpiresAt - Date.now();
  // Only touch if past 50% of TTL to avoid writes on every request
  if (remaining > SESSION_TTL * 0.5) return;

  const newExpiresAt = new Date(Date.now() + SESSION_TTL);
  const prisma = getPrisma();
  await prisma.dashboardSession.update({
    where: { id },
    data: { expiresAt: newExpiresAt },
  });

  // Update cache
  cached.sessionExpiresAt = newExpiresAt.getTime();
  cached.cacheExpiresAt = Date.now() + CACHE_TTL;

  // Refresh browser cookie
  reply.setCookie("session", id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    signed: true,
    maxAge: 604800, // 7 days
  });
}

/**
 * Re-fetch guilds from Discord and update the session in DB + cache.
 */
async function refreshSessionGuilds(
  id: string,
  accessToken: string,
  cached: CachedSession,
): Promise<OAuthGuild[]> {
  const guilds = await fetchGuilds(accessToken);
  const now = new Date();

  const prisma = getPrisma();
  await prisma.dashboardSession.update({
    where: { id },
    data: {
      guilds: JSON.stringify(guilds),
      guildsRefreshedAt: now,
    },
  });

  // Update cache
  cached.session.guilds = guilds;
  cached.guildsRefreshedAt = now.getTime();
  cached.cacheExpiresAt = Date.now() + CACHE_TTL;

  logger.debug(`Refreshed guild data for session ${id}`);
  return guilds;
}

/**
 * Force-refresh guilds for a session. Used by the manual refresh endpoint.
 */
export async function forceRefreshSessionGuilds(
  id: string,
): Promise<OAuthGuild[]> {
  const cached = sessionCache.get(id);
  if (!cached) {
    // Load session into cache first
    const session = await getSession(id);
    if (!session) throw new Error("Session not found");
    const entry = sessionCache.get(id);
    if (!entry) throw new Error("Session not cached");
    return refreshSessionGuilds(id, session.accessToken, entry);
  }
  return refreshSessionGuilds(id, cached.session.accessToken, cached);
}

export async function deleteSession(id: string): Promise<void> {
  sessionCache.delete(id);
  const prisma = getPrisma();
  await prisma.dashboardSession.deleteMany({ where: { id } });
}
