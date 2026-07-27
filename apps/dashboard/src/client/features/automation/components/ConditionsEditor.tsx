import { useState, useId } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../../shared/components/Icon";
import { Badge } from "../../../shared/ui/badge";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Label } from "../../../shared/ui/label";
import { DiscordMultiSelect } from "../../../shared/ui/discord-multi-select";
import type { ActionConditions } from "../../../shared/lib/schemas";

/** The three data a trigger filter can key on. Mirrors ConditionSubject. */
export type ConditionSubject = "channel" | "role" | "user";

/** Which condition keys belong to which subject. */
const SUBJECT_KEYS: Record<ConditionSubject, (keyof ActionConditions)[]> = {
  channel: ["channelIds", "excludeChannelIds"],
  role: ["roleIds", "excludeRoleIds"],
  user: ["userIds", "excludeUserIds"],
};

const ALL_SUBJECTS: ConditionSubject[] = ["channel", "role", "user"];

interface ConditionsEditorProps {
  guildId: string;
  conditions: ActionConditions;
  onChange: (conditions: ActionConditions) => void;
  compact?: boolean;
  /** Always show expanded, no collapse button */
  alwaysExpanded?: boolean;
  /**
   * Which filter subjects the selected trigger can actually evaluate, from
   * EVENT_CONDITION_SUPPORT. Filters fail closed in the bot, so offering one
   * the event context can never answer would silently stop the rule from
   * firing rather than simply doing nothing.
   *
   * Undefined means no trigger is chosen yet — offer everything rather than
   * an empty panel, since the user is about to pick one.
   */
  supported?: ConditionSubject[];
}

function ChipList({
  items,
  onRemove,
  color = "secondary",
}: {
  items: { id: string; label: string }[];
  onRemove: (id: string) => void;
  color?: "secondary" | "destructive";
}) {
  const { t } = useTranslation("rules");
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge
          key={item.id}
          variant={color}
          className="gap-1 pe-1 text-[11px]"
        >
          {item.label}
          <button
            type="button"
            aria-label={t("conditions.removeItem", { label: item.label })}
            onClick={() => onRemove(item.id)}
            className="ms-0.5 rounded-full p-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon name="close" size={10} />
          </button>
        </Badge>
      ))}
    </div>
  );
}

function UserIdInput({
  label,
  selectedIds,
  onAdd,
  onRemove,
  chipColor = "secondary",
}: {
  label: string;
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  chipColor?: "secondary" | "destructive";
}) {
  const { t } = useTranslation(["rules", "common"]);
  const [input, setInput] = useState("");
  const [touched, setTouched] = useState(false);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const trimmed = input.trim();
  const isValid = /^\d{17,20}$/.test(trimmed);
  const showError = touched && trimmed.length > 0 && !isValid;

  const handleAdd = () => {
    if (isValid && !selectedIds.includes(trimmed)) {
      onAdd(trimmed);
      setInput("");
      setTouched(false);
    } else {
      setTouched(true);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} className="text-xs">{label}</Label>
      <div className="flex gap-1.5">
        <Input
          id={fieldId}
          type="text"
          inputMode="numeric"
          value={input}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          onChange={(e) => setInput(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), handleAdd())
          }
          placeholder={t("conditions.userId")}
          className="h-8 flex-1 text-xs"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("conditions.addUserId")}
          className="h-8 px-2"
          onClick={handleAdd}
          disabled={!trimmed || !isValid}
        >
          <Icon name="add" size={14} />
        </Button>
      </div>
      {showError && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {t("conditions.userIdInvalid")}
        </p>
      )}
      <ChipList
        items={selectedIds.map((id) => ({ id, label: id }))}
        onRemove={onRemove}
        color={chipColor}
      />
    </div>
  );
}

