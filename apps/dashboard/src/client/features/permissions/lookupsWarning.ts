import { matchPermission } from "./hooks/usePermissions";

/**
 * Channel/role/member pickers on nearly every page call the Discord lookup
 * routes, which require dashboard.lookups.view. A role that can configure
 * things but cannot use pickers renders empty dropdowns — worth warning about
 * while the role is being edited rather than after it is assigned.
 */
export function needsLookupsPermission(granted: Set<string>): boolean {
  if (matchPermission(granted, "dashboard.lookups.view")) return false;

  return [...granted].some(
    (perm) => perm.endsWith(".manage") || perm.endsWith(".*") || perm === "*",
  );
}
