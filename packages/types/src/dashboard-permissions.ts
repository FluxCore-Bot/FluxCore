// ─── Role Presets ───

export interface RolePreset {
  name: string;
  color: string;
  permissions: string[];
}

export const ROLE_PRESETS: Record<string, RolePreset> = {
  moderator: {
    name: "Moderator",
    color: "#ff6e84",
    permissions: [
      "moderation.*",
      "logging.entries.view",
      "logging.config.manage",
      "tickets.list.view",
      "tickets.list.manage",
      "suggestions.list.manage",
      "security.events.view",
      "dashboard.lookups.view",
    ],
  },
  "content-manager": {
    name: "Content Manager",
    color: "#a3a6ff",
    permissions: [
      "welcome.*",
      "leveling.*",
      "starboard.*",
      "suggestions.*",
      "roles.panels.*",
      "scheduled.messages.*",
      "commands.list.*",
      "dashboard.lookups.view",
    ],
  },
  "full-admin": {
    name: "Full Admin",
    color: "#fee75c",
    permissions: ["*"],
  },
  viewer: {
    name: "Viewer",
    color: "#60a5fa",
    permissions: ["*.*.view"],
  },
};

// ─── Permission Matcher ───

/**
 * Check if a set of granted permissions includes the required permission.
 * Supports wildcards: "*", "module.*", "*.resource.action", "*.*.view"
 */
export function matchPermission(granted: Set<string>, required: string): boolean {
  // Full access
  if (granted.has("*")) return true;
  // Exact match
  if (granted.has(required)) return true;

  const parts = required.split(".");

  // Check module-level wildcard: "moderation.*" matches "moderation.cases.view"
  if (parts.length >= 2) {
    for (let i = parts.length - 1; i >= 1; i--) {
      const wildcard = parts.slice(0, i).join(".") + ".*";
      if (granted.has(wildcard)) return true;
    }
  }

  // Check cross-module wildcards in granted set
  for (const perm of granted) {
    if (!perm.includes("*")) continue;
    if (wildcardMatch(perm, required)) return true;
  }

  return false;
}

/**
 * Match a wildcard pattern against a permission key.
 * Each segment can be "*" to match any single segment.
 * A trailing ".*" matches all sub-segments.
 */
function wildcardMatch(pattern: string, key: string): boolean {
  // Trailing wildcard: "moderation.*" matches "moderation.warnings.manage"
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    if (prefix === "*") return true; // "*.*" matches everything
    // Check if prefix segments match (with possible wildcards in prefix)
    const prefixParts = prefix.split(".");
    const keyParts = key.split(".");
    if (keyParts.length < prefixParts.length) return false;
    return prefixParts.every(
      (seg, i) => seg === "*" || seg === keyParts[i],
    );
  }

  // Segment-by-segment match: "*.settings.manage" matches "moderation.settings.manage"
  const patternParts = pattern.split(".");
  const keyParts = key.split(".");
  if (patternParts.length !== keyParts.length) return false;
  return patternParts.every(
    (seg, i) => seg === "*" || seg === keyParts[i],
  );
}

/**
 * Expand a wildcard pattern to the concrete keys it covers.
 * `allKeys` is the caller's vocabulary — the dashboard passes the keys declared
 * by its route table, so this module never has to know what permissions exist.
 */
export function expandWildcard(
  pattern: string,
  allKeys: readonly string[],
): string[] {
  if (pattern === "*") return [...allKeys];
  return allKeys.filter((key) => matchPermission(new Set([pattern]), key));
}

/**
 * Given granted permissions (possibly wildcards), return every concrete key
 * they cover, out of `allKeys`.
 */
export function resolveEffectivePermissions(
  granted: string[],
  allKeys: readonly string[],
): string[] {
  const grantedSet = new Set(granted);
  return allKeys.filter((key) => matchPermission(grantedSet, key));
}
