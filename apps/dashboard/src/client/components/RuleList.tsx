import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Icon } from "./Icon";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "./ui/tooltip";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { EmptyState } from "./EmptyState";
import { ACTION_ICONS, EVENT_ICONS, getActionPreview } from "../lib/rule-icons";
import { useRuleAnalytics } from "../lib/hooks/useRules";
import type { ActionRule, Constants } from "../lib/schemas";

interface RuleListProps {
  rules: ActionRule[];
  constants: Constants | undefined;
  viewMode: "form" | "workflow";
  onEdit: (rule: ActionRule) => void;
  onDelete: (rule: ActionRule) => void;
  onToggle: (rule: ActionRule) => void;
  onDuplicate: (rule: ActionRule) => void;
  selectedRuleIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
}

function formatLastFired(lastFired: string | null | undefined): string {
  if (!lastFired) return "Never";
  try {
    return formatDistanceToNow(new Date(lastFired), { addSuffix: true });
  } catch {
    return "Never";
  }
}

function RuleAnalyticsPanel({ ruleId }: { ruleId: number }) {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data, isLoading } = useRuleAnalytics(guildId, ruleId);

  if (isLoading) {
    return (
      <div className="px-6 py-4 text-sm text-text-muted">Loading analytics...</div>
    );
  }

  if (!data) {
    return (
      <div className="px-6 py-4 text-sm text-text-muted">No analytics data available.</div>
    );
  }

  return (
    <div className="border-t border-border/50 bg-surface-lowest/50 px-6 py-4">
      <div className="mb-3 flex gap-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Executions (7d)
          </span>
          <p className="text-lg font-semibold">{data.totalExecutions}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Success Rate
          </span>
          <p className="text-lg font-semibold">{data.successRate}%</p>
        </div>
      </div>

      {data.recentLogs.length > 0 && (
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Recent Executions
          </span>
          <div className="mt-1.5 space-y-1">
            {data.recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-2 rounded-md bg-surface-low px-3 py-1.5 text-xs"
              >
                <Icon
                  name={log.success ? "check_circle" : "error"}
                  size={14}
                  className={log.success ? "text-secondary" : "text-danger"}
                />
                <span className="text-text-muted">{log.actionType}</span>
                {log.error && (
                  <span className="truncate text-danger/80">{log.error}</span>
                )}
                <span className="ml-auto text-text-muted/60">
                  {formatDistanceToNow(new Date(log.executedAt), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RuleList({
  rules,
  constants,
  viewMode,
  onEdit,
  onDelete,
  onToggle,
  onDuplicate,
  selectedRuleIds,
  onSelectionChange,
}: RuleListProps) {
  const [expandedRuleId, setExpandedRuleId] = useState<number | null>(null);

  if (rules.length === 0) {
    return (
      <EmptyState
        icon="bolt"
        title="No rules yet"
        description="Create your first automation rule to get started with event-driven actions."
      />
    );
  }

  const toggleSelection = (ruleId: number) => {
    const next = new Set(selectedRuleIds);
    if (next.has(ruleId)) {
      next.delete(ruleId);
    } else {
      next.add(ruleId);
    }
    onSelectionChange(next);
  };

  const toggleAll = () => {
    if (selectedRuleIds.size === rules.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(rules.map((r) => r.id)));
    }
  };

  if (viewMode === "workflow") {
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

  return (
    <TooltipProvider>
      <div className="rounded-xl bg-surface-low shadow-2xl glass-edge">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedRuleIds.size === rules.length && rules.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Actions</TableHead>
              <TableHead className="text-center">Priority</TableHead>
              <TableHead className="text-center">Last Fired</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Operations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => {
              const eventLabel =
                constants?.eventTypes[rule.eventType]?.label ?? rule.eventType;
              const eventIcon = EVENT_ICONS[rule.eventType] ?? "bolt";
              const isExpanded = expandedRuleId === rule.id;

              return (
                <TableRow
                  key={rule.id}
                  className="group cursor-pointer transition-colors hover:bg-surface-high/50"
                  onClick={() => onEdit(rule)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedRuleIds.has(rule.id)}
                      onCheckedChange={() => toggleSelection(rule.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold">{rule.name}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-accent/10">
                        <Icon name={eventIcon} size={14} className="text-accent" />
                      </div>
                      <span className="text-sm text-text-muted">{eventLabel}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {rule.actions.map((action, i) => {
                        const actionLabel =
                          constants?.actionTypes[action.type]?.label ?? action.type;
                        const actionIcon = ACTION_ICONS[action.type] ?? "play_arrow";
                        return (
                          <Tooltip key={i}>
                            <TooltipTrigger asChild>
                              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary/10 transition-colors hover:bg-secondary/20">
                                <Icon
                                  name={actionIcon}
                                  size={14}
                                  className="text-secondary"
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{actionLabel}</TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono text-xs text-text-muted">
                      {rule.priority}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs text-text-muted/60">
                      {formatLastFired(rule.lastFired)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={rule.enabled ? "success" : "destructive"}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle(rule);
                      }}
                    >
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setExpandedRuleId(isExpanded ? null : rule.id)
                            }
                            aria-label="Analytics"
                          >
                            <Icon
                              name={isExpanded ? "expand_less" : "analytics"}
                              className="text-text/40 hover:text-accent"
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Analytics</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDuplicate(rule)}
                            aria-label="Duplicate rule"
                          >
                            <Icon name="content_copy" className="text-text/40 hover:text-accent" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Duplicate</TooltipContent>
                      </Tooltip>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(rule)}
                        aria-label="Edit rule"
                      >
                        <Icon name="edit" className="text-text/40 hover:text-accent" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(rule)}
                        aria-label="Delete rule"
                      >
                        <Icon name="delete" className="text-text/40 hover:text-danger" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Expanded analytics panel — rendered outside table for proper layout */}
        {expandedRuleId !== null && (
          <RuleAnalyticsPanel ruleId={expandedRuleId} />
        )}
      </div>
    </TooltipProvider>
  );
}
