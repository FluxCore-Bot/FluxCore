import { Label } from "./ui/label";
import { Input } from "./ui/input";
import type { ActionFieldDescriptor, Channel, Role } from "../lib/schemas";

interface ActionFieldsProps {
  fields: ActionFieldDescriptor[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  channels: Channel[];
  roles: Role[];
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function ActionFields({
  fields,
  values,
  onChange,
  channels,
  roles,
}: ActionFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => {
        const value = getNestedValue(values, field.key) ?? "";

        return (
          <div key={field.key}>
            <Label>
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </Label>

            {field.type === "channel" && (
              <select
                value={String(value)}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                <option value="">Select channel...</option>
                {channels
                  .filter((c) => c.type === 0 || c.type === 2)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.type === 2 ? `🔊 ${c.name}` : `# ${c.name}`}
                    </option>
                  ))}
              </select>
            )}

            {field.type === "role" && (
              <select
                value={String(value)}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                <option value="">Select role...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}

            {field.type === "text" && (
              <Input
                type="text"
                value={String(value)}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
              />
            )}

            {field.type === "textarea" && (
              <textarea
                value={String(value)}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
              />
            )}

            {field.type === "color" && (
              <input
                type="color"
                value={
                  typeof value === "number"
                    ? `#${value.toString(16).padStart(6, "0")}`
                    : String(value) || "#5865f2"
                }
                onChange={(e) =>
                  onChange(field.key, parseInt(e.target.value.slice(1), 16))
                }
              />
            )}

            {field.type === "select" && field.options && (
              <select
                value={String(value)}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                <option value="">Select...</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}
