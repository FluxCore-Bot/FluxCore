import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Icon } from "../../../shared/components/Icon";
import { Badge } from "../../../shared/ui/badge";
import { Button } from "../../../shared/ui/button";
import { Switch } from "../../../shared/ui/switch";
import { Checkbox } from "../../../shared/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../shared/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "../../../shared/ui/tooltip";
import { ACTION_ICONS, EVENT_ICONS, getActionPreview } from "../lib/rule-icons";
import type { ActionRule, Constants } from "../../../shared/lib/schemas";

interface RuleListProps {
  rules: ActionRule[];
  constants: Constants | undefined;
  onEdit: (rule: ActionRule) => void;
  onDelete: (rule: ActionRule) => void;
  onToggle: (rule: ActionRule) => void;
  onDuplicate: (rule: ActionRule) => void;
  selectedIds?: Set<number>;
  onSelectionChange?: (ids: Set<number>) => void;
}

function formatLastFired(
  lastFired: string | null | undefined,
  t: TFunction,
): { text: string; fired: boolean } {
  if (!lastFired) return { text: t("ruleList.never"), fired: false };
  try {
    return {
      text: formatDistanceToNow(new Date(lastFired), { addSuffix: true }),
      fired: true,
    };
  } catch {
    return { text: t("ruleList.never"), fired: false };
  }
}

export function RuleList({
  rules,
  constants,
  onEdit,
  onDelete,
  onToggle,
  onDuplicate,
  selectedIds,
  onSelectionChange,
}: RuleListProps) {
  const { t } = useTranslation(["rules", "common"]);
  const selectable = !!selectedIds && !!onSelectionChange;

  const toggleSelection = (ruleId: number) => {
    if (!selectedIds || !onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(ruleId)) {
      next.delete(ruleId);
    } else {
      next.add(ruleId);
    }
    onSelectionChange(next);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        {rules.map((rule) => {
          const eventLabel =
            constants?.eventTypes[rule.eventType]?.label ?? rule.eventType;
          const eventIcon = EVENT_ICONS[rule.eventType] ?? "bolt";
          const isSelected = selectedIds?.has(rule.id) ?? false;
          const hasSteps = !!(rule.steps?.length && rule.entryStepId);
          const lastFired = formatLastFired(rule.lastFired, t);

          return (
            <div
              key={rule.id}
              className={`group relative rounded-lg border bg-surface-low transition-all hover:bg-surface-high/40 ${
                isSelected
                  ? "border-accent/50 bg-accent/5"
                  : rule.enabled
                    ? "border-border hover:border-accent/20"
                    : "border-border/50"
              }`}
            >
              {/* Main clickable area */}
              <div
                className="cursor-pointer p-4 pb-3"
                onClick={() => onEdit(rule)}
              >
                {/* Top row: name, badges, actions */}
                <div className="flex items-center gap-3">
                  {/* Selection checkbox */}
                  {selectable && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(rule.id);
                      }}
                      className="flex items-center"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(rule.id)}
                      />
                    </div>
                  )}

                  {/* Event icon */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <Icon name={eventIcon} size={16} className="text-accent" />
                  </div>

                  {/* Name + event label */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold truncate ${!rule.enabled ? "text-text-muted" : ""}`}>
                        {rule.name}
                      </span>
                      {hasSteps && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              <Icon name="account_tree" size={10} className="me-0.5" />
                              {t("ruleList.workflowBadge")}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{t("ruleList.workflowTooltip")}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted">
                        {eventLabel}
                      </span>
                      <span className="text-text-muted/30">·</span>
                      <span className="text-xs text-text-muted/60">
                        {lastFired.fired ? t("ruleList.firedAgo", { time: lastFired.text }) : t("ruleList.neverFired")}
                      </span>
                      {rule.priority > 0 && (
                        <>
                          <span className="text-text-muted/30">·</span>
                          <span className="font-mono text-[10px] text-text-muted/50">
                            P{rule.priority}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right side: toggle + actions */}
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={() => onToggle(rule)}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{rule.enabled ? t("ruleList.disableRule") : t("ruleList.enableRule")}</TooltipContent>
                    </Tooltip>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <Icon name="more_vert" size={16} className="text-text-muted" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(rule)}>
                          <Icon name="edit" size={16} className="text-text-muted" />
                          {t("ruleList.editRule")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate(rule)}>
                          <Icon name="content_copy" size={16} className="text-text-muted" />
                          {t("ruleList.duplicate")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onToggle(rule)}>
                          <Icon name={rule.enabled ? "pause_circle" : "play_circle"} size={16} className="text-text-muted" />
                          {rule.enabled ? t("common:actions.disable") : t("common:actions.enable")}
                        </DropdownMenuItem>
                        {selectable && (
                          <DropdownMenuItem onClick={() => toggleSelection(rule.id)}>
                            <Icon name={isSelected ? "deselect" : "select_check_box"} size={16} className="text-text-muted" />
                            {isSelected ? t("ruleList.deselect") : t("ruleList.select")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(rule)}
                          className="text-danger focus:text-danger"
                        >
                          <Icon name="delete" size={16} />
                          {t("common:actions.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* Action flow strip */}
              <div
                className="cursor-pointer border-t border-border/50 px-4 py-2.5"
                onClick={() => onEdit(rule)}
              >
                <div className="flex items-center gap-0 overflow-x-auto">
                  {/* Trigger chip */}
                  <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-accent/20 bg-accent/5 px-2.5 py-1">
                    <Icon name={eventIcon} size={13} className="text-accent" />
                    <span className="text-[11px] font-medium text-accent">{t("nodes.triggerChip")}</span>
                  </div>

                  {/* Arrow */}
                  <div className="flex shrink-0 items-center">
                    <div className="h-px w-3 bg-accent/30" />
                    <div className="h-1.5 w-1.5 rotate-45 border-e border-t border-accent/40" />
                  </div>

                  {/* Action chips */}
                  {rule.actions.map((action, i) => {
                    const actionLabel =
                      constants?.actionTypes[action.type]?.label ?? action.type;
                    const actionIcon = ACTION_ICONS[action.type] ?? "play_arrow";
                    const preview = getActionPreview(action, t);
                    const isConfigured = action.type !== "";

                    return (
                      <div key={i} className="flex shrink-0 items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 rounded-md border border-outline-variant/10 bg-surface-high px-2.5 py-1">
                              <Icon name={actionIcon} size={13} className="text-secondary" />
                              <span className="text-[11px] font-medium text-text-muted">
                                {actionLabel || t("nodes.unconfigured")}
                              </span>
                              {!isConfigured && (
                                <span className="flex h-1.5 w-1.5 rounded-full bg-warning/60" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {preview ? `${actionLabel}: ${preview}` : actionLabel}
                          </TooltipContent>
                        </Tooltip>

                        {i < rule.actions.length - 1 && (
                          <div className="flex shrink-0 items-center">
                            <div className="h-px w-2 bg-secondary/30" />
                            <div className="h-1 w-1 rotate-45 border-e border-t border-secondary/30" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Step count indicator for workflow rules */}
                  {hasSteps && rule.steps && (
                    <>
                      <div className="flex shrink-0 items-center">
                        <div className="h-px w-2 bg-text-muted/20" />
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {t("ruleList.steps", { count: rule.steps.filter((s) => s.type === "condition" || s.type === "delay").length })}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
