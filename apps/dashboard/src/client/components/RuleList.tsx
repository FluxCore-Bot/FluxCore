import { formatDistanceToNow } from "date-fns";
import { Icon } from "./Icon";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "./ui/tooltip";
import { EmptyState } from "./EmptyState";
import { ACTION_ICONS, EVENT_ICONS, getActionPreview } from "../lib/rule-icons";
import type { ActionRule, Constants } from "../lib/schemas";

interface RuleListProps {
  rules: ActionRule[];
  constants: Constants | undefined;
  onEdit: (rule: ActionRule) => void;
  onDelete: (rule: ActionRule) => void;
  onToggle: (rule: ActionRule) => void;
  onDuplicate: (rule: ActionRule) => void;
}

function formatLastFired(lastFired: string | null | undefined): string {
  if (!lastFired) return "Never";
  try {
    return formatDistanceToNow(new Date(lastFired), { addSuffix: true });
  } catch {
    return "Never";
  }
}

export function RuleList({
  rules,
  constants,
  onEdit,
  onDelete,
  onToggle,
  onDuplicate,
}: RuleListProps) {
  if (rules.length === 0) {
    return (
      <EmptyState
        icon="bolt"
        title="No rules yet"
        description="Create your first automation rule to get started with event-driven actions."
      />
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        {rules.map((rule) => {
          const eventLabel =
            constants?.eventTypes[rule.eventType]?.label ?? rule.eventType;
          const eventIcon = EVENT_ICONS[rule.eventType] ?? "bolt";

          return (
            <div
              key={rule.id}
              className={`group cursor-pointer rounded-xl border bg-surface-low p-5 shadow-lg transition-all hover:bg-surface-high/50 ${
                rule.enabled
                  ? "border-border hover:border-accent/30"
                  : "border-border/50 opacity-60 hover:opacity-80"
              }`}
              onClick={() => onEdit(rule)}
            >
              {/* Rule header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold">{rule.name}</span>
                  <Badge
                    variant={rule.enabled ? "success" : "destructive"}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(rule);
                    }}
                  >
                    {rule.enabled ? "On" : "Off"}
                  </Badge>
                  <span className="font-mono text-[10px] text-text-muted">
                    P{rule.priority}
                  </span>
                  <span className="text-[10px] text-text-muted/60">
                    {formatLastFired(rule.lastFired)}
                  </span>
                </div>
                <div
                  className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDuplicate(rule)}>
                        <Icon name="content_copy" size={15} className="text-text/40 hover:text-accent" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate</TooltipContent>
                  </Tooltip>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(rule)}>
                    <Icon name="edit" size={15} className="text-text/40 hover:text-accent" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(rule)}>
                    <Icon name="delete" size={15} className="text-text/40 hover:text-danger" />
                  </Button>
                </div>
              </div>

              {/* Flow: Trigger → Actions */}
              <div className="flex items-start gap-0 overflow-x-auto pb-1">
                {/* Trigger node */}
                <div className="flex shrink-0 flex-col rounded-lg border-2 border-accent/40 bg-accent/5 px-4 py-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-accent/20">
                      <Icon name={eventIcon} size={14} className="text-accent" />
                    </div>
                    <span className="font-label text-[10px] font-bold uppercase tracking-widest text-accent">
                      Trigger
                    </span>
                  </div>
                  <span className="text-sm font-medium text-text">
                    {eventLabel}
                  </span>
                </div>

                {/* Connector */}
                <div className="flex shrink-0 items-center self-center">
                  <div className="h-px w-5 bg-accent/30" />
                  <div className="h-2 w-2 rotate-45 border-r border-t border-accent/40" />
                  <div className="h-px w-3 bg-secondary/30" />
                </div>

                {/* Action nodes */}
                {rule.actions.map((action, i) => {
                  const actionLabel =
                    constants?.actionTypes[action.type]?.label ?? action.type;
                  const actionIcon = ACTION_ICONS[action.type] ?? "play_arrow";
                  const preview = getActionPreview(action);
                  const isConfigured = action.type !== "";

                  return (
                    <div key={i} className="flex shrink-0 items-start">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col rounded-lg border border-outline-variant/10 bg-surface-high px-4 py-3 glass-edge">
                            <div className="mb-1.5 flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded bg-secondary/15">
                                <Icon name={actionIcon} size={14} className="text-secondary" />
                              </div>
                              <span className="font-label text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                Action {i + 1}
                              </span>
                              {!isConfigured && (
                                <span className="ml-auto flex h-2 w-2 rounded-full bg-warning/60" title="Not configured" />
                              )}
                            </div>
                            <span className="text-sm font-medium text-text">
                              {actionLabel}
                            </span>
                            {preview && (
                              <span className="mt-1 max-w-45 truncate text-[11px] text-text-muted">
                                {preview}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{actionLabel}</TooltipContent>
                      </Tooltip>
                      {i < rule.actions.length - 1 && (
                        <div className="flex shrink-0 items-center self-center">
                          <div className="h-px w-4 bg-secondary/30" />
                          <div className="h-1.5 w-1.5 rotate-45 border-r border-t border-secondary/40" />
                          <div className="h-px w-2 bg-secondary/30" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
