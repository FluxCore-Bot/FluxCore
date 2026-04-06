import type { ReactNode } from "react";
import { useParams } from "@tanstack/react-router";
import { usePermissions } from "../hooks/usePermissions";
import { Icon } from "../../../shared/components/Icon";

interface PermissionGuardProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only if the current user has the required permission.
 * Hides content entirely by default, or shows a fallback.
 */
export function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { can, isLoading } = usePermissions(guildId);

  if (isLoading) return null;
  if (!can(permission)) return fallback ?? null;

  return <>{children}</>;
}

interface PermissionPageGuardProps {
  permission: string;
  children: ReactNode;
  module: string;
}

/**
 * Full-page permission guard. Shows a "Permission Denied" page if the user
 * lacks the required permission.
 */
export function PermissionPageGuard({ permission, children, module }: PermissionPageGuardProps) {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { can, isLoading, roles } = usePermissions(guildId);

  if (isLoading) return null;
  if (can(permission)) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
        <Icon name="lock" size={32} className="text-danger" />
      </div>
      <h2 className="mt-6 text-2xl font-bold tracking-tight">Permission Denied</h2>
      <p className="mt-2 max-w-md text-sm text-text-muted">
        You don't have permission to access <span className="font-semibold text-text">{module}</span>.
      </p>
      <div className="mt-4 rounded-lg border border-outline-variant/20 bg-surface-high/50 px-4 py-3 text-start text-xs">
        <p className="font-medium text-text-muted">Required permission:</p>
        <code className="mt-1 block font-mono text-accent">{permission}</code>
        {roles.length > 0 && (
          <>
            <p className="mt-3 font-medium text-text-muted">Your roles:</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {roles.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                  style={{ backgroundColor: `${r.color ?? "#666"}20`, color: r.color ?? "#999" }}
                >
                  {r.name}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="mt-6 text-xs text-text-muted">Contact your server owner to request access.</p>
    </div>
  );
}
