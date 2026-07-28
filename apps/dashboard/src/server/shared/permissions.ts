import { getPrisma } from "@fluxcore/database";
import { matchPermission } from "@fluxcore/types";
import { logger } from "@fluxcore/utils";
import { getGuildAuthority } from "./guildAuthz.js";

// ─── Cache ───

interface CachedPermissions {
  permissions: Set<string>;
  isOwner: boolean;
  isGuildAdmin: boolean;
  isGuildMember: boolean;
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
  /** Whether the user is currently in the guild at all. */
  isGuildMember: boolean;
}

function cacheResult(
  key: string,
  result: ResolvedPermissions,
): ResolvedPermissions {
  permissionCache.set(key, {
    permissions: result.permissions,
    isOwner: result.isOwner,
    isGuildAdmin: result.isGuildAdmin,
    isGuildMember: result.isGuildMember,
    expiresAt: Date.now() + CACHE_TTL,
  });
  return result;
}

/**
 * Resolve a user's effective permission set for a guild.
 * Returns all granted permission keys (may include wildcards).
 *
 * Authorization is anchored to the user's LIVE Discord authority (owner,
 * admin, or plain membership) via {@link getGuildAuthority} — NOT the cached
 * OAuth session snapshot. A user whose admin access was revoked on Discord,
 * or who has left the guild, resolves to an empty permission set within the
 * short cache window.
 *
 * `requirePermissions` governs whether ADMINS are constrained to explicit
 * role/user grants. It never gates a non-admin member's explicit grants —
 * those resolve the same way regardless of the setting. `isDefault` roles
 * are merged only on the admin path; applying them to every member would
 * turn the toggle into a server-wide grant.
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
      isGuildMember: cached.isGuildMember,
    };
  }
  permissionCache.delete(key);

  const authority = await getGuildAuthority(guildId, userId);

  if (authority.isOwner) {
    return cacheResult(key, {
      permissions: new Set(["*"]),
      isOwner: true,
      isGuildAdmin: true,
      isGuildMember: true,
    });
  }

  // Not in the guild → no authority, and no reason to read grant rows.
  if (!authority.isMember) {
    return cacheResult(key, {
      permissions: new Set(),
      isOwner: false,
      isGuildAdmin: false,
      isGuildMember: false,
    });
  }

  const prisma = getPrisma();

  // `requirePermissions` governs whether ADMINS are constrained. It never gates
  // explicit grants, which resolve the same way in both modes.
  if (authority.isAdmin) {
    const guildSettings = await prisma.dashboardGuildSettings.findUnique({
      where: { guildId },
    });
    if (!guildSettings?.requirePermissions) {
      return cacheResult(key, {
        permissions: new Set(["*"]),
        isOwner: false,
        isGuildAdmin: true,
        isGuildMember: true,
      });
    }
  }

  const permissions = await loadGrantedPermissions(guildId, userId, {
    // Default roles are an admin baseline only. Applying them to every member
    // would turn the requirePermissions toggle into a server-wide grant.
    includeDefaultRoles: authority.isAdmin,
  });

  return cacheResult(key, {
    permissions,
    isOwner: false,
    isGuildAdmin: authority.isAdmin,
    isGuildMember: true,
  });
}

/**
 * Merge a user's dashboard role permissions and per-user overrides into one set.
 */
async function loadGrantedPermissions(
  guildId: string,
  userId: string,
  options: { includeDefaultRoles: boolean },
): Promise<Set<string>> {
  const prisma = getPrisma();

  const assignments = await prisma.dashboardRoleAssignment.findMany({
    where: { guildId, userId },
    include: { role: true },
  });

  const defaultRoles = options.includeDefaultRoles
    ? await prisma.dashboardRole.findMany({ where: { guildId, isDefault: true } })
    : [];

  const allRoles = [
    ...assignments.map((a) => a.role),
    ...defaultRoles.filter((dr) => !assignments.some((a) => a.roleId === dr.id)),
  ];

  const permissions = new Set<string>();
  for (const role of allRoles) {
    for (const perm of safeParsePermissions(role.permissions)) {
      permissions.add(perm);
    }
  }

  const userPerms = await prisma.dashboardUserPermission.findMany({
    where: { guildId, userId },
  });
  for (const up of userPerms) {
    permissions.add(up.permission);
  }

  return permissions;
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

/**
 * Parse a `DashboardRole.permissions` (or similar) JSON column into a string
 * array, tolerating both malformed JSON and syntactically-valid-but-wrong-shaped
 * JSON (e.g. `"5"` parses to the number 5, not an array). Callers on the auth
 * path iterate the result directly, so returning anything other than a real
 * string[] — a number, a string that indexes to individual characters — would
 * throw or silently misbehave instead of failing safe to no permissions.
 */
export function safeParsePermissions(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === "string")
      : [];
  } catch {
    return [];
  }
}
