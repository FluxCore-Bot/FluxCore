import { Icon } from "../components/Icon";
import { segment } from "./ranking";
import type { Command } from "./types";
import { cn } from "../lib/utils";

export function CommandRow({
  command, query, id, active, onActivate, onHover,
}: {
  command: Command;
  query: string;
  id: string;
  active: boolean;
  onActivate: () => void;
  onHover: () => void;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onClick={onActivate}
      onMouseMove={onHover}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
        active ? "bg-surface-high text-text" : "text-text-muted",
      )}
    >
      <Icon name={command.icon} size={18} />
      <span className="min-w-0 flex-1 truncate">
        {segment(command.title, query).map((seg, i) =>
          seg.match ? (
            <mark key={i} className="bg-transparent font-semibold text-accent">
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </span>
      {command.subtitle && (
        <span className="shrink-0 truncate text-xs text-text-muted">
          {command.subtitle}
        </span>
      )}
    </li>
  );
}
