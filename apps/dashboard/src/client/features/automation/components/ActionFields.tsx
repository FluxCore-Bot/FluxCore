import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../../shared/components/Icon";
import { SearchableSelect } from "../../../shared/ui/searchable-select";
import { Label } from "../../../shared/ui/label";
import { Input } from "../../../shared/ui/input";
import { Textarea } from "../../../shared/ui/textarea";
import { ColorPicker } from "../../../shared/ui/color-picker";
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
import { channelIconName, isMessageableChannel } from "../../../shared/lib/channelTypes";

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
  /**
   * Mark empty required fields invalid with a linked message. A red asterisk
   * was the only signal, so a screen-reader user got no feedback at all about
   * why Save was disabled.
   */
  showErrors?: boolean;
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

/**
 * A textarea backed by a JSON value.
 *
 * The raw text lives in local state so a half-typed object does not have to be
 * valid to be typeable; only a successful parse is committed upward. The model
 * types `webhook.headers` as Record<string,string>, and writing the raw string
 * there made the rule permanently unsavable ("Expected object, received
 * string" — English-only, naming no field).
 */
function JsonField({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  invalidLabel,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
  maxLength?: number;
  invalidLabel: string;
}) {
  const serialised =
    value === undefined || value === null || value === ""
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2);
  const [text, setText] = useState(serialised);
  const [error, setError] = useState(false);
  const errorId = `${id}-json-error`;

  const handle = (next: string) => {
    setText(next);
    if (next.trim() === "") {
      setError(false);
      onChange(undefined);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(next);
      const isStringRecord =
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        Object.values(parsed as Record<string, unknown>).every((v) => typeof v === "string");
      if (!isStringRecord) {
        setError(true);
        return;
      }
      setError(false);
      onChange(parsed);
    } catch {
      setError(true);
    }
  };

  return (
    <>
      <Textarea
        id={id}
        value={text}
        onChange={(e) => handle(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error || undefined}
        aria-describedby={error ? errorId : undefined}
        className="font-mono text-xs"
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
          {invalidLabel}
        </p>
      )}
    </>
  );
}

export function ActionFields({
  fields,
  values,
  onChange,
  channels,
  roles,
  variables,
  showErrors,
}: ActionFieldsProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => {
        const value = getNestedValue(values, field.key) ?? "";
        const fieldId = `af-${field.key.replace(/\./g, "-")}`;
        const missing = !!showErrors && !!field.required && (value === "" || value === undefined || value === null);
        const errorId = `${fieldId}-error`;
        const invalidProps = missing
          ? { "aria-invalid": true as const, "aria-describedby": errorId }
          : {};
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
              <SearchableSelect
                id={fieldId}
                required={field.required}
                value={String(value) || null}
                onValueChange={(v) => v && onChange(field.key, v)}
                placeholder={t("form.selectChannel")}
                searchPlaceholder={t("form.search")}
                noResultsLabel={t("form.noResults")}
                options={channels
                  .filter((c) => isMessageableChannel(c.type))
                  .map((c) => ({
                    value: c.id,
                    label: c.name,
                    icon: (
                      <Icon
                        name={channelIconName(c.type)}
                        size={14}
                        className="text-text-muted"
                      />
                    ),
                  }))}
              />
            )}

            {field.type === "role" && (
              <SearchableSelect
                id={fieldId}
                required={field.required}
                value={String(value) || null}
                onValueChange={(v) => v && onChange(field.key, v)}
                placeholder={t("form.selectRole")}
                searchPlaceholder={t("form.search")}
                noResultsLabel={t("form.noResults")}
                options={roles.map((r) => ({ value: r.id, label: r.name }))}
              />
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
                  {...invalidProps}
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
                  {...invalidProps}
                  value={String(value)}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                />
              )
            )}

            {field.type === "color" && (
              <ColorPicker
                id={fieldId}
                aria-label={field.label}
                value={colorHex}
                onChange={(hex) => {
                  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
                  const parsed = parseInt(normalized, 16);
                  if (!Number.isNaN(parsed)) onChange(field.key, parsed);
                }}
              />
            )}

            {field.type === "json" && (
              <JsonField
                id={fieldId}
                value={getNestedValue(values, field.key)}
                onChange={(v) => onChange(field.key, v)}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                invalidLabel={t("form.invalidJson")}
              />
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
            {missing && (
              <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
                {t("form.fieldRequired", { field: field.label })}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
