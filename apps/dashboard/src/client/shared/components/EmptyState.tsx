import type { ReactNode } from "react";
import { Icon } from "./Icon";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = "inbox", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-surface-low p-12 text-center glass-edge">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-high">
        <Icon name={icon} size={24} className="text-text-muted" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
