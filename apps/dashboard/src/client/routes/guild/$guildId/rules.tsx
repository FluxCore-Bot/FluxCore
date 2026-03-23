import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  useRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useBulkRuleAction,
} from "../../../lib/hooks/useRules";
import { useConstants } from "../../../lib/hooks/useConstants";
import { toast } from "sonner";
import { RuleList } from "../../../components/RuleList";
import { WorkflowEditor, type RuleDraft } from "../../../components/workflow/WorkflowEditor";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageHeader } from "../../../components/PageHeader";
import { StatsCard } from "../../../components/StatsCard";
import { PageSkeleton } from "../../../components/PageSkeleton";
import { Icon } from "../../../components/Icon";
import { Button } from "../../../components/ui/button";
import type { ActionRule } from "../../../lib/schemas";

export function RulesPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: rules = [], isLoading } = useRules(guildId);
  const { data: constants } = useConstants();
  const createRule = useCreateRule(guildId);
  const updateRule = useUpdateRule(guildId);
  const deleteRule = useDeleteRule(guildId);
  const bulkAction = useBulkRuleAction(guildId);

  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<ActionRule | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ActionRule | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  if (isLoading) return <PageSkeleton />;

  const handleEdit = (rule: ActionRule) => {
    setEditingRule(rule);
    setShowEditor(true);
  };

  const handleDelete = (rule: ActionRule) => {
    setDeleteTarget(rule);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRule.mutateAsync(deleteTarget.id);
      toast.success("Rule deleted");
    } catch {
      toast.error("Failed to delete rule");
    }
    setDeleteTarget(null);
  };

  const handleToggle = async (rule: ActionRule) => {
    try {
      await updateRule.mutateAsync({
        ruleId: rule.id,
        data: { enabled: !rule.enabled },
      });
      toast.success(`Rule ${rule.enabled ? "disabled" : "enabled"}`);
    } catch {
      toast.error("Failed to toggle rule");
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
      toast.success("Rule duplicated");
    } catch {
      toast.error("Failed to duplicate rule");
    }
  };

  const handleBulkEnable = async () => {
    try {
      await bulkAction.mutateAsync({
        ruleIds: Array.from(selectedRuleIds),
        action: "enable",
      });
      toast.success(`${selectedRuleIds.size} rules enabled`);
      setSelectedRuleIds(new Set());
    } catch {
      toast.error("Failed to enable rules");
    }
  };

  const handleBulkDisable = async () => {
    try {
      await bulkAction.mutateAsync({
        ruleIds: Array.from(selectedRuleIds),
        action: "disable",
      });
      toast.success(`${selectedRuleIds.size} rules disabled`);
      setSelectedRuleIds(new Set());
    } catch {
      toast.error("Failed to disable rules");
    }
  };

  const confirmBulkDelete = async () => {
    try {
      await bulkAction.mutateAsync({
        ruleIds: Array.from(selectedRuleIds),
        action: "delete",
      });
      toast.success(`${selectedRuleIds.size} rules deleted`);
      setSelectedRuleIds(new Set());
    } catch {
      toast.error("Failed to delete rules");
    }
    setBulkDeleteConfirm(false);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingRule(undefined);
  };

  const activeRules = rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Automation Rules"
        subtitle="Configure event-driven triggers and automated responses for your guild."
        actions={
          <div className="flex items-center gap-3">
            {!showEditor && (
              <Button onClick={() => setShowEditor(true)}>
                <Icon name="add" /> Create Rule
              </Button>
            )}
          </div>
        }
      />

      {!showEditor && (
        <div className="grid grid-cols-3 gap-4">
          <StatsCard label="Total Rules" value={rules.length} />
          <StatsCard
            label="Active Now"
            value={String(activeRules).padStart(2, "0")}
            accentColor="border-secondary"
          />
          <StatsCard
            label="Disabled"
            value={String(rules.length - activeRules).padStart(2, "0")}
            accentColor="border-danger"
            valueClassName="text-danger"
          />
        </div>
      )}

      {/* Bulk action bar */}
      {!showEditor && selectedRuleIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedRuleIds.size} rule{selectedRuleIds.size > 1 ? "s" : ""} selected
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleBulkEnable}>
              <Icon name="check_circle" size={16} />
              Enable All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBulkDisable}>
              <Icon name="cancel" size={16} />
              Disable All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger"
              onClick={() => setBulkDeleteConfirm(true)}
            >
              <Icon name="delete" size={16} />
              Delete All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRuleIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {showEditor ? (
        <WorkflowEditor rule={editingRule} onClose={handleCloseEditor} />
      ) : (
        <RuleList
          rules={rules}
          constants={constants}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggle={handleToggle}
          onDuplicate={handleDuplicate}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Rule"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        confirmLabel="Delete"
        destructive
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={(open) => !open && setBulkDeleteConfirm(false)}
        title="Delete Selected Rules"
        description={`Are you sure you want to delete ${selectedRuleIds.size} rule${selectedRuleIds.size > 1 ? "s" : ""}? This action cannot be undone.`}
        onConfirm={confirmBulkDelete}
        confirmLabel="Delete All"
        destructive
      />
    </div>
  );
}
