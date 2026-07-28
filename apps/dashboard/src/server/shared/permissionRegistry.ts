/**
 * The permission registry is derived from the route table: `requirePermission`
 * records each key it enforces, and this module turns that flat set into the
 * module → permission tree the dashboard renders. A key therefore cannot appear
 * in the UI without a route enforcing it, nor the reverse.
 *
 * Only presentation lives here. Labels are i18n keys; the client translates.
 */

/** Display metadata per module. Order is the order modules render in. */
const MODULE_META: Record<string, { icon: string; order: number }> = {
  dashboard: { icon: "LayoutDashboard", order: 0 },
  moderation: { icon: "Shield", order: 1 },
  actions: { icon: "Zap", order: 2 },
  logging: { icon: "ScrollText", order: 3 },
  welcome: { icon: "Hand", order: 4 },
  leveling: { icon: "TrendingUp", order: 5 },
  tickets: { icon: "Ticket", order: 6 },
  giveaways: { icon: "Gift", order: 7 },
  starboard: { icon: "Star", order: 8 },
  suggestions: { icon: "Lightbulb", order: 9 },
  roles: { icon: "Badge", order: 10 },
  tempvoice: { icon: "Mic", order: 11 },
  security: { icon: "ShieldAlert", order: 12 },
  scheduled: { icon: "Clock", order: 13 },
  commands: { icon: "Terminal", order: 14 },
};

/** Action verbs the key convention allows. */
const ACTIONS = new Set(["view", "manage", "execute", "purge"]);

export interface PermissionView {
  key: string;
  /** i18n key for the resource noun, e.g. "Cases". */
  resourceKey: string;
  /** i18n key for the action verb, e.g. "View". */
  actionKey: string;
}

export interface PermissionModuleView {
  key: string;
  icon: string;
  /** i18n key for the module name. */
  labelKey: string;
  permissions: PermissionView[];
}

export function buildPermissionRegistry(
  keys: ReadonlySet<string>,
): PermissionModuleView[] {
  const byModule = new Map<string, PermissionView[]>();

  for (const key of [...keys].sort()) {
    const [module, resource, action] = key.split(".");
    if (!module || !resource || !action) continue;

    const views = byModule.get(module) ?? [];
    views.push({
      key,
      resourceKey: `permissions:resources.${resource}`,
      actionKey: `permissions:permissionActions.${action}`,
    });
    byModule.set(module, views);
  }

  return [...byModule.entries()]
    .filter(([module]) => module in MODULE_META)
    .sort(([a], [b]) => MODULE_META[a].order - MODULE_META[b].order)
    .map(([module, permissions]) => ({
      key: module,
      icon: MODULE_META[module].icon,
      labelKey: `permissions:permissionCategories.${module}`,
      permissions,
    }));
}

/**
 * Fail fast when a route declares a key the UI could never render — an unknown
 * module, a malformed key, or an unknown action verb. Called once at boot.
 */
export function validatePermissionRegistry(keys: ReadonlySet<string>): void {
  const problems: string[] = [];

  for (const key of keys) {
    const parts = key.split(".");
    if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
      problems.push(`"${key}" is not module.resource.action`);
      continue;
    }
    const [module, , action] = parts;
    if (!(module in MODULE_META)) {
      problems.push(`"${key}" has no MODULE_META entry for module "${module}"`);
    }
    if (!ACTIONS.has(action)) {
      problems.push(`"${key}" uses unknown action "${action}"`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid permission registry:\n  ${problems.join("\n  ")}`);
  }
}
