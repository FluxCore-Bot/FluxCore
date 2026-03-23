import { Link } from "@tanstack/react-router";
import { Icon } from "../Icon";
import type { Constants } from "../../lib/schemas";

interface ActivityItem {
  id: number;
  ruleName: string;
  eventType: string;
  actionType: string;
  success: boolean;
  error: string | null;
  executedAt: string;
}

interface RecentActivityFeedProps {
  data: ActivityItem[];
  guildId: string;
  constants?: Constants;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentActivityFeed({ data, guildId, constants }: RecentActivityFeedProps) {
  return (
    <div className="rounded-lg bg-surface-low p-6 glass-edge">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-label text-[10px] font-bold uppercase tracking-widest text-text-muted">
          Recent Activity
        </h3>
        <Link
          to="/guild/$guildId/logs"
          params={{ guildId }}
          className="text-xs text-accent hover:underline"
        >
          View all logs
        </Link>
      </div>

      {data.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-muted">
          No activity recorded yet
        </div>
      ) : (
        <div className="space-y-1">
          {data.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-surface-high/50"
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  item.success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                }`}
              >
                <Icon name={item.success ? "check" : "close"} size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">
                  {item.ruleName}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {constants?.eventTypes[item.eventType]?.label ?? item.eventType}
                  {" → "}
                  {constants?.actionTypes[item.actionType]?.label ?? item.actionType}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-text/40">
                {timeAgo(item.executedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
