import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "@tanstack/react-router";
import { useConstants } from "../lib/hooks/useConstants";
import { useChannels } from "../lib/hooks/useChannels";
import { useRoles } from "../lib/hooks/useRoles";
import { useCreateRule, useUpdateRule } from "../lib/hooks/useRules";
import { useRuleDraft } from "../lib/hooks/useRuleDraft";
import { toast } from "sonner";
import { ActionRow } from "./ActionRow";
import { ConditionsEditor } from "./ConditionsEditor";
import { Icon } from "./Icon";
import { VariableHelper } from "./VariableHelper";
import { RuleFormSchema, type ActionConditions, type ActionConfig, type ActionRule, type RuleStep } from "../lib/schemas";
import { ApiError } from "../lib/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Alert } from "./ui/alert";
import { Card } from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { PageSkeleton } from "./PageSkeleton";

export interface RuleDraft {
  name: string;
  eventType: string;
  actions: ActionConfig[];
  steps?: RuleStep[];
  entryStepId?: string;
  conditions: ActionConditions;
  priority: number;
  enabled: boolean;
}

interface RuleFormProps {
  rule?: ActionRule;
  draft?: RuleDraft;
  onClose: () => void;
  onSwitchView?: (draft: RuleDraft) => void;
}

const emptyAction: ActionConfig = { type: "" };

export function RuleForm({ rule, draft, onClose, onSwitchView }: RuleFormProps) {
  const { t } = useTranslation("rules");
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: constants } = useConstants();
  const { data: channels = [] } = useChannels(guildId);
  const { data: roles = [] } = useRoles(guildId);
  const createRule = useCreateRule(guildId);
  const updateRule = useUpdateRule(guildId);
  const { saveDraft, loadDraft, clearDraft } = useRuleDraft(guildId, rule?.id);

  // Load saved draft on mount (only for new rules without an explicit draft)
  const savedDraft = !draft && !rule ? loadDraft() : null;
  const initialDraft = draft ?? savedDraft;

  const [name, setName] = useState(initialDraft?.name ?? rule?.name ?? "");
  const [eventType, setEventType] = useState(initialDraft?.eventType ?? rule?.eventType ?? "");
  const [actions, setActions] = useState<ActionConfig[]>(
    initialDraft?.actions ?? (rule?.actions.length ? rule.actions : [{ ...emptyAction }]),
  );
  const [conditions, setConditions] = useState<ActionConditions>(
    initialDraft?.conditions ?? rule?.conditions ?? {},
  );
  const [priority, setPriority] = useState(initialDraft?.priority ?? rule?.priority ?? 0);
  const [enabled, setEnabled] = useState(initialDraft?.enabled ?? rule?.enabled ?? true);
  const [error, setError] = useState("");
  const [hasDraft, setHasDraft] = useState(!!savedDraft);

  // Auto-save draft on changes
  useEffect(() => {
    saveDraft({ name, eventType, actions, conditions, priority, enabled });
  }, [name, eventType, actions, conditions, priority, enabled, saveDraft]);

  const dismissDraft = useCallback(() => {
    clearDraft();
    setHasDraft(false);
  }, [clearDraft]);

  if (!constants) return <PageSkeleton />;

  const handleActionChange = (index: number, action: ActionConfig) => {
    setActions((prev) => prev.map((a, i) => (i === index ? action : a)));
  };

  const handleActionRemove = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleActionMove = (index: number, direction: "up" | "down") => {
    setActions((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addAction = () => {
    if (actions.length < constants.maxActionsPerRule) {
      setActions((prev) => [...prev, { ...emptyAction }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Filter out unconfigured (empty type) actions before submitting
    const configuredActions = actions.filter((a) => a.type);
    if (configuredActions.length === 0) {
      setError(t("form.atLeastOneAction"));
      return;
    }

    const formData = {
      name: name.trim(),
      eventType,
      actions: configuredActions,
      conditions,
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
        toast.success(t("toast.updated"));
      } else {
        await createRule.mutateAsync(result.data);
        toast.success(t("toast.created"));
      }
      clearDraft();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("form.atLeastOneAction"));
    }
  };

  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {rule ? t("form.editRule") : t("form.createRule")}
        </h3>
        {onSwitchView && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onSwitchView({ name, eventType, actions, conditions, priority, enabled })
            }
          >
            <Icon name="account_tree" size={16} />
            {t("form.workflowView")}
          </Button>
        )}
      </div>

      {hasDraft && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm">
          <Icon name="history" size={16} className="text-accent" />
          <span className="text-text-muted">{t("form.draftRestored")}</span>
          <Button type="button" variant="link" size="sm" onClick={dismissDraft}>
            {t("form.dismiss")}
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">{error}</Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <Label>
            {t("form.ruleName")} <span className="text-danger">*</span>
          </Label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("form.ruleNamePlaceholder")}
            maxLength={50}
          />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <Label>
              {t("form.eventType")} <span className="text-danger">*</span>
            </Label>
            <Select value={eventType || undefined} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue placeholder={t("form.selectEvent")} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(constants.eventTypes).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("form.priority")}</Label>
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
            <Label className="mb-0">{t("form.actions")}</Label>
            {actions.length < constants.maxActionsPerRule && (
              <Button type="button" variant="link" size="sm" onClick={addAction}>
                {t("form.addAction")}
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
                onMove={handleActionMove}
                canRemove={actions.length > 1}
                isFirst={i === 0}
                isLast={i === actions.length - 1}
              />
            ))}
          </div>
        </div>

        <div className="mb-4">
          <ConditionsEditor
            conditions={conditions}
            onChange={setConditions}
            guildId={guildId}
          />
        </div>

        <div className="mb-6 flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <Label className="mb-0 text-sm">{t("form.enabled")}</Label>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? t("form.saving") : rule ? t("form.update") : t("form.create")}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("form.cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
