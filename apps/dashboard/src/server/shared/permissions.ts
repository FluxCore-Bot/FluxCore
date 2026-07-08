import { getPrisma } from "@fluxcore/database";
import { matchPermission } from "@fluxcore/types";
import { logger } from "@fluxcore/utils";
import { getGuildOwnerId } from "./discordApi.js";
import { isUserGuildAdmin } from "./guildAuthz.js";

// ─── Cache ───

interface CachedPermissions {
  permissions: Set<string>;
  isOwner: boolean;
  isGuildAdmin: boolean;
  expiresAt: number;
}

const CACHE_TTL = 60_000; // 60 seconds
const permissionCache = new Map<string, CachedPermissions>();

function cacheKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of permissionCache) {
    if (now > entry.expiresAt) permissionCache.delete(key);
  }
}, 5 * 60_000).unref();

// ─── Resolution ───

export interface ResolvedPermissions {
  permissions: Set<string>;
  isOwner: boolean;
  /** Whether the user currently has live Discord admin authority in the guild. */
  isGuildAdmin: boolean;
}

function cacheResult(
  key: string,
  result: ResolvedPermissions,
): ResolvedPermissions {
  permissionCache.set(key, {
    permissions: result.permissions,
    isOwner: result.isOwner,
    isGuildAdmin: result.isGuildAdmin,
    expiresAt: Date.now() + CACHE_TTL,
  });
  return result;
}

/**
 * Resolve a user's effective permission set for a guild.
 * Returns all granted permission keys (may include wildcards).
 *
 * Authorization is anchored to the user's LIVE Discord admin authority (owner,
 * Administrator, or Manage Server) via {@link isUserGuildAdmin} — NOT the cached
 * OAuth session snapshot. A user whose admin access was revoked on Discord
 * resolves to an empty permission set within the short cache window.
 */
export async function resolveUserPermissions(
  userId: string,
  guildId: string,
): Promise<ResolvedPermissions> {
  const key = cacheKey(guildId, userId);
  const cached = permissionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      permissions: cached.permissions,
      isOwner: cached.isOwner,
      isGuildAdmin: cached.isGuildAdmin,
    };
  }
  permissionCache.delete(key);

  const prisma = getPrisma();

  // Check if user is guild owner
  const ownerId = await getGuildOwnerId(guildId);
  if (ownerId === userId) {
    return cacheResult(key, {
      permissions: new Set(["*"]),
      isOwner: true,
      isGuildAdmin: true,
    });
  }

  // Live authority check — revoked Discord admin is honored here, so a stale
  // OAuth session can no longer grant dashboard access.
  const isGuildAdmin = await isUserGuildAdmin(guildId, userId);
  if (!isGuildAdmin) {
    return cacheResult(key, {
      permissions: new Set(),
      isOwner: false,
      isGuildAdmin: false,
    });
  }

  // Check if permissions are enabled for this guild
  const guildSettings = await prisma.dashboardGuildSettings.findUnique({
    where: { guildId },
  });

  if (!guildSettings?.requirePermissions) {
    // Legacy mode: all guild admins have full access
    return cacheResult(key, {
      permissions: new Set(["*"]),
      isOwner: false,
      isGuildAdmin: true,
    });
  }

  // Gather permissions from roles
  const assignments = await prisma.dashboardRoleAssignment.findMany({
    where: { guildId, userId },
    include: { role: true },
  });

  // Also include default roles
  const defaultRoles = await prisma.dashboardRole.findMany({
    where: { guildId, isDefault: true },
  });

  const allRoles = [
    ...assignments.map((a) => a.role),
    ...defaultRoles.filter(
      (dr) => !assignments.some((a) => a.roleId === dr.id),
    ),
  ];

  const permissions = new Set<string>();

  for (const role of allRoles) {
    const rolePerms = safeJsonParse<string[]>(role.permissions, []);
    for (const perm of rolePerms) {
      permissions.add(perm);
    }
  }

  // Add per-user permission overrides
  const userPerms = await prisma.dashboardUserPermission.findMany({
    where: { guildId, userId },
  });
  for (const up of userPerms) {
    permissions.add(up.permission);
  }

  return cacheResult(key, { permissions, isOwner: false, isGuildAdmin: true });
}

/**
 * Check if a resolved permission set grants a specific permission.
 */
export function hasPermission(
  resolved: ResolvedPermissions,
  required: string,
): boolean {
  return matchPermission(resolved.permissions, required);
}

/**
 * Invalidate the permission cache for a user in a guild.
 * Call after role assignment changes, role permission edits, or user permission changes.
 */
export function invalidatePermissionCache(
  guildId: string,
  userId?: string,
): void {
  if (userId) {
    permissionCache.delete(cacheKey(guildId, userId));
  } else {
    // Invalidate all users for this guild
    const prefix = `${guildId}:`;
    for (const key of permissionCache.keys()) {
      if (key.startsWith(prefix)) permissionCache.delete(key);
    }
  }
  logger.debug(
    `Permission cache invalidated for guild=${guildId}${userId ? ` user=${userId}` : " (all users)"}`,
  );
}

// ─── Audit Logging ───

export interface AuditLogEntry {
  guildId: string;
  userId: string;
  username: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

export async function createDashboardAuditLog(
  entry: AuditLogEntry,
): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.dashboardAuditLog.create({
      data: {
        guildId: entry.guildId,
        userId: entry.userId,
        username: entry.username,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        details: (entry.details ?? {}) as object,
      },
    });
  } catch (err) {
    logger.error("Failed to create dashboard audit log", err as Error);
  }
}

// ─── Helpers ───

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
