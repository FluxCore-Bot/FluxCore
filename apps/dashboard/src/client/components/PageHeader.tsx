import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  label?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, label, actions }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between">
      <div>
        {label && (
          <p className="font-label text-[10px] font-bold uppercase tracking-widest text-accent">
            {label}
          </p>
        )}
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
