import { useState, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  useRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useBulkRuleAction,
} from "../../../lib/hooks/useRules";
import { useConstants } from "../../../lib/hooks/useConstants";
import { useAnalytics } from "../../../lib/hooks/useAnalytics";
import { toast } from "sonner";
import { RuleList } from "../../../components/RuleList";
import { WorkflowEditor, type RuleDraft } from "../../../components/workflow/WorkflowEditor";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageHeader } from "../../../components/PageHeader";
import { StatsCard } from "../../../components/StatsCard";
import { PageSkeleton } from "../../../components/PageSkeleton";
import { Icon } from "../../../components/Icon";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import type { ActionRule } from "../../../lib/schemas";

// ── Preset templates ──────────────────────────────────────────────────

interface RuleTemplate {
  icon: string;
  labelKey: string;
  descriptionKey: string;
  color: string;
  draft: RuleDraft;
}

const RULE_TEMPLATES: RuleTemplate[] = [
  {
    icon: "waving_hand",
    labelKey: "templates.welcomeMessage",
    descriptionKey: "templates.welcomeMessageDesc",
    color: "text-secondary",
    draft: {
      name: "Welcome Message",
      eventType: "memberJoin",
      actions: [{ type: "sendMessage", message: "Welcome to the server, {user}! We're glad to have you here." }],
      conditions: {},
      priority: 0,
      enabled: true,
    },
  },
  {
    icon: "shield_person",
    labelKey: "templates.autoRole",
    descriptionKey: "templates.autoRoleDesc",
    color: "text-accent",
    draft: {
      name: "Auto Role",
      eventType: "memberJoin",
      actions: [{ type: "addRole" }],
      conditions: {},
      priority: 0,
      enabled: true,
    },
  },
  {
    icon: "delete_sweep",
    labelKey: "templates.logDeleted",
    descriptionKey: "templates.logDeletedDesc",
    color: "text-warning",
    draft: {
      name: "Log Deleted Messages",
      eventType: "messageDeleted",
      actions: [{ type: "logToChannel" }],
      conditions: {},
      priority: 0,
      enabled: true,
    },
  },
  {
    icon: "rocket_launch",
    labelKey: "templates.boostThankYou",
    descriptionKey: "templates.boostThankYouDesc",
    color: "text-[#f47fff]",
    draft: {
      name: "Boost Thank You",
      eventType: "boostStart",
      actions: [{ type: "sendDM", message: "Thank you for boosting {guild}, {user}! You're awesome!" }],
      conditions: {},
      priority: 0,
      enabled: true,
    },
  },
  {
    icon: "gavel",
    labelKey: "templates.banLogger",
    descriptionKey: "templates.banLoggerDesc",
    color: "text-danger",
    draft: {
      name: "Ban Logger",
      eventType: "memberBanned",
      actions: [{ type: "logToChannel" }],
      conditions: {},
      priority: 0,
      enabled: true,
    },
  },
  {
    icon: "forum",
    labelKey: "templates.autoThread",
    descriptionKey: "templates.autoThreadDesc",
    color: "text-secondary",
    draft: {
      name: "Auto Thread",
      eventType: "messageCreated",
      actions: [{ type: "createThread", threadName: "Discussion: {user.name}" }],
      conditions: {},
      priority: 0,
      enabled: true,
    },
  },
];

// ── Sort / Filter helpers ─────────────────────────────────────────────

type SortOption = "priority" | "name" | "recent" | "status";

function sortRules(rules: ActionRule[], sort: SortOption): ActionRule[] {
  return [...rules].sort((a, b) => {
    switch (sort) {
      case "priority":
        return b.priority - a.priority;
      case "name":
        return a.name.localeCompare(b.name);
      case "recent": {
        const aTime = a.lastFired ? new Date(a.lastFired).getTime() : 0;
        const bTime = b.lastFired ? new Date(b.lastFired).getTime() : 0;
        return bTime - aTime;
      }
      case "status":
        return (b.enabled ? 1 : 0) - (a.enabled ? 1 : 0);
      default:
        return 0;
    }
  });
}

// ── Component ─────────────────────────────────────────────────────────

