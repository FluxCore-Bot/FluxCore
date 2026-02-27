import { randomUUID } from "node:crypto";
import { getPrisma } from "@fluxcore/database";
import { encrypt, decrypt } from "./crypto.js";

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

const SESSION_TTL = 60 * 60 * 1000; // 1 hour
const CACHE_TTL = 30_000; // 30 seconds

const sessionCache = new Map<string, { session: Session; expiresAt: number }>();

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
      accessToken: encrypt(data.accessToken),
      guilds: JSON.stringify(data.guilds),
      createdAt: now,
      expiresAt,
    },
  });

  return id;
}

export async function getSession(id: string): Promise<Session | null> {
  const cached = sessionCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session;
  }
  sessionCache.delete(id);

  const prisma = getPrisma();
  const row = await prisma.dashboardSession.findUnique({
    where: { id },
  });

  if (!row) return null;

  if (row.expiresAt < new Date()) {
    await prisma.dashboardSession.deleteMany({ where: { id } });
    return null;
  }

  const session: Session = {
    userId: row.userId,
    username: row.username,
    avatar: row.avatar,
    accessToken: decrypt(row.accessToken),
    guilds: safeJsonParse<OAuthGuild[]>(row.guilds, []),
    createdAt: row.createdAt.getTime(),
  };

  sessionCache.set(id, { session, expiresAt: Date.now() + CACHE_TTL });
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  sessionCache.delete(id);
  const prisma = getPrisma();
  await prisma.dashboardSession.deleteMany({ where: { id } });
}
