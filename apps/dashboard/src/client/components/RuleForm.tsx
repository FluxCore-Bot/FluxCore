import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useConstants } from "../lib/hooks/useConstants";
import { useChannels } from "../lib/hooks/useChannels";
import { useRoles } from "../lib/hooks/useRoles";
import { useCreateRule, useUpdateRule } from "../lib/hooks/useRules";
import { useUiStore } from "../stores/uiStore";
import { ActionRow } from "./ActionRow";
import { VariableHelper } from "./VariableHelper";
import { RuleFormSchema, type ActionConfig, type ActionRule } from "../lib/schemas";
import { ApiError } from "../lib/client";

interface RuleFormProps {
  rule?: ActionRule;
  onClose: () => void;
}

const emptyAction: ActionConfig = { type: "" };

export function RuleForm({ rule, onClose }: RuleFormProps) {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: constants } = useConstants();
  const { data: channels = [] } = useChannels(guildId);
  const { data: roles = [] } = useRoles(guildId);
  const createRule = useCreateRule(guildId);
  const updateRule = useUpdateRule(guildId);
  const addToast = useUiStore((s) => s.addToast);

  const [name, setName] = useState(rule?.name ?? "");
  const [eventType, setEventType] = useState(rule?.eventType ?? "");
  const [actions, setActions] = useState<ActionConfig[]>(
    rule?.actions.length ? rule.actions : [{ ...emptyAction }],
  );
  const [priority, setPriority] = useState(rule?.priority ?? 0);
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [error, setError] = useState("");

  if (!constants) return <p className="text-text-muted">Loading...</p>;

  const handleActionChange = (index: number, action: ActionConfig) => {
    setActions((prev) => prev.map((a, i) => (i === index ? action : a)));
  };

  const handleActionRemove = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const addAction = () => {
    if (actions.length < constants.maxActionsPerRule) {
      setActions((prev) => [...prev, { ...emptyAction }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const formData = {
      name: name.trim(),
      eventType,
      actions,
      conditions: {},
      priority,
      enabled,
    };

    const result = RuleFormSchema.safeParse(formData);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    try {
      if (rule) {
        await updateRule.mutateAsync({ ruleId: rule.id, data: result.data });
        addToast("Rule updated", "success");
      } else {
        await createRule.mutateAsync(result.data);
        addToast("Rule created", "success");
      }
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "An error occurred";
      setError(message);
    }
  };

  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-6"
    >
      <h3 className="mb-4 text-lg font-semibold">
        {rule ? "Edit Rule" : "Create Rule"}
      </h3>

      {error && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="mb-1 block text-xs text-text-muted">
          Rule Name <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My rule..."
          maxLength={50}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs text-text-muted">
            Event Type <span className="text-danger">*</span>
          </label>
          <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">Select event...</option>
            {Object.entries(constants.eventTypes).map(([key, info]) => (
              <option key={key} value={key}>
                {info.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-muted">Priority</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            min={0}
            max={100}
          />
        </div>
      </div>

      {eventType && (
        <div className="mb-4">
          <VariableHelper eventType={eventType} constants={constants} />
        </div>
      )}

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-text-muted">Actions</label>
          {actions.length < constants.maxActionsPerRule && (
            <button
              type="button"
              onClick={addAction}
              className="text-xs text-accent hover:underline"
            >
              + Add Action
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {actions.map((action, i) => (
            <ActionRow
              key={i}
              index={i}
              action={action}
              constants={constants}
              channels={channels}
              roles={roles}
              onChange={handleActionChange}
              onRemove={handleActionRemove}
              canRemove={actions.length > 1}
            />
          ))}
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <label className="relative inline-block h-5.5 w-10">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 cursor-pointer rounded-full bg-border transition peer-checked:bg-accent" />
          <span className="absolute bottom-0.75 left-0.75 h-4 w-4 rounded-full bg-text transition peer-checked:translate-x-[18px]" />
        </label>
        <span className="text-sm text-text-muted">Enabled</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-5 py-2 text-sm text-text-muted transition hover:text-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
