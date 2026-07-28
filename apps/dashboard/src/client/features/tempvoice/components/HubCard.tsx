import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_NAME_TEMPLATE } from "@fluxcore/systems/tempVoice/constants";
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
  const hubErrorId = `${ids}-hub-error`;

  const hubRef = useRef<HTMLButtonElement>(null);

  const [renderedMode, setRenderedMode] = useState(mode);
  const [hubChannelId, setHubChannelId] = useState(config?.hubChannelId ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(config?.categoryId ?? null);
  const [nameTemplate, setNameTemplate] = useState(config?.nameTemplate ?? DEFAULT_NAME_TEMPLATE);
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");

  // The orchestrator toggles `mode` on a long-lived card instance rather than
  // unmounting it (collapse() only clears which id is expanded), so a useState
  // initializer alone would leave a previously-typed, possibly-abandoned draft —
  // and a stale failure banner — behind the next time this card re-enters editor
  // mode. Re-seed from the saved config whenever we transition INTO editor mode.
  // (React's documented "adjusting state when a prop changes" pattern: updating
  // state mid-render avoids both an extra effect-driven render and a flash of
  // stale content.)
  if (mode !== renderedMode) {
    setRenderedMode(mode);
    if (mode === "editor") {
      setHubChannelId(config?.hubChannelId ?? "");
      setCategoryId(config?.categoryId ?? null);
      setNameTemplate(config?.nameTemplate ?? DEFAULT_NAME_TEMPLATE);
      setFieldError("");
      setSubmitError("");
    }
  }

  // Entering editor mode destroys the control the user just activated: Edit
  // lives in the summary branch (which this render replaces), and Add is
  // suppressed while any card is expanded. Either way the activating button
  // unmounts and focus falls to <body>, resetting a keyboard user's tab
  // position to the top of the document. Move focus into step 1's picker
  // instead — the mirror image of the orchestrator's collapse(), which
  // restores focus to whatever opened the card. Scheduled as an effect, not
  // called from the render-phase re-seed above: `hubRef` is only attached
  // after commit, and .focus() is a DOM side effect that must not run during
  // render. Runs on mount too, which is exactly the "new" card's case.
  useEffect(() => {
    if (mode === "editor") hubRef.current?.focus();
  }, [mode]);

  const preview = usePreviewContext(guildId);

  if (mode === "summary" && config) {
    // Always read from the saved `config`, never from the editor's draft state —
    // the draft can outlive a Cancel (this card never unmounts), so deriving the
    // summary from anything but the prop would let an abandoned, unsaved edit
    // "leak" into the collapsed view while the bot keeps using the real saved name.
    //
    // `|| DEFAULT_NAME_TEMPLATE` mirrors the bot's resolveChannelName exactly.
    // An empty template is a reachable saved value — the PUT route passes
    // nameTemplate straight through and the schema has no .min(1), so
    // create -> Edit -> clear the field -> Save persists "" — and the bot then
    // creates "<name>'s Channel" from its own fallback. Without this the chip
    // would render blank while the real channel gets a name.
    const summaryResolvedName = resolveTemplatePreview(
      config.nameTemplate || DEFAULT_NAME_TEMPLATE,
      buildTokenValues(tempvoiceVariables, preview),
    );
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
          resolvedName={summaryResolvedName}
          categoryName={config.categoryId ? resolveChannelName(config.categoryId) : null}
        />
      </div>
    );
  }

  // The editor's own live preview, driven by the in-progress draft (not `config`).
  // Same bot-matching fallback as the summary above: with the field cleared the
  // preview shows what would really be created, which is also what the
  // placeholder promises — not a blank chip.
  const resolvedName = resolveTemplatePreview(
    nameTemplate || DEFAULT_NAME_TEMPLATE,
    buildTokenValues(tempvoiceVariables, preview),
  );

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
            describedBy={fieldError ? hubErrorId : undefined}
            invalid={!!fieldError}
          />
          {fieldError && (
            <p id={hubErrorId} className="mt-1 text-xs text-danger">
              {fieldError}
            </p>
          )}
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
        <Button type="submit" className="min-h-11" disabled={busy}>
          {busy ? t("editor.saving") : t("editor.save")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={onCancel}
          disabled={busy}
        >
          {t("editor.cancel")}
        </Button>
      </div>
    </form>
  );
}
