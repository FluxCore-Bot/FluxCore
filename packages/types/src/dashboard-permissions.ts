// ─── Permission Key Types ───

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
}

export interface PermissionModule {
  key: string;
  label: string;
  icon: string; // Lucide icon name
  permissions: PermissionDefinition[];
}

// ─── Permission Registry ───

export const PERMISSION_REGISTRY: PermissionModule[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    permissions: [
      { key: "dashboard.roles.view", label: "View Roles", description: "View dashboard roles and assignments" },
      { key: "dashboard.roles.manage", label: "Manage Roles", description: "Create/edit/delete dashboard roles" },
      { key: "dashboard.audit.view", label: "View Audit Log", description: "View dashboard audit log" },
      { key: "dashboard.settings.manage", label: "Manage Settings", description: "Manage guild-wide dashboard settings" },
    ],
  },
  {
    key: "moderation",
    label: "Moderation",
    icon: "Shield",
    permissions: [
      { key: "moderation.cases.view", label: "View Cases", description: "View moderation case history" },
      { key: "moderation.cases.manage", label: "Manage Cases", description: "Edit/delete moderation cases" },
      { key: "moderation.settings.manage", label: "Manage Settings", description: "Configure moderation settings" },
      { key: "moderation.warnings.view", label: "View Warnings", description: "View warning history" },
      { key: "moderation.warnings.manage", label: "Manage Warnings", description: "Create/delete warnings" },
      { key: "moderation.punishments.manage", label: "Manage Punishments", description: "Configure warning punishment escalations" },
    ],
  },
  {
    key: "actions",
    label: "Actions",
    icon: "Zap",
    permissions: [
      { key: "actions.rules.view", label: "View Rules", description: "View automation rules" },
      { key: "actions.rules.manage", label: "Manage Rules", description: "Create/edit/delete automation rules" },
      { key: "actions.rules.execute", label: "Execute Rules", description: "Bulk enable/disable rules" },
      { key: "actions.analytics.view", label: "View Analytics", description: "View rule analytics and logs" },
      { key: "actions.settings.manage", label: "Manage Settings", description: "Configure action system settings" },
    ],
  },
  {
    key: "music",
    label: "Music",
    icon: "Music",
    permissions: [
      { key: "music.settings.view", label: "View Settings", description: "View music settings" },
      { key: "music.settings.manage", label: "Manage Settings", description: "Configure music settings" },
      { key: "music.library.view", label: "View Library", description: "View music library" },
      { key: "music.library.manage", label: "Manage Library", description: "Create/delete albums and tracks" },
    ],
  },
  {
    key: "logging",
    label: "Logging",
    icon: "ScrollText",
    permissions: [
      { key: "logging.entries.view", label: "View Logs", description: "View log entries" },
      { key: "logging.entries.purge", label: "Purge Logs", description: "Purge old log entries" },
      { key: "logging.config.manage", label: "Manage Config", description: "Configure log channels and events" },
    ],
  },
  {
    key: "welcome",
    label: "Welcome",
    icon: "HandMetal",
    permissions: [
      { key: "welcome.config.view", label: "View Config", description: "View welcome/farewell config" },
      { key: "welcome.config.manage", label: "Manage Config", description: "Update welcome/farewell settings" },
      { key: "welcome.test.execute", label: "Test Messages", description: "Send test welcome/farewell messages" },
    ],
  },
  {
    key: "leveling",
    label: "Leveling",
    icon: "TrendingUp",
    permissions: [
      { key: "leveling.leaderboard.view", label: "View Leaderboard", description: "View leaderboard" },
      { key: "leveling.users.manage", label: "Manage Users", description: "Set user XP manually" },
      { key: "leveling.rewards.manage", label: "Manage Rewards", description: "Add/remove level rewards" },
      { key: "leveling.settings.manage", label: "Manage Settings", description: "Configure leveling settings" },
    ],
  },
  {
    key: "tickets",
    label: "Tickets",
    icon: "Ticket",
    permissions: [
      { key: "tickets.list.view", label: "View Tickets", description: "View tickets" },
      { key: "tickets.list.manage", label: "Manage Tickets", description: "Force close tickets" },
      { key: "tickets.panels.manage", label: "Manage Panels", description: "Create/edit/delete ticket panels" },
      { key: "tickets.settings.manage", label: "Manage Settings", description: "Configure ticket settings" },
    ],
  },
  {
    key: "giveaways",
    label: "Giveaways",
    icon: "Gift",
    permissions: [
      { key: "giveaways.list.view", label: "View Giveaways", description: "View giveaways" },
      { key: "giveaways.list.manage", label: "Manage Giveaways", description: "Create/end/reroll giveaways" },
    ],
  },
  {
    key: "starboard",
    label: "Starboard",
    icon: "Star",
    permissions: [
      { key: "starboard.entries.view", label: "View Entries", description: "View starred messages" },
      { key: "starboard.settings.manage", label: "Manage Settings", description: "Configure starboard settings" },
    ],
  },
  {
    key: "suggestions",
    label: "Suggestions",
    icon: "Lightbulb",
    permissions: [
      { key: "suggestions.list.view", label: "View Suggestions", description: "View suggestions" },
      { key: "suggestions.list.manage", label: "Manage Suggestions", description: "Create/update status/delete suggestions" },
      { key: "suggestions.settings.manage", label: "Manage Settings", description: "Configure suggestion settings" },
    ],
  },
  {
    key: "roles",
    label: "Role Panels",
    icon: "UserCog",
    permissions: [
      { key: "roles.panels.view", label: "View Panels", description: "View role panels" },
      { key: "roles.panels.manage", label: "Manage Panels", description: "Create/edit/delete/send role panels" },
    ],
  },
  {
    key: "tempvoice",
    label: "Temp Voice",
    icon: "Mic",
    permissions: [
      { key: "tempvoice.config.view", label: "View Config", description: "View temp voice configs" },
      { key: "tempvoice.config.manage", label: "Manage Config", description: "Create/edit/delete temp voice configs" },
    ],
  },
  {
    key: "security",
    label: "Security",
    icon: "ShieldAlert",
    permissions: [
      { key: "security.config.view", label: "View Config", description: "View anti-raid configuration" },
      { key: "security.config.manage", label: "Manage Config", description: "Update anti-raid settings" },
      { key: "security.events.view", label: "View Events", description: "View raid event history" },
    ],
  },
  {
    key: "scheduled",
    label: "Scheduled Messages",
    icon: "Clock",
    permissions: [
      { key: "scheduled.messages.view", label: "View Messages", description: "View scheduled messages" },
      { key: "scheduled.messages.manage", label: "Manage Messages", description: "Create/edit/delete scheduled messages" },
      { key: "scheduled.messages.execute", label: "Test Messages", description: "Test send scheduled messages" },
    ],
  },
  {
    key: "commands",
    label: "Custom Commands",
    icon: "Terminal",
    permissions: [
      { key: "commands.list.view", label: "View Commands", description: "View custom commands" },
      { key: "commands.list.manage", label: "Manage Commands", description: "Create/edit/delete custom commands" },
    ],
  },
];

