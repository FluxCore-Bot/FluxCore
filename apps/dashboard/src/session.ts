import { randomUUID } from "node:crypto";

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

const sessions = new Map<string, Session>();
const SESSION_TTL = 60 * 60 * 1000; // 1 hour

export function createSession(data: Omit<Session, "createdAt">): string {
  const id = randomUUID();
  sessions.set(id, { ...data, createdAt: Date.now() });
  return id;
}

export function getSession(id: string): Session | null {
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(id);
    return null;
  }
  return session;
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}
