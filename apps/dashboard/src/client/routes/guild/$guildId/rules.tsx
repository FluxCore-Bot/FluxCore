import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useRules, useUpdateRule, useDeleteRule } from "../../../lib/hooks/useRules";
import { useConstants } from "../../../lib/hooks/useConstants";
import { useUiStore } from "../../../stores/uiStore";
import { RuleList } from "../../../components/RuleList";
import { RuleForm } from "../../../components/RuleForm";
import type { ActionRule } from "../../../lib/schemas";

export function RulesPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: rules = [], isLoading } = useRules(guildId);
  const { data: constants } = useConstants();
  const updateRule = useUpdateRule(guildId);
  const deleteRule = useDeleteRule(guildId);
  const addToast = useUiStore((s) => s.addToast);

  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ActionRule | undefined>();

  if (isLoading) return <p className="text-text-muted">Loading...</p>;

  const handleEdit = (rule: ActionRule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleDelete = async (rule: ActionRule) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await deleteRule.mutateAsync(rule.id);
      addToast("Rule deleted", "success");
    } catch {
      addToast("Failed to delete rule", "error");
    }
  };

  const handleToggle = async (rule: ActionRule) => {
    try {
      await updateRule.mutateAsync({
        ruleId: rule.id,
        data: { enabled: !rule.enabled },
      });
      addToast(
        `Rule ${rule.enabled ? "disabled" : "enabled"}`,
        "success",
      );
    } catch {
      addToast("Failed to toggle rule", "error");
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRule(undefined);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Action Rules</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            + New Rule
          </button>
        )}
      </div>

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
    </div>
  );
}
