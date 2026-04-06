import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  label?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, label, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {label && (
          <p className="section-label text-accent">
            {label}
          </p>
        )}
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-1 text-sm text-text-muted sm:mt-2">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