export function RulesPage() {
  const { t } = useTranslation("rules");
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: rules = [], isLoading } = useRules(guildId);
  const { data: constants } = useConstants();
  const { data: analytics } = useAnalytics(guildId, 7);
  const createRule = useCreateRule(guildId);
  const updateRule = useUpdateRule(guildId);
  const deleteRule = useDeleteRule(guildId);
  const bulkAction = useBulkRuleAction(guildId);

  const [showEditor, setShowEditor] = useState(false);
  const [editorDraft, setEditorDraft] = useState<RuleDraft | undefined>();
  const [editingRule, setEditingRule] = useState<ActionRule | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ActionRule | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("priority");

  // ── Filtered + sorted rules (must be before early return) ──

  const filteredRules = useMemo(() => {
    let result = rules;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }

    if (eventFilter !== "all") {
      result = result.filter((r) => r.eventType === eventFilter);
    }

    if (statusFilter === "enabled") {
      result = result.filter((r) => r.enabled);
    } else if (statusFilter === "disabled") {
      result = result.filter((r) => !r.enabled);
    }

    return sortRules(result, sortBy);
  }, [rules, search, eventFilter, statusFilter, sortBy]);

  // Unique event types used across rules (for filter dropdown)
  const usedEventTypes = useMemo(() => {
    const set = new Set(rules.map((r) => r.eventType));
    return Array.from(set).sort();
  }, [rules]);

  if (isLoading) return <PageSkeleton />;

  // ── Handlers ──

  const handleEdit = (rule: ActionRule) => {
    setEditingRule(rule);
    setEditorDraft(undefined);
    setShowEditor(true);
  };

  const handleDelete = (rule: ActionRule) => {
    setDeleteTarget(rule);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRule.mutateAsync(deleteTarget.id);
      toast.success(t("toast.deleted"));
    } catch {
      toast.error(t("toast.deleteFailed"));
    }
    setDeleteTarget(null);
  };

  const handleToggle = async (rule: ActionRule) => {
    try {
      await updateRule.mutateAsync({
        ruleId: rule.id,
        data: { enabled: !rule.enabled },
      });
      toast.success(rule.enabled ? t("toast.disabled") : t("toast.enabled"));
    } catch {
      toast.error(t("toast.toggleFailed"));
    }
  };

  const handleDuplicate = async (rule: ActionRule) => {
    const baseName = rule.name.replace(/\s*\(copy(?:\s*\d+)?\)$/, "");
    const existingNames = new Set(rules.map((r) => r.name));
    let newName = `${baseName} (copy)`;
    let counter = 2;
    while (existingNames.has(newName)) {
      newName = `${baseName} (copy ${counter})`;
      counter++;
    }

    try {
      await createRule.mutateAsync({
        name: newName,
        eventType: rule.eventType,
        actions: rule.actions,
        ...(rule.steps?.length && rule.entryStepId
          ? { steps: rule.steps, entryStepId: rule.entryStepId }
          : {}),
        conditions: rule.conditions,
        priority: rule.priority,
        enabled: rule.enabled,
      });
      toast.success(t("toast.duplicated"));
    } catch {
      toast.error(t("toast.duplicateFailed"));
    }
  };

  const handleBulkEnable = async () => {
    try {
      await bulkAction.mutateAsync({
        ruleIds: Array.from(selectedRuleIds),
        action: "enable",
      });
      toast.success(t("toast.bulkEnabled", { count: selectedRuleIds.size }));
      setSelectedRuleIds(new Set());
    } catch {
      toast.error(t("toast.bulkEnableFailed"));
    }
  };

  const handleBulkDisable = async () => {
    try {
      await bulkAction.mutateAsync({
        ruleIds: Array.from(selectedRuleIds),
        action: "disable",
      });
      toast.success(t("toast.bulkDisabled", { count: selectedRuleIds.size }));
      setSelectedRuleIds(new Set());
    } catch {
      toast.error(t("toast.bulkDisableFailed"));
    }
  };

  const confirmBulkDelete = async () => {
    try {
      await bulkAction.mutateAsync({
        ruleIds: Array.from(selectedRuleIds),
        action: "delete",
      });
      toast.success(t("toast.bulkDeleted", { count: selectedRuleIds.size }));
      setSelectedRuleIds(new Set());
    } catch {
      toast.error(t("toast.bulkDeleteFailed"));
    }
    setBulkDeleteConfirm(false);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingRule(undefined);
    setEditorDraft(undefined);
  };

  const handleUseTemplate = (template: RuleTemplate) => {
    setEditingRule(undefined);
    setEditorDraft(template.draft);
    setShowEditor(true);
  };

  const activeRules = rules.filter((r) => r.enabled).length;
  const executions7d = analytics?.summary.totalExecutions ?? 0;
  const successRate = analytics?.summary.successRate ?? 100;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-text-muted">
        <span className="text-accent">{t("common:brand.name")}</span>
        <Icon name="chevron_right" size={14} />
        <span>{t("breadcrumb.guild")}</span>
        <Icon name="chevron_right" size={14} />
        <span className="text-text">{t("breadcrumb.automation")}</span>
      </nav>

      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex items-center gap-3">
            {!showEditor && (
              <Button onClick={() => setShowEditor(true)}>
                <Icon name="add" /> {t("createRule")}
              </Button>
            )}
          </div>
        }
      />

      {!showEditor && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatsCard label={t("stats.totalRules")} value={rules.length} />
            <StatsCard
              label={t("stats.active")}
              value={activeRules}
              accentColor="border-secondary"
            />
            <StatsCard
              label={t("stats.executions7d")}
              value={executions7d}
              accentColor="border-accent"
            />
            <StatsCard
              label={t("stats.successRate")}
              value={rules.length > 0 ? `${Math.round(successRate)}%` : "--"}
              accentColor={successRate >= 90 ? "border-secondary" : "border-warning"}
              valueClassName={successRate < 90 ? "text-warning" : ""}
            />
          </div>

          {/* Search / Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:flex-1 sm:min-w-50">
              <Icon
                name="search"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <Input
                type="text"
                placeholder={t("filter.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t("filter.eventType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filter.allEvents")}</SelectItem>
                {usedEventTypes.map((et) => (
                  <SelectItem key={et} value={et}>
                    {constants?.eventTypes[et]?.label ?? et}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[calc(50%-6px)] sm:w-36">
                <SelectValue placeholder={t("filter.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filter.allStatus")}</SelectItem>
                <SelectItem value="enabled">{t("filter.enabled")}</SelectItem>
                <SelectItem value="disabled">{t("filter.disabled")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[calc(50%-6px)] sm:w-40">
                <SelectValue placeholder={t("filter.sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">{t("filter.priority")}</SelectItem>
                <SelectItem value="name">{t("filter.name")}</SelectItem>
                <SelectItem value="recent">{t("filter.lastFired")}</SelectItem>
                <SelectItem value="status">{t("filter.status")}</SelectItem>
              </SelectContent>
            </Select>

            {(search || eventFilter !== "all" || statusFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setEventFilter("all");
                  setStatusFilter("all");
                }}
                className="text-text-muted"
              >
                <Icon name="close" size={14} />
                {t("filter.clear")}
              </Button>
            )}
          </div>

          {/* Filter results badge */}
          {filteredRules.length !== rules.length && rules.length > 0 && (
            <p className="text-xs text-text-muted">
              {t("filter.showing", { filtered: filteredRules.length, total: rules.length })}
            </p>
          )}
        </>
      )}

      {/* Bulk action bar */}
      {!showEditor && selectedRuleIds.size > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-sm font-medium">
            {t("bulk.selected", { count: selectedRuleIds.size })}
          </span>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button variant="ghost" size="sm" onClick={handleBulkEnable}>
              <Icon name="check_circle" size={16} />
              {t("bulk.enable")}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBulkDisable}>
              <Icon name="cancel" size={16} />
              {t("bulk.disable")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger"
              onClick={() => setBulkDeleteConfirm(true)}
            >
              <Icon name="delete" size={16} />
              {t("bulk.delete")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRuleIds(new Set())}
            >
              {t("bulk.clear")}
            </Button>
          </div>
        </div>
      )}

      {showEditor ? (
        <WorkflowEditor rule={editingRule} draft={editorDraft} onClose={handleCloseEditor} />
      ) : rules.length === 0 ? (
        /* ── Template gallery (empty state) ── */
        <div className="rounded-lg border border-border bg-surface-low p-8 glass-edge">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <Icon name="bolt" size={24} className="text-accent" />
            </div>
            <h3 className="text-lg font-semibold">{t("empty.title")}</h3>
            <p className="mt-1 text-sm text-text-muted">
              {t("empty.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RULE_TEMPLATES.map((template) => (
              <button
                key={template.labelKey}
                onClick={() => handleUseTemplate(template)}
                className="group flex items-start gap-3 rounded-lg border border-border bg-surface-lowest p-4 text-left transition-all hover:border-accent/40 hover:bg-surface-high/50"
              >
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-high ${template.color}`}>
                  <Icon name={template.icon} size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text group-hover:text-accent transition-colors">
                    {t(template.labelKey)}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                    {t(template.descriptionKey)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            <Button variant="ghost" onClick={() => setShowEditor(true)} className="gap-2">
              <Icon name="add" size={16} />
              {t("empty.createFromScratch")}
            </Button>
          </div>
        </div>
      ) : filteredRules.length === 0 ? (
        /* No results from filter */
        <div className="flex flex-col items-center justify-center rounded-lg bg-surface-low p-12 text-center glass-edge">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-high">
            <Icon name="search_off" size={24} className="text-text-muted" />
          </div>
          <h3 className="text-lg font-semibold">{t("noResults.title")}</h3>
          <p className="mt-1 max-w-sm text-sm text-text-muted">
            {t("noResults.description")}
          </p>
        </div>
      ) : (
        <RuleList
          rules={filteredRules}
          constants={constants}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggle={handleToggle}
          onDuplicate={handleDuplicate}
          selectedIds={selectedRuleIds}
          onSelectionChange={setSelectedRuleIds}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("deleteDialog.title")}
        description={t("deleteDialog.description", { name: deleteTarget?.name })}
        onConfirm={confirmDelete}
        confirmLabel={t("deleteDialog.confirm")}
        destructive
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={(open) => !open && setBulkDeleteConfirm(false)}
        title={t("bulkDeleteDialog.title")}
        description={t("bulkDeleteDialog.description", { count: selectedRuleIds.size })}
        onConfirm={confirmBulkDelete}
        confirmLabel={t("bulkDeleteDialog.confirm")}
        destructive
      />
    </div>
  );
}
