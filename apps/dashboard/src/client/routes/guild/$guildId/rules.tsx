import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useRules, useUpdateRule, useDeleteRule } from "../../../lib/hooks/useRules";
import { useConstants } from "../../../lib/hooks/useConstants";
import { toast } from "sonner";
import { RuleList } from "../../../components/RuleList";
import { RuleForm } from "../../../components/RuleForm";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Icon } from "../../../components/Icon";
import { Button } from "../../../components/ui/button";
import type { ActionRule } from "../../../lib/schemas";

export function RulesPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: rules = [], isLoading } = useRules(guildId);
  const { data: constants } = useConstants();
  const updateRule = useUpdateRule(guildId);
  const deleteRule = useDeleteRule(guildId);

  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ActionRule | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ActionRule | null>(null);

  if (isLoading) return <p className="text-text-muted">Loading...</p>;

  const handleEdit = (rule: ActionRule) => {
    setEditingRule(rule);
    setShowForm(true);
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

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRule(undefined);
  };

  const activeRules = rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Automation Rules</h2>
          <p className="mt-1 text-sm text-text-muted">Configure event-driven triggers and automated responses for your guild.</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Icon name="add" /> Create Rule
          </Button>
        )}
      </div>

      {/* Stats */}
      {!showForm && (
        <div className="grid grid-cols-3 gap-4">
          <div className="border-l-2 border-accent bg-surface-low p-4">
            <p className="font-label text-[10px] uppercase tracking-wider text-text-muted">Total Rules</p>
            <p className="font-mono text-2xl font-bold">{rules.length}</p>
          </div>
          <div className="border-l-2 border-secondary bg-surface-low p-4">
            <p className="font-label text-[10px] uppercase tracking-wider text-text-muted">Active Now</p>
            <p className="font-mono text-2xl font-bold">{String(activeRules).padStart(2, '0')}</p>
          </div>
          <div className="border-l-2 border-danger bg-surface-low p-4">
            <p className="font-label text-[10px] uppercase tracking-wider text-text-muted">Disabled</p>
            <p className="font-mono text-2xl font-bold text-danger">{String(rules.length - activeRules).padStart(2, '0')}</p>
          </div>
        </div>
      )}

      {showForm ? (
        <RuleForm rule={editingRule} onClose={handleCloseForm} />
      ) : (
        <RuleList
          rules={rules}
          constants={constants}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggle={handleToggle}
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
    </div>
  );
}
