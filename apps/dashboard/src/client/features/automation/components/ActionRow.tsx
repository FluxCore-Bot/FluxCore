import { ActionFields } from "./ActionFields";
import { Icon } from "../../../shared/components/Icon";
import { Button } from "../../../shared/ui/button";
import { Label } from "../../../shared/ui/label";
import { Card } from "../../../shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/select";
import type {
  ActionConfig,
  ActionFieldDescriptor,
  Channel,
  Constants,
  Role,
} from "../../../shared/lib/schemas";

interface ActionRowProps {
  index: number;
  action: ActionConfig;
  constants: Constants;
  channels: Channel[];
  roles: Role[];
  onChange: (index: number, action: ActionConfig) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "up" | "down") => void;
  canRemove: boolean;
  isFirst: boolean;
  isLast: boolean;
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const result = { ...obj };
  const parts = path.split(".");
  if (parts.length === 1) {
    result[parts[0]] = value;
    return result;
  }
  const [first, ...rest] = parts;
  // For nested keys like "embed.title", set the nested object properly
  if (rest.length === 1) {
    result[first] = {
      ...(typeof result[first] === "object" && result[first] !== null
        ? (result[first] as Record<string, unknown>)
        : {}),
      [rest[0]]: value,
    };
  } else {
    const nested =
      typeof result[first] === "object" && result[first] !== null
        ? { ...(result[first] as Record<string, unknown>) }
        : {};
    nested[rest.join(".")] = setNestedValue(
      typeof nested[rest[0]] === "object" && nested[rest[0]] !== null
        ? { ...(nested[rest[0]] as Record<string, unknown>) }
        : {},
      rest.slice(1).join("."),
      value,
    );
    result[first] = nested;
  }
  return result;
}

export function ActionRow({
  index,
  action,
  constants,
  channels,
  roles,
  onChange,
  onRemove,
  onMove,
  canRemove,
  isFirst,
  isLast,
}: ActionRowProps) {
  const fields: ActionFieldDescriptor[] =
    constants.actionTypeFields[action.type] ?? [];

  const handleTypeChange = (newType: string) => {
    onChange(index, { type: newType });
  };

  const handleFieldChange = (key: string, value: unknown) => {
    const updated = setNestedValue(
      action as unknown as Record<string, unknown>,
      key,
      value,
    ) as unknown as ActionConfig;
    onChange(index, updated);
  };

  return (
    <Card className="bg-surface-high p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-text-muted">
            Action {index + 1}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={isFirst}
              onClick={() => onMove(index, "up")}
            >
              <Icon name="arrow_upward" size={14} className="text-text-muted" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={isLast}
              onClick={() => onMove(index, "down")}
            >
              <Icon name="arrow_downward" size={14} className="text-text-muted" />
            </Button>
          </div>
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="text-danger"
            onClick={() => onRemove(index)}
          >
            Remove
          </Button>
        )}
      </div>

      <div className="mb-3">
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
    </Card>
  );
}
