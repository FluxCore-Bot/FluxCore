import { useState, useMemo, useRef, useEffect, useId } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useChannels } from "../../../shared/hooks/useChannels";
import { useRoles } from "../../../shared/hooks/useRoles";
import { ActionFields } from "../components/ActionFields";
import { buildAutomationVariables, DiscordMessagePreview, usePreviewContext } from "../../../shared/ui/variable-field";
import type { VariableDescriptor } from "../../../shared/ui/variable-field";
import { Button } from "../../../shared/ui/button";
import { Label } from "../../../shared/ui/label";
import { Input } from "../../../shared/ui/input";
import { Badge } from "../../../shared/ui/badge";
import { Icon } from "../../../shared/components/Icon";
import { ScrollArea } from "../../../shared/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../shared/ui/tabs";
import { SearchableSelect } from "../../../shared/ui/searchable-select";
import { EVENT_ICONS } from "../lib/rule-icons";
import { buildActionTypeOptions } from "../lib/action-options";
import { ConditionsEditor } from "../components/ConditionsEditor";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import type {
  ActionConditions,
  ActionConfig,
  ActionFieldDescriptor,
  Constants,
  RuleStep,
  StepConditionConfig,
} from "../../../shared/lib/schemas";

interface TriggerPanelProps {
  type: "trigger";
  eventType: string;
  constants: Constants;
  guildId: string;
  conditions: ActionConditions;
  onEventTypeChange: (eventType: string) => void;
  onConditionsChange: (conditions: ActionConditions) => void;
  onClose: () => void;
}

interface ActionPanelProps {
  type: "action";
  index: number;
  action: ActionConfig;
  constants: Constants;
  guildId: string;
  eventType: string;
  totalActions: number;
  onActionChange: (index: number, action: ActionConfig) => void;
  onActionRemove: (index: number) => void;
  onActionMove: (index: number, direction: "up" | "down") => void;
  canRemove: boolean;
  onClose: () => void;
}

interface StepPanelProps {
  type: "step";
  stepId: string;
  steps: RuleStep[];
  constants: Constants;
  guildId: string;
  eventType: string;
  onStepChange: (stepId: string, step: RuleStep) => void;
  onStepRemove: (stepId: string) => void;
  onClose: () => void;
}

type NodeDetailPanelProps = TriggerPanelProps | ActionPanelProps | StepPanelProps;

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = path.split(".");
  if (parts.length === 1) {
    return { ...obj, [parts[0]]: value };
  }
  const [first, ...rest] = parts;
  const child =
    typeof obj[first] === "object" && obj[first] !== null
      ? (obj[first] as Record<string, unknown>)
      : {};
  return {
    ...obj,
    [first]: setNestedValue(child, rest.join("."), value),
  };
}

function getHeaderInfo(props: NodeDetailPanelProps, t: TFunction) {
  if (props.type === "trigger") {
    return { icon: "bolt", color: "bg-accent/20", textColor: "text-accent", label: t("panel.trigger") };
  }
  if (props.type === "step") {
    const step = props.steps.find((s) => s.id === props.stepId);
    if (step?.type === "condition") {
      return { icon: "call_split", color: "bg-warning/20", textColor: "text-warning", label: t("panel.condition") };
    }
    if (step?.type === "delay") {
      return { icon: "schedule", color: "bg-text-muted/15", textColor: "text-text-muted", label: t("panel.delay") };
    }
    return { icon: "play_arrow", color: "bg-secondary/15", textColor: "text-secondary", label: t("panel.actionStep") };
  }
  return { icon: "play_arrow", color: "bg-secondary/15", textColor: "text-secondary", label: t("panel.action", { index: props.index + 1 }) };
}

/** Danger button that confirms before running a destructive node/step removal. */
function RemoveButton({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => void;
}) {
  const { t } = useTranslation(["rules", "common"]);
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-danger hover:bg-danger/10 hover:text-danger"
        onClick={() => setOpen(true)}
      >
        <Icon name="delete" size={16} />
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description={t("panel.removeConfirmDescription")}
        onConfirm={onConfirm}
        confirmLabel={t("common:actions.remove")}
        destructive
      />
    </div>
  );
}

