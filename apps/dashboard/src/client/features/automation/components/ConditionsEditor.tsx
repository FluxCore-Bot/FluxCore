import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../../shared/components/Icon";
import { Badge } from "../../../shared/ui/badge";
import { Button } from "../../../shared/ui/button";
import { DiscordMultiSelect } from "../../../shared/ui/discord-multi-select";
import { MemberMultiSelect } from "../../../shared/ui/member-multi-select";
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
          <MemberMultiSelect
            guildId={guildId}
            label={t("conditions.includeUsers")}
            placeholder={t("conditions.addMember")}
            selectedIds={conditions.userIds ?? []}
            onChange={(ids) => update({ userIds: ids })}
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
          <MemberMultiSelect
            guildId={guildId}
            label={t("conditions.excludeUsers")}
            placeholder={t("conditions.addMember")}
            selectedIds={conditions.excludeUserIds ?? []}
            onChange={(ids) => update({ excludeUserIds: ids })}
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
