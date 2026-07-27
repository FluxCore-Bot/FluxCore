import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../shared/ui/button";
import { Alert } from "../../../shared/ui/alert";
import { DiscordSelect } from "../../../shared/ui/discord-select";
import {
  VariableEditor,
  usePreviewContext,
  tempvoiceVariables,
  buildTokenValues,
  resolveTemplatePreview,
} from "../../../shared/ui/variable-field";
import {
  TempVoiceFormSchema,
  type TempVoiceConfig,
  type TempVoiceFormData,
} from "../../../shared/lib/schemas";
import { HubFlow, HubFlowStep } from "./HubFlow";
import { HubSummary } from "./HubSummary";
import { ChannelChip } from "./ChannelChip";

const DEFAULT_TEMPLATE = "{user}'s Channel";

export interface HubCardProps {
  /** null = an unsaved new hub. */
  config: TempVoiceConfig | null;
  mode: "summary" | "editor";
  guildId: string;
  /** Resolves a channel id to a display name; returns the id when unknown. */
  resolveChannelName: (id: string) => string;
  /** Hub channel ids claimed by *other* configs. */
  excludeHubIds: string[];
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onSubmit: (data: TempVoiceFormData) => Promise<void>;
  busy: boolean;
}

export function HubCard({
  config,
  mode,
  guildId,
  resolveChannelName,
  excludeHubIds,
  onEdit,
  onDelete,
  onCancel,
  onSubmit,
  busy,
}: HubCardProps) {
  const { t } = useTranslation("tempvoice");
  const ids = useId();
  const hubId = `${ids}-hub`;
  const catId = `${ids}-cat`;
  const nameId = `${ids}-name`;

  const hubRef = useRef<HTMLButtonElement>(null);

  const [hubChannelId, setHubChannelId] = useState(config?.hubChannelId ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(config?.categoryId ?? null);
  const [nameTemplate, setNameTemplate] = useState(config?.nameTemplate ?? DEFAULT_TEMPLATE);
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const preview = usePreviewContext(guildId);
  const resolvedName = resolveTemplatePreview(
    nameTemplate,
    buildTokenValues(tempvoiceVariables, preview),
  );

  if (mode === "summary" && config) {
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <ChannelChip kind="voice" name={resolveChannelName(config.hubChannelId)} />
          <div className="flex gap-1">
            {/* Stable id so the orchestrator can restore focus here on cancel. */}
            <Button
              id={`tv-edit-hub-${config.id}`}
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={onEdit}
              disabled={busy}
            >
              {t("list.edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 text-danger hover:text-danger"
              onClick={onDelete}
              disabled={busy}
            >
              {t("list.delete")}
            </Button>
          </div>
        </div>
        <HubSummary
          resolvedName={resolvedName}
          categoryName={config.categoryId ? resolveChannelName(config.categoryId) : null}
        />
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldError("");
    setSubmitError("");

    const parsed = TempVoiceFormSchema.safeParse({ hubChannelId, categoryId, nameTemplate });
    if (!parsed.success) {
      setFieldError(t("errors.hubRequired"));
      hubRef.current?.focus();
      return;
    }

    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("errors.generic"));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-accent bg-surface p-4"
      noValidate
    >
      {submitError && (
        <Alert variant="destructive" className="mb-4">
          {submitError}
        </Alert>
      )}

      <HubFlow>
        <HubFlowStep n={1} label={t("flow.step1")} htmlFor={hubId}>
          <DiscordSelect
            id={hubId}
            ref={hubRef}
            guildId={guildId}
            type="voice"
            value={hubChannelId || null}
            onValueChange={(v) => setHubChannelId(v ?? "")}
            placeholder={t("fields.hubPlaceholder")}
            excludeIds={excludeHubIds}
            disabled={busy}
          />
          {fieldError && <p className="mt-1 text-xs text-danger">{fieldError}</p>}
        </HubFlowStep>

        <HubFlowStep n={2} label={t("flow.step2")} htmlFor={nameId}>
          <VariableEditor
            id={nameId}
            value={nameTemplate}
            onChange={setNameTemplate}
            variables={tempvoiceVariables}
            placeholder={t("fields.templatePlaceholder")}
            maxLength={100}
            disabled={busy}
          />
          <div className="mt-2" aria-live="polite">
            <ChannelChip kind="voice" name={resolvedName} />
          </div>
        </HubFlowStep>

        <HubFlowStep n={3} label={t("flow.step3")} htmlFor={catId}>
          <DiscordSelect
            id={catId}
            guildId={guildId}
            type="category"
            value={categoryId}
            onValueChange={setCategoryId}
            placeholder={t("fields.categoryNone")}
            allowNone
            noneLabel={t("fields.categoryNone")}
            disabled={busy}
          />
        </HubFlowStep>

        <HubFlowStep n={4} label={t("flow.step4")} last />
      </HubFlow>

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? t("editor.saving") : t("editor.save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          {t("editor.cancel")}
        </Button>
      </div>
    </form>
  );
}
