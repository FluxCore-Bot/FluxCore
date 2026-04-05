import { useState } from "react";
import { ActionFields } from "../ActionFields";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Icon } from "../Icon";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ConditionsEditor } from "../ConditionsEditor";
import type {
  ActionConditions,
  ActionConfig,
  ActionFieldDescriptor,
  Channel,
  Constants,
  Role,
  RuleStep,
  StepConditionConfig,
} from "../../lib/schemas";

interface TriggerPanelProps {
  type: "trigger";
  eventType: string;
  constants: Constants;
  channels: Channel[];
  roles: Role[];
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
  channels: Channel[];
  roles: Role[];
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
  channels: Channel[];
  roles: Role[];
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

function getHeaderInfo(props: NodeDetailPanelProps) {
  if (props.type === "trigger") {
    return { icon: "bolt", color: "bg-accent/20", textColor: "text-accent", label: "Trigger Settings" };
  }
  if (props.type === "step") {
    const step = props.steps.find((s) => s.id === props.stepId);
    if (step?.type === "condition") {
      return { icon: "call_split", color: "bg-warning/20", textColor: "text-warning", label: "Condition" };
    }
    if (step?.type === "delay") {
      return { icon: "schedule", color: "bg-text-muted/15", textColor: "text-text-muted", label: "Delay" };
    }
    return { icon: "play_arrow", color: "bg-secondary/15", textColor: "text-secondary", label: "Action Step" };
  }
  return { icon: "play_arrow", color: "bg-secondary/15", textColor: "text-secondary", label: `Action ${props.index + 1}` };
}

export function NodeDetailPanel(props: NodeDetailPanelProps) {
  const { onClose } = props;
  const header = getHeaderInfo(props);

  return (
    <div className="absolute end-0 top-0 z-20 flex h-full w-full flex-col border-s border-border bg-surface-low animate-in slide-in-from-right-4 duration-200 sm:w-96">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-6 w-6 items-center justify-center rounded ${header.color}`}>
            <Icon name={header.icon} size={14} className={header.textColor} />
          </div>
          <span className="text-sm font-semibold text-text">{header.label}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
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
  channels,
  roles,
  conditions,
  onEventTypeChange,
  onConditionsChange,
}: TriggerPanelProps) {
  const variables = eventType ? (constants.eventTypeVariables[eventType] ?? []) : [];

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
          <Icon name="settings" size={14} className="mr-1.5" />
          Settings
        </TabsTrigger>
        <TabsTrigger value="conditions" className="flex-1">
          <Icon name="filter_alt" size={14} className="mr-1.5" />
          Filters
          {conditionCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
              {conditionCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="variables" className="flex-1">
          <Icon name="data_object" size={14} className="mr-1.5" />
          Vars
          {variables.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
              {variables.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="settings">
        <div className="space-y-4">
          <div>
            <Label>
              Event Type <span className="text-danger">*</span>
            </Label>
            <Select value={eventType || undefined} onValueChange={onEventTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select event..." />
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
          channels={channels}
          roles={roles}
          alwaysExpanded
        />
      </TabsContent>

      <TabsContent value="variables">
        <VariablesTab variables={variables} constants={constants} />
      </TabsContent>
    </Tabs>
  );
}

function ActionPanel({
  index,
  action,
  constants,
  channels,
  roles,
  totalActions,
  onActionChange,
  onActionRemove,
  onActionMove,
  canRemove,
}: ActionPanelProps) {
  const fields: ActionFieldDescriptor[] =
    constants.actionTypeFields[action.type] ?? [];

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
    <Tabs defaultValue="settings">
      <TabsList className="w-full">
        <TabsTrigger value="settings" className="flex-1">
          <Icon name="settings" size={14} className="mr-1.5" />
          Settings
        </TabsTrigger>
        <TabsTrigger value="variables" className="flex-1">
          <Icon name="data_object" size={14} className="mr-1.5" />
          Variables
        </TabsTrigger>
      </TabsList>

      <TabsContent value="settings">
        <div className="space-y-4">
          <div>
            <Label>
              Action Type <span className="text-danger">*</span>
            </Label>
            <Select value={action.type || undefined} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select action..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(constants.actionTypes).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {action.type && fields.length > 0 && (
            <ActionFields
              fields={fields}
              values={action as unknown as Record<string, unknown>}
              onChange={handleFieldChange}
              channels={channels}
              roles={roles}
            />
          )}

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
                Move Up
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                disabled={index === totalActions - 1}
                onClick={() => onActionMove(index, "down")}
              >
                <Icon name="arrow_downward" size={16} />
                Move Down
              </Button>
            </div>
          )}

          {canRemove && (
            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-danger hover:bg-danger/10 hover:text-danger"
                onClick={() => onActionRemove(index)}
              >
                <Icon name="delete" size={16} />
                Remove Action
              </Button>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="variables">
        <VariablesTab
          variables={Object.keys(constants.templateVariables)}
          constants={constants}
        />
      </TabsContent>
    </Tabs>
  );
}

const CONDITION_FIELDS: Array<{ value: string; label: string }> = [
  { value: "channelId", label: "Channel ID" },
  { value: "channelName", label: "Channel Name" },
  { value: "userId", label: "User ID" },
  { value: "userName", label: "User Name" },
  { value: "roleId", label: "Role ID" },
  { value: "roleName", label: "Role Name" },
  { value: "messageContent", label: "Message Content" },
  { value: "memberCount", label: "Member Count" },
];

const CONDITION_OPERATORS: Array<{ value: string; label: string }> = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "notContains", label: "Not Contains" },
  { value: "startsWith", label: "Starts With" },
  { value: "endsWith", label: "Ends With" },
  { value: "greaterThan", label: "Greater Than" },
  { value: "lessThan", label: "Less Than" },
  { value: "hasRole", label: "Has Role" },
  { value: "notHasRole", label: "Not Has Role" },
  { value: "inList", label: "In List" },
  { value: "notInList", label: "Not In List" },
];

function StepPanel({
  stepId,
  steps,
  constants,
  channels,
  roles,
  onStepChange,
  onStepRemove,
}: StepPanelProps) {
  const step = steps.find((s) => s.id === stepId);
  if (!step) return <p className="text-xs text-text-muted">Step not found</p>;

  if (step.type === "action") {
    const fields = constants.actionTypeFields[step.action.type] ?? [];

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
      <div className="space-y-4">
        <div>
          <Label>
            Action Type <span className="text-danger">*</span>
          </Label>
          <Select value={step.action.type || undefined} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select action..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(constants.actionTypes).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  {info.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {step.action.type && fields.length > 0 && (
          <ActionFields
            fields={fields}
            values={step.action as unknown as Record<string, unknown>}
            onChange={handleFieldChange}
            channels={channels}
            roles={roles}
          />
        )}

        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-danger hover:bg-danger/10 hover:text-danger"
            onClick={() => onStepRemove(stepId)}
          >
            <Icon name="delete" size={16} />
            Remove Step
          </Button>
        </div>
      </div>
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
          <Label>Field</Label>
          <Select value={step.condition.field} onValueChange={(v) => updateCondition({ field: v as StepConditionConfig["field"] })}>
            <SelectTrigger>
              <SelectValue placeholder="Select field..." />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_FIELDS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Operator</Label>
          <Select value={step.condition.operator} onValueChange={(v) => updateCondition({ operator: v as StepConditionConfig["operator"] })}>
            <SelectTrigger>
              <SelectValue placeholder="Select operator..." />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_OPERATORS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Value</Label>
          <input
            type="text"
            value={step.condition.value}
            onChange={(e) => updateCondition({ value: e.target.value })}
            placeholder="Value to compare..."
            className="flex h-9 w-full rounded-md border border-border bg-surface-lowest px-3 py-1 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {step.condition.operator === "inList" || step.condition.operator === "notInList" ? (
            <p className="mt-1 text-xs text-text-muted">Comma-separated values</p>
          ) : null}
        </div>

        <div className="rounded-lg bg-surface-lowest p-3">
          <p className="text-[11px] text-text-muted">
            <strong className="text-secondary">Yes branch →</strong> continues when condition is true
          </p>
          <p className="mt-1 text-[11px] text-text-muted">
            <strong className="text-danger">No branch →</strong> continues when condition is false
          </p>
        </div>

        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-danger hover:bg-danger/10 hover:text-danger"
            onClick={() => onStepRemove(stepId)}
          >
            <Icon name="delete" size={16} />
            Remove Condition
          </Button>
        </div>
      </div>
    );
  }

  if (step.type === "delay") {
    const secs = Math.round(step.delayMs / 1000);

    return (
      <div className="space-y-4">
        <div>
          <Label>Delay (seconds)</Label>
          <input
            type="number"
            value={secs}
            min={1}
            max={300}
            onChange={(e) => {
              const val = Math.min(300, Math.max(1, Number(e.target.value)));
              onStepChange(stepId, { ...step, delayMs: val * 1000 });
            }}
            className="flex h-9 w-full rounded-md border border-border bg-surface-lowest px-3 py-1 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="mt-1 text-xs text-text-muted">1–300 seconds (5 minutes max)</p>
        </div>

        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-danger hover:bg-danger/10 hover:text-danger"
            onClick={() => onStepRemove(stepId)}
          >
            <Icon name="delete" size={16} />
            Remove Delay
          </Button>
        </div>
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
          Select an event type first to see available variables.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        Click a variable to copy it. Use in message and text fields.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <Badge
            key={v}
            variant={copiedVar === v ? "success" : "secondary"}
            className="cursor-pointer font-mono text-[11px] transition hover:bg-accent/15 hover:text-accent"
            onClick={() => copyVariable(v)}
            title={constants.templateVariables[v] ?? v}
          >
            {copiedVar === v ? "Copied!" : v}
          </Badge>
        ))}
      </div>
    </div>
  );
}
