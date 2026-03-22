import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
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
              <Select
                value={String(value) || undefined}
                onValueChange={(v) => onChange(field.key, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select channel..." />
                </SelectTrigger>
                <SelectContent>
                  {channels
                    .filter((c) => c.type === 0 || c.type === 2)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.type === 2 ? `🔊 ${c.name}` : `# ${c.name}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            {field.type === "role" && (
              <Select
                value={String(value) || undefined}
                onValueChange={(v) => onChange(field.key, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Textarea
                value={String(value)}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
              />
            )}

            {field.type === "color" && (
              <input
                type="color"
                className="h-9 w-full cursor-pointer rounded-sm bg-surface-lowest p-1"
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
              <Select
                value={String(value) || undefined}
                onValueChange={(v) => onChange(field.key, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        );
      })}
    </div>
  );
}
