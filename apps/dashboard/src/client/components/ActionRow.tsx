import { ActionFields } from "./ActionFields";
import type {
  ActionConfig,
  ActionFieldDescriptor,
  Channel,
  Constants,
  Role,
} from "../lib/schemas";

interface ActionRowProps {
  index: number;
  action: ActionConfig;
  constants: Constants;
  channels: Channel[];
  roles: Role[];
  onChange: (index: number, action: ActionConfig) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
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
  const nested =
    typeof result[first] === "object" && result[first] !== null
      ? { ...(result[first] as Record<string, unknown>) }
      : {};
  nested[rest.join(".")] =
    rest.length === 1
      ? value
      : setNestedValue(
          typeof nested[rest[0]] === "object" && nested[rest[0]] !== null
            ? { ...(nested[rest[0]] as Record<string, unknown>) }
            : {},
          rest.slice(1).join("."),
          value,
        );
  // For nested keys like "embed.title", set the nested object properly
  if (rest.length === 1) {
    result[first] = { ...(typeof result[first] === "object" && result[first] !== null ? result[first] as Record<string, unknown> : {}), [rest[0]]: value };
  } else {
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
  canRemove,
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
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">
          Action {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-xs text-danger hover:underline"
          >
            Remove
          </button>
        )}
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-text-muted">
          Action Type <span className="text-danger">*</span>
        </label>
        <select value={action.type} onChange={(e) => handleTypeChange(e.target.value)}>
          <option value="">Select action...</option>
          {Object.entries(constants.actionTypes).map(([key, info]) => (
            <option key={key} value={key}>
              {info.label}
            </option>
          ))}
        </select>
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
    </div>
  );
}