export function ConditionsEditor({
  guildId,
  conditions,
  onChange,
  compact,
  alwaysExpanded,
  supported,
}: ConditionsEditorProps) {
  const { t } = useTranslation("rules");
  const update = (patch: Partial<ActionConditions>) => {
    onChange({ ...conditions, ...patch });
  };

  const subjects = supported ?? ALL_SUBJECTS;
  const shows = (subject: ConditionSubject) => subjects.includes(subject);

  // A rule can carry filters from before its trigger was changed. The runtime
  // now refuses to fire such a rule, so the editor has to surface them rather
  // than just hiding the controls that would reveal them.
  const strandedSubjects = ALL_SUBJECTS.filter(
    (subject) =>
      !shows(subject) &&
      SUBJECT_KEYS[subject].some((key) => (conditions[key]?.length ?? 0) > 0),
  );

  const clearStranded = () => {
    const next = { ...conditions };
    for (const subject of strandedSubjects) {
      for (const key of SUBJECT_KEYS[subject]) delete next[key];
    }
    onChange(next);
  };

  const hasAnyConditions =
    (conditions.channelIds?.length ?? 0) +
      (conditions.roleIds?.length ?? 0) +
      (conditions.userIds?.length ?? 0) +
      (conditions.excludeChannelIds?.length ?? 0) +
      (conditions.excludeRoleIds?.length ?? 0) +
      (conditions.excludeUserIds?.length ?? 0) >
    0;

  const [expanded, setExpanded] = useState(
    hasAnyConditions || !!alwaysExpanded,
  );

  if (!expanded && !alwaysExpanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-muted transition-colors hover:border-accent/30 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon name="filter_alt" size={14} />
        {t("conditions.addConditions")}
        {hasAnyConditions && (
          <Badge variant="secondary" className="ms-auto text-xs">
            {(conditions.channelIds?.length ?? 0) +
              (conditions.roleIds?.length ?? 0) +
              (conditions.userIds?.length ?? 0) +
              (conditions.excludeChannelIds?.length ?? 0) +
              (conditions.excludeRoleIds?.length ?? 0) +
              (conditions.excludeUserIds?.length ?? 0)}{" "}
            {t("conditions.active")}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <div
      className={`space-y-4 rounded-lg border border-border ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="filter_alt" size={16} className="text-accent" />
          <span className="text-xs font-semibold">{t("conditions.title")}</span>
        </div>
        {!alwaysExpanded && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("conditions.collapse")}
            className="h-8 w-8"
            onClick={() => setExpanded(false)}
          >
            <Icon name="expand_less" size={14} />
          </Button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-text-muted">
        {t("conditions.description")}
      </p>

      {strandedSubjects.length > 0 && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-warning/30 bg-warning/5 p-3"
        >
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-text-secondary">
            <Icon name="warning" size={14} className="mt-px shrink-0 text-warning" />
            {t("conditions.unsupportedWarning", {
              filters: strandedSubjects
                .map((s) => t(`conditions.${s === "channel" ? "channels" : s === "role" ? "roles" : "users"}`))
                .join(", "),
            })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={clearStranded}
          >
            {t("conditions.removeUnsupported")}
          </Button>
        </div>
      )}

      {/* Include filters */}
      <div className="space-y-3">
        <span className="section-label text-secondary">
          {t("conditions.include")}
        </span>
        {shows("channel") && (
          <DiscordMultiSelect
            guildId={guildId}
            type="any"
            selectedIds={conditions.channelIds ?? []}
            onChange={(ids) => update({ channelIds: ids })}
            placeholder={t("conditions.addChannel")}
            label={t("conditions.includeChannels")}
          />
        )}
        {shows("role") && (
          <DiscordMultiSelect
            guildId={guildId}
            type="role"
            selectedIds={conditions.roleIds ?? []}
            onChange={(ids) => update({ roleIds: ids })}
            placeholder={t("conditions.addRole")}
            label={t("conditions.includeRoles")}
          />
        )}
        {shows("user") && (
          <UserIdInput
            label={t("conditions.includeUsers")}
            selectedIds={conditions.userIds ?? []}
            onAdd={(id) => {
              const current = conditions.userIds ?? [];
              if (!current.includes(id)) update({ userIds: [...current, id] });
            }}
            onRemove={(id) =>
              update({ userIds: (conditions.userIds ?? []).filter((v) => v !== id) })
            }
          />
        )}
      </div>

      {/* Exclude filters */}
      <div className="space-y-3 border-t border-border pt-3">
        <span className="section-label text-danger">
          {t("conditions.exclude")}
        </span>
        {shows("channel") && (
          <DiscordMultiSelect
            guildId={guildId}
            type="any"
            selectedIds={conditions.excludeChannelIds ?? []}
            onChange={(ids) => update({ excludeChannelIds: ids })}
            placeholder={t("conditions.excludeChannel")}
            label={t("conditions.excludeChannels")}
          />
        )}
        {shows("role") && (
          <DiscordMultiSelect
            guildId={guildId}
            type="role"
            selectedIds={conditions.excludeRoleIds ?? []}
            onChange={(ids) => update({ excludeRoleIds: ids })}
            placeholder={t("conditions.excludeRole")}
            label={t("conditions.excludeRoles")}
          />
        )}
        {shows("user") && (
          <UserIdInput
            label={t("conditions.excludeUsers")}
            selectedIds={conditions.excludeUserIds ?? []}
            onAdd={(id) => {
              const current = conditions.excludeUserIds ?? [];
              if (!current.includes(id))
                update({ excludeUserIds: [...current, id] });
            }}
            onRemove={(id) =>
              update({
                excludeUserIds: (conditions.excludeUserIds ?? []).filter(
                  (v) => v !== id,
                ),
              })
            }
            chipColor="destructive"
          />
        )}
      </div>

      {hasAnyConditions && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-xs text-text-muted"
          onClick={() => onChange({})}
        >
          {t("conditions.clearAll")}
        </Button>
      )}
    </div>
  );
}
