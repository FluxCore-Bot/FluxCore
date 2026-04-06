import type { LucideIcon } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: "primary" | "success" | "warning" | "danger" | "info" | "secondary";
  /** Optional tooltip describing the metric */
  tooltip?: string;
}

const accentMap = {
  primary: {
    border: "border-primary/30",
    iconBg: "bg-primary/10",
    iconText: "text-primary",
    value: "text-text",
  },
  success: {
    border: "border-success/30",
    iconBg: "bg-success/10",
    iconText: "text-success",
    value: "text-success",
  },
  warning: {
    border: "border-warning/30",
    iconBg: "bg-warning/10",
    iconText: "text-warning",
    value: "text-warning",
  },
  danger: {
    border: "border-danger/30",
    iconBg: "bg-danger/10",
    iconText: "text-danger",
    value: "text-danger",
  },
  info: {
    border: "border-info/30",
    iconBg: "bg-info/10",
    iconText: "text-info",
    value: "text-text",
  },
  secondary: {
    border: "border-secondary/30",
    iconBg: "bg-secondary/10",
    iconText: "text-secondary",
    value: "text-text",
  },
} as const;

export function StatsCard({
  label,
  value,
  icon: Icon,
  accent = "primary",
  tooltip,
}: StatsCardProps) {
  const colors = accentMap[accent];

  const card = (
    <div
      className={`relative overflow-hidden rounded-md border ${colors.border} bg-surface-low p-4 sm:p-5`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-label text-xs tracking-wide text-text-muted uppercase">
            {label}
          </p>
          <p
            className={`mt-1.5 font-mono text-2xl font-bold leading-none tracking-tight sm:text-3xl ${colors.value}`}
          >
            {value}
          </p>
        </div>
        {Icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${colors.iconBg}`}
          >
            <Icon className={`h-[18px] w-[18px] ${colors.iconText}`} strokeWidth={1.5} />
          </div>
        )}
      </div>
    </div>
  );

  if (!tooltip) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
