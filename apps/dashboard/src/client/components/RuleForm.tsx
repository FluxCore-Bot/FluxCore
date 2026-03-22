import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useConstants } from "../lib/hooks/useConstants";
import { useChannels } from "../lib/hooks/useChannels";
import { useRoles } from "../lib/hooks/useRoles";
import { useCreateRule, useUpdateRule } from "../lib/hooks/useRules";
import { toast } from "sonner";
import { ActionRow } from "./ActionRow";
import { VariableHelper } from "./VariableHelper";
import { RuleFormSchema, type ActionConfig, type ActionRule } from "../lib/schemas";
import { ApiError } from "../lib/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Alert } from "./ui/alert";
import { Card } from "./ui/card";

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
        toast.success("Rule updated");
      } else {
        await createRule.mutateAsync(result.data);
        toast.success("Rule created");
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
    <Card className="p-6">
      <h3 className="mb-4 text-lg font-semibold">
        {rule ? "Edit Rule" : "Create Rule"}
      </h3>

      {error && (
        <Alert variant="destructive" className="mb-4">{error}</Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <Label>
            Rule Name <span className="text-danger">*</span>
          </Label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My rule..."
            maxLength={50}
          />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <Label>
              Event Type <span className="text-danger">*</span>
            </Label>
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
            <Label>Priority</Label>
            <Input
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
            <Label className="mb-0">Actions</Label>
            {actions.length < constants.maxActionsPerRule && (
              <Button type="button" variant="link" size="sm" onClick={addAction}>
                + Add Action
              </Button>
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
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <Label className="mb-0 text-sm">Enabled</Label>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
