import { useTranslation } from "react-i18next";
import { Icon } from "../../../shared/components/Icon";
import { Label } from "../../../shared/ui/label";
import { Input } from "../../../shared/ui/input";
import { Textarea } from "../../../shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/select";
import { VariableEditor } from "../../../shared/ui/variable-field";
import type { VariableDescriptor } from "../../../shared/ui/variable-field";
import type { ActionFieldDescriptor, Channel, Role } from "../../../shared/lib/schemas";

const VARIABLE_FIELD_KEYS = new Set([
  "message",
  "embed.title",
  "embed.description",
  "embed.footer",
  "webhook.bodyTemplate",
  "nickname",
  "threadName",
]);

interface ActionFieldsProps {
  fields: ActionFieldDescriptor[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  channels: Channel[];
  roles: Role[];
  variables: VariableDescriptor[];
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
  variables,
}: ActionFieldsProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => {
        const value = getNestedValue(values, field.key) ?? "";
        const fieldId = `af-${field.key.replace(/\./g, "-")}`;
        const colorHex =
          typeof value === "number"
            ? `#${value.toString(16).padStart(6, "0")}`
            : String(value) || "#5865f2";

        return (
          <div key={field.key}>
            <Label htmlFor={fieldId}>
              {field.label}
              {field.required && (
                <>
                  <span aria-hidden="true" className="text-danger"> *</span>
                  <span className="sr-only"> ({t("labels.required")})</span>
                </>
              )}
            </Label>

            {field.type === "channel" && (
              <Select
                value={String(value) || undefined}
                onValueChange={(v) => onChange(field.key, v)}
              >
                <SelectTrigger id={fieldId} aria-required={field.required}>
                  <SelectValue placeholder={t("form.selectChannel")} />
                </SelectTrigger>
                <SelectContent>
                  {channels
                    .filter((c) => c.type === 0 || c.type === 2)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-1.5">
                          <Icon
                            name={c.type === 2 ? "volume_up" : "hash"}
                            size={14}
                            className="text-text-muted"
                          />
                          {c.name}
                        </span>
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
                <SelectTrigger id={fieldId} aria-required={field.required}>
                  <SelectValue placeholder={t("form.selectRole")} />
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
              VARIABLE_FIELD_KEYS.has(field.key) ? (
                <VariableEditor
                  id={fieldId}
                  value={String(value ?? "")}
                  onChange={(v) => onChange(field.key, v)}
                  variables={variables}
                  multiline={false}
                  aria-required={field.required}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                />
              ) : (
                <Input
                  id={fieldId}
                  type="text"
                  aria-required={field.required}
                  value={String(value)}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                />
              )
            )}

            {field.type === "textarea" && (
              VARIABLE_FIELD_KEYS.has(field.key) ? (
                <VariableEditor
                  id={fieldId}
                  value={String(value ?? "")}
                  onChange={(v) => onChange(field.key, v)}
                  variables={variables}
                  multiline={true}
                  aria-required={field.required}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                />
              ) : (
                <Textarea
                  id={fieldId}
                  aria-required={field.required}
                  value={String(value)}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                />
              )
            )}

            {field.type === "color" && (
              <div className="flex items-center gap-2">
                <input
                  id={fieldId}
                  type="color"
                  aria-label={field.label}
                  className="h-9 w-14 shrink-0 cursor-pointer rounded-sm bg-surface-lowest p-1"
                  value={colorHex}
                  onChange={(e) =>
                    onChange(field.key, parseInt(e.target.value.slice(1), 16))
                  }
                />
                <span className="font-mono text-xs text-text-muted">{colorHex}</span>
              </div>
            )}

            {field.type === "select" && field.options && (
              <Select
                value={String(value) || undefined}
                onValueChange={(v) => onChange(field.key, v)}
              >
                <SelectTrigger id={fieldId} aria-required={field.required}>
                  <SelectValue placeholder={t("form.select")} />
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