export function NodeDetailPanel(props: NodeDetailPanelProps) {
  const { onClose } = props;
  const { t, i18n } = useTranslation(["rules", "common"]);
  const header = getHeaderInfo(props, t);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  // Move focus into the panel when it opens and restore it to the element that
  // was focused before (the originating node) when it closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  return (
    <div
      ref={panelRef}
      dir={i18n.dir()}
      role="dialog"
      aria-labelledby={headingId}
      tabIndex={-1}
      className="absolute right-0 top-0 z-20 flex h-full w-full flex-col border-l border-border bg-surface-low outline-none animate-in slide-in-from-right-4 duration-200 motion-reduce:animate-none sm:w-96"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-6 w-6 items-center justify-center rounded ${header.color}`}>
            <Icon name={header.icon} size={14} className={header.textColor} />
          </div>
          <h2 id={headingId} className="text-sm font-semibold text-text">
            {header.label}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={t("common:actions.close")}
          className="h-9 w-9"
        >
          <Icon name="close" size={16} />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {props.type === "trigger" ? (
            <TriggerPanel {...props} />
          ) : props.type === "step" ? (
            <StepPanel {...props} />
          ) : (
            <ActionPanel {...props} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function TriggerPanel({
  eventType,
  constants,
  guildId,
  conditions,
  onEventTypeChange,
  onConditionsChange,
}: TriggerPanelProps) {
  const { t } = useTranslation(["rules", "common"]);
  const variables = eventType ? (constants.eventTypeVariables[eventType] ?? []) : [];

  const eventOptions = useMemo(
    () =>
      Object.entries(constants.eventTypes).map(([value, info]) => ({
        value,
        label: info.label,
        keywords: info.description,
        icon: <Icon name={EVENT_ICONS[value] ?? "bolt"} size={16} />,
      })),
    [constants.eventTypes],
  );

  const conditionCount =
    (conditions.channelIds?.length ?? 0) +
    (conditions.roleIds?.length ?? 0) +
    (conditions.userIds?.length ?? 0) +
    (conditions.excludeChannelIds?.length ?? 0) +
    (conditions.excludeRoleIds?.length ?? 0) +
    (conditions.excludeUserIds?.length ?? 0);

  return (
    <Tabs defaultValue="settings">
      <TabsList className="w-full">
        <TabsTrigger value="settings" className="flex-1">
          <Icon name="settings" size={14} className="me-1.5" />
          {t("panel.settings")}
        </TabsTrigger>
        <TabsTrigger value="conditions" className="flex-1">
          <Icon name="filter_alt" size={14} className="me-1.5" />
          {t("panel.filters")}
          {conditionCount > 0 && (
            <Badge variant="secondary" className="ms-1.5 h-4 px-1 text-[10px]">
              {conditionCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="variables" className="flex-1">
          <Icon name="data_object" size={14} className="me-1.5" />
          {t("panel.vars")}
          {variables.length > 0 && (
            <Badge variant="secondary" className="ms-1.5 h-4 px-1 text-[10px]">
              {variables.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="settings">
        <div className="space-y-4">
          <div>
            <Label>
              {t("panel.eventType")} <span aria-hidden="true" className="text-danger">*</span>
              <span className="sr-only"> ({t("common:labels.required")})</span>
            </Label>
            <SearchableSelect
              options={eventOptions}
              value={eventType || null}
              onValueChange={(v) => v && onEventTypeChange(v)}
              placeholder={t("panel.selectEvent")}
              searchPlaceholder={t("panel.searchEvent")}
              noResultsLabel={t("panel.noEventResults")}
            />
          </div>
          {eventType && constants.eventTypes[eventType] && (
            <div className="rounded-lg bg-surface-lowest p-3">
              <p className="text-xs leading-relaxed text-text-muted">
                {constants.eventTypes[eventType].description}
              </p>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="conditions">
        <ConditionsEditor
          conditions={conditions}
          onChange={onConditionsChange}
          guildId={guildId}
          // Undefined until a trigger is picked — ConditionsEditor then offers
          // everything rather than rendering an empty panel.
          supported={eventType ? constants.eventConditionSupport[eventType] : undefined}
          alwaysExpanded
        />
      </TabsContent>

      <TabsContent value="variables">
        <VariablesTab variables={variables} constants={constants} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * The action type picker, its fields and its message preview.
 *
 * Shared by the linear ActionPanel and the step-mode StepPanel so the two can
 * never diverge again — step mode previously rendered a stripped-down copy with
 * no preview, so adding a single condition or delay to a rule silently removed
 * the preview from every action in it.
 */
function ActionSettings({
  action,
  constants,
  guildId,
  variables,
  onTypeChange,
  onFieldChange,
}: {
  action: ActionConfig;
  constants: Constants;
  guildId: string;
  variables: VariableDescriptor[];
  onTypeChange: (type: string) => void;
  onFieldChange: (key: string, value: unknown) => void;
}) {
  const { t } = useTranslation(["rules", "common"]);
  const { data: channels = [] } = useChannels(guildId);
  const { data: roles = [] } = useRoles(guildId);
  const real = usePreviewContext(guildId);
  const fields: ActionFieldDescriptor[] =
    constants.actionTypeFields[action.type] ?? [];

  return (
    <>
      <div>
        <Label>
          {t("panel.actionType")} <span aria-hidden="true" className="text-danger">*</span>
          <span className="sr-only"> ({t("common:labels.required")})</span>
        </Label>
        <SearchableSelect
          options={buildActionTypeOptions(constants.actionTypes)}
          value={action.type || null}
          onValueChange={(v) => v && onTypeChange(v)}
          placeholder={t("panel.selectAction")}
          searchPlaceholder={t("panel.search")}
          noResultsLabel={t("panel.noResults")}
        />
      </div>

      {action.type && fields.length > 0 && (
        <ActionFields
          fields={fields}
          values={action as unknown as Record<string, unknown>}
          onChange={onFieldChange}
          channels={channels}
          roles={roles}
          variables={variables}
        />
      )}

      {(action.type === "sendMessage" || action.type === "sendDM") && (
        <div className="mt-2">
          <DiscordMessagePreview
            variables={variables}
            real={real}
            content={action.message ?? ""}
          />
        </div>
      )}
      {action.type === "sendEmbed" && (
        <div className="mt-2">
          <DiscordMessagePreview
            variables={variables}
            real={real}
            embed={{
              title: action.embed?.title,
              description: action.embed?.description,
              footer: action.embed?.footer,
              color: action.embed?.color,
            }}
          />
        </div>
      )}
    </>
  );
}

/** Settings/Variables tab shell shared by both action editors. */
function ActionTabs({
  eventType,
  constants,
  children,
}: {
  eventType: string;
  constants: Constants;
  children: React.ReactNode;
}) {
  const { t } = useTranslation(["rules", "common"]);
  return (
    <Tabs defaultValue="settings">
      <TabsList className="w-full">
        <TabsTrigger value="settings" className="flex-1">
          <Icon name="settings" size={14} className="me-1.5" />
          {t("panel.settings")}
        </TabsTrigger>
        <TabsTrigger value="variables" className="flex-1">
          <Icon name="data_object" size={14} className="me-1.5" />
          {t("panel.variables")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="settings">
        <div className="space-y-4">{children}</div>
      </TabsContent>

      <TabsContent value="variables">
        {/* Scoped to the selected trigger, exactly like the trigger panel's own
            tab. Listing every token in the system contradicted both the
            autocomplete beside it and the editor's unknown-token validator,
            and invited templates the bot renders as "Unknown". */}
        <VariablesTab
          variables={eventType ? (constants.eventTypeVariables[eventType] ?? []) : []}
          constants={constants}
        />
      </TabsContent>
    </Tabs>
  );
}

function ActionPanel({
  index,
  action,
  constants,
  guildId,
  eventType,
  totalActions,
  onActionChange,
  onActionRemove,
  onActionMove,
  canRemove,
}: ActionPanelProps) {
  const { t } = useTranslation(["rules", "common"]);
  const variables = buildAutomationVariables(constants, eventType);

  const handleTypeChange = (newType: string) => {
    onActionChange(index, { type: newType });
  };

  const handleFieldChange = (key: string, value: unknown) => {
    const updated = setNestedValue(
      action as unknown as Record<string, unknown>,
      key,
      value,
    ) as unknown as ActionConfig;
    onActionChange(index, updated);
  };

  return (
    <ActionTabs eventType={eventType} constants={constants}>
      <ActionSettings
        action={action}
        constants={constants}
        guildId={guildId}
        variables={variables}
        onTypeChange={handleTypeChange}
        onFieldChange={handleFieldChange}
      />

      {totalActions > 1 && (
        <div className="flex gap-2 border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            disabled={index === 0}
            onClick={() => onActionMove(index, "up")}
          >
            <Icon name="arrow_upward" size={16} />
            {t("panel.moveUp")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            disabled={index === totalActions - 1}
            onClick={() => onActionMove(index, "down")}
          >
            <Icon name="arrow_downward" size={16} />
            {t("panel.moveDown")}
          </Button>
        </div>
      )}

      {canRemove && (
        <RemoveButton
          label={t("panel.removeAction")}
          onConfirm={() => onActionRemove(index)}
        />
      )}
    </ActionTabs>
  );
}

const CONDITION_FIELDS: Array<{ value: string; labelKey: string }> = [
  { value: "channelId", labelKey: "conditionFields.channelId" },
  { value: "channelName", labelKey: "conditionFields.channelName" },
  { value: "userId", labelKey: "conditionFields.userId" },
  { value: "userName", labelKey: "conditionFields.userName" },
  { value: "roleId", labelKey: "conditionFields.roleId" },
  { value: "roleName", labelKey: "conditionFields.roleName" },
  { value: "messageContent", labelKey: "conditionFields.messageContent" },
  { value: "memberCount", labelKey: "conditionFields.memberCount" },
];

const CONDITION_OPERATORS: Array<{ value: string; labelKey: string }> = [
  { value: "equals", labelKey: "conditionOperators.equals" },
  { value: "notEquals", labelKey: "conditionOperators.notEquals" },
  { value: "contains", labelKey: "conditionOperators.contains" },
  { value: "notContains", labelKey: "conditionOperators.notContains" },
  { value: "startsWith", labelKey: "conditionOperators.startsWith" },
  { value: "endsWith", labelKey: "conditionOperators.endsWith" },
  { value: "greaterThan", labelKey: "conditionOperators.greaterThan" },
  { value: "lessThan", labelKey: "conditionOperators.lessThan" },
  { value: "hasRole", labelKey: "conditionOperators.hasRole" },
  { value: "notHasRole", labelKey: "conditionOperators.notHasRole" },
  { value: "inList", labelKey: "conditionOperators.inList" },
  { value: "notInList", labelKey: "conditionOperators.notInList" },
];

const END_TARGET = "__end__";

/** Short human label for a step, used in the keyboard-accessible target pickers. */
function stepShortLabel(step: RuleStep, constants: Constants, t: TFunction): string {
  if (step.type === "action") {
    return (
      constants.actionTypes[step.action.type]?.label ??
      (step.action.type || t("nodes.selectAction"))
    );
  }
  if (step.type === "condition") {
    return step.condition.field
      ? t("nodes.ifField", { field: step.condition.field })
      : t("nodes.configureCondition");
  }
  return t("nodes.delayLabel");
}

/**
 * Keyboard-accessible alternative to dragging an edge: pick the step a branch
 * should connect to (or "End" to stop the flow). Sets the same next/thenNext/
 * elseNext fields that a drag connection would.
 */
function StepTargetSelect({
  label,
  value,
  steps,
  selfId,
  constants,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  steps: RuleStep[];
  selfId: string;
  constants: Constants;
  onChange: (next: string | null) => void;
}) {
  const { t } = useTranslation("rules");
  const options = [
    { value: END_TARGET, label: t("panel.endStop") },
    ...steps
      .filter((s) => s.id !== selfId)
      .map((s) => ({ value: s.id, label: stepShortLabel(s, constants, t) })),
  ];
  return (
    <div>
      <Label>{label}</Label>
      <SearchableSelect
        options={options}
        value={value ?? END_TARGET}
        onValueChange={(v) => onChange(!v || v === END_TARGET ? null : v)}
        placeholder={t("panel.selectStep")}
        searchPlaceholder={t("panel.search")}
        noResultsLabel={t("panel.noResults")}
      />
    </div>
  );
}

function StepPanel({
  stepId,
  steps,
  constants,
  guildId,
  eventType,
  onStepChange,
  onStepRemove,
}: StepPanelProps) {
  const { t } = useTranslation(["rules", "common"]);
  const variables = buildAutomationVariables(constants, eventType);
  const step = steps.find((s) => s.id === stepId);
  if (!step) return <p className="text-xs text-text-muted">{t("panel.stepNotFound")}</p>;

  if (step.type === "action") {
    const handleTypeChange = (newType: string) => {
      onStepChange(stepId, { ...step, action: { type: newType } });
    };

    const handleFieldChange = (key: string, value: unknown) => {
      const updated = setNestedValue(
        step.action as unknown as Record<string, unknown>,
        key,
        value,
      ) as unknown as typeof step.action;
      onStepChange(stepId, { ...step, action: updated });
    };

    return (
      <ActionTabs eventType={eventType} constants={constants}>
        <ActionSettings
          action={step.action}
          constants={constants}
          guildId={guildId}
          variables={variables}
          onTypeChange={handleTypeChange}
          onFieldChange={handleFieldChange}
        />

        <div className="space-y-3 border-t border-border pt-3">
          <span className="section-label text-text-muted">{t("panel.connections")}</span>
          <StepTargetSelect
            label={t("panel.nextTarget")}
            value={step.next}
            steps={steps}
            selfId={stepId}
            constants={constants}
            onChange={(v) => onStepChange(stepId, { ...step, next: v })}
          />
        </div>

        <RemoveButton
          label={t("panel.removeStep")}
          onConfirm={() => onStepRemove(stepId)}
        />
      </ActionTabs>
    );
  }

  if (step.type === "condition") {
    const updateCondition = (patch: Partial<StepConditionConfig>) => {
      onStepChange(stepId, {
        ...step,
        condition: { ...step.condition, ...patch },
      });
    };

    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="cond-field">{t("panel.field")}</Label>
          <SearchableSelect
            id="cond-field"
            options={CONDITION_FIELDS.map((f) => ({ value: f.value, label: t(f.labelKey) }))}
            value={step.condition.field || null}
            onValueChange={(v) => v && updateCondition({ field: v as StepConditionConfig["field"] })}
            placeholder={t("panel.selectField")}
            searchPlaceholder={t("panel.search")}
            noResultsLabel={t("panel.noResults")}
          />
        </div>

        <div>
          <Label htmlFor="cond-operator">{t("panel.operator")}</Label>
          <SearchableSelect
            id="cond-operator"
            options={CONDITION_OPERATORS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            value={step.condition.operator || null}
            onValueChange={(v) => v && updateCondition({ operator: v as StepConditionConfig["operator"] })}
            placeholder={t("panel.selectOperator")}
            searchPlaceholder={t("panel.search")}
            noResultsLabel={t("panel.noResults")}
          />
        </div>

        <div>
          <Label htmlFor="cond-value">{t("panel.value")}</Label>
          <Input
            id="cond-value"
            type="text"
            value={step.condition.value}
            onChange={(e) => updateCondition({ value: e.target.value })}
            placeholder={t("panel.valuePlaceholder")}
          />
          {step.condition.operator === "inList" || step.condition.operator === "notInList" ? (
            <p className="mt-1 text-xs text-text-muted">{t("panel.commaSeparated")}</p>
          ) : null}
        </div>

        <div className="rounded-lg bg-surface-lowest p-3">
          <p className="text-[11px] text-text-muted">
            <strong className="text-secondary">{t("panel.yesBranchLabel")}</strong>{t("panel.yesBranchDesc")}
          </p>
          <p className="mt-1 text-[11px] text-text-muted">
            <strong className="text-danger">{t("panel.noBranchLabel")}</strong>{t("panel.noBranchDesc")}
          </p>
        </div>

        <div className="space-y-3 border-t border-border pt-3">
          <span className="section-label text-text-muted">{t("panel.connections")}</span>
          <StepTargetSelect
            label={t("panel.thenTarget")}
            value={step.thenNext}
            steps={steps}
            selfId={stepId}
            constants={constants}
            onChange={(v) => onStepChange(stepId, { ...step, thenNext: v })}
          />
          <StepTargetSelect
            label={t("panel.elseTarget")}
            value={step.elseNext}
            steps={steps}
            selfId={stepId}
            constants={constants}
            onChange={(v) => onStepChange(stepId, { ...step, elseNext: v })}
          />
        </div>

        <RemoveButton
          label={t("panel.removeCondition")}
          onConfirm={() => onStepRemove(stepId)}
        />
      </div>
    );
  }

  if (step.type === "delay") {
    const secs = Math.round(step.delayMs / 1000);

    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="delay-secs">{t("panel.delaySeconds")}</Label>
          <Input
            id="delay-secs"
            type="number"
            value={secs}
            min={1}
            max={300}
            onChange={(e) => {
              const val = Math.min(300, Math.max(1, Number(e.target.value)));
              onStepChange(stepId, { ...step, delayMs: val * 1000 });
            }}
          />
          <p className="mt-1 text-xs text-text-muted">{t("panel.delayRange")}</p>
        </div>

        <div className="space-y-3 border-t border-border pt-3">
          <span className="section-label text-text-muted">{t("panel.connections")}</span>
          <StepTargetSelect
            label={t("panel.nextTarget")}
            value={step.next}
            steps={steps}
            selfId={stepId}
            constants={constants}
            onChange={(v) => onStepChange(stepId, { ...step, next: v })}
          />
        </div>

        <RemoveButton
          label={t("panel.removeDelay")}
          onConfirm={() => onStepRemove(stepId)}
        />
      </div>
    );
  }

  return null;
}

function VariablesTab({
  variables,
  constants,
}: {
  variables: string[];
  constants: Constants;
}) {
  const { t } = useTranslation("rules");
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const copyVariable = async (variable: string) => {
    await navigator.clipboard.writeText(variable);
    setCopiedVar(variable);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  if (variables.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Icon name="info" size={20} className="text-text-muted" />
        <p className="text-xs text-text-muted">
          {t("panel.noVariables")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        {t("panel.variablesHint")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <Badge
            key={v}
            variant={copiedVar === v ? "success" : "secondary"}
            role="button"
            tabIndex={0}
            aria-label={t("panel.copyVariable", { name: v })}
            className="cursor-pointer font-mono text-[11px] transition hover:bg-accent/15 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => copyVariable(v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyVariable(v);
              }
            }}
            title={constants.templateVariables[v] ?? v}
          >
            {copiedVar === v ? t("panel.copied") : v}
          </Badge>
        ))}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {copiedVar ? t("panel.copied") : ""}
      </span>
    </div>
  );
}