// ─── All permission keys as a flat array ───

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_REGISTRY.flatMap(
  (mod) => mod.permissions.map((p) => p.key),
);

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
    ],
  },
  dj: {
    name: "DJ",
    color: "#ac8aff",
    permissions: ["music.*"],
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

  // Check module-level wildcard: "music.*" matches "music.settings.view"
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
  // Trailing wildcard: "music.*" matches "music.library.manage"
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

  // Segment-by-segment match: "*.settings.manage" matches "music.settings.manage"
  const patternParts = pattern.split(".");
  const keyParts = key.split(".");
  if (patternParts.length !== keyParts.length) return false;
  return patternParts.every(
    (seg, i) => seg === "*" || seg === keyParts[i],
  );
}

/**
 * Expand a wildcard pattern to all matching concrete permission keys.
 * Useful for UI display of effective permissions.
 */
export function expandWildcard(pattern: string): string[] {
  if (pattern === "*") return [...ALL_PERMISSION_KEYS];

  return ALL_PERMISSION_KEYS.filter((key) =>
    matchPermission(new Set([pattern]), key),
  );
}

/**
 * Given a set of granted permissions (may include wildcards),
 * return all concrete permission keys the user has.
 */
export function resolveEffectivePermissions(granted: string[]): string[] {
  const grantedSet = new Set(granted);
  return ALL_PERMISSION_KEYS.filter((key) => matchPermission(grantedSet, key));
}
