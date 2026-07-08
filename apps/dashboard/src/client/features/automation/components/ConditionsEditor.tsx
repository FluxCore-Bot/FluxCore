import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../../shared/components/Icon";
import { Badge } from "../../../shared/ui/badge";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Label } from "../../../shared/ui/label";
import { DiscordMultiSelect } from "../../../shared/ui/discord-multi-select";
import type { ActionConditions } from "../../../shared/lib/schemas";

interface ConditionsEditorProps {
  guildId: string;
  conditions: ActionConditions;
  onChange: (conditions: ActionConditions) => void;
  compact?: boolean;
  /** Always show expanded, no collapse button */
  alwaysExpanded?: boolean;
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
            className="ms-0.5 rounded-full p-0.5 hover:bg-white/10"
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
  const { t } = useTranslation("rules");
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const id = input.trim();
    if (id && /^\d{17,20}$/.test(id) && !selectedIds.includes(id)) {
      onAdd(id);
      setInput("");
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1.5">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
          className="h-8 px-2"
          onClick={handleAdd}
          disabled={!input.trim() || !/^\d{17,20}$/.test(input.trim())}
        >
          <Icon name="add" size={14} />
        </Button>
      </div>
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
}: ConditionsEditorProps) {
  const { t } = useTranslation("rules");
  const update = (patch: Partial<ActionConditions>) => {
    onChange({ ...conditions, ...patch });
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
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
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
            className="h-6 w-6"
            onClick={() => setExpanded(false)}
          >
            <Icon name="expand_less" size={14} />
          </Button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-text-muted">
        {t("conditions.description")}
      </p>

      {/* Include filters */}
      <div className="space-y-3">
        <span className="section-label text-secondary">
          {t("conditions.include")}
        </span>
        <DiscordMultiSelect
          guildId={guildId}
          type="any"
          selectedIds={conditions.channelIds ?? []}
          onChange={(ids) => update({ channelIds: ids })}
          placeholder={t("conditions.addChannel")}
          label={t("conditions.channels")}
        />
        <DiscordMultiSelect
          guildId={guildId}
          type="role"
          selectedIds={conditions.roleIds ?? []}
          onChange={(ids) => update({ roleIds: ids })}
          placeholder={t("conditions.addRole")}
          label={t("conditions.roles")}
        />
        <UserIdInput
          label={t("conditions.users")}
          selectedIds={conditions.userIds ?? []}
          onAdd={(id) => {
            const current = conditions.userIds ?? [];
            if (!current.includes(id)) update({ userIds: [...current, id] });
          }}
          onRemove={(id) =>
            update({ userIds: (conditions.userIds ?? []).filter((v) => v !== id) })
          }
        />
      </div>

      {/* Exclude filters */}
      <div className="space-y-3 border-t border-border pt-3">
        <span className="section-label text-danger">
          {t("conditions.exclude")}
        </span>
        <DiscordMultiSelect
          guildId={guildId}
          type="any"
          selectedIds={conditions.excludeChannelIds ?? []}
          onChange={(ids) => update({ excludeChannelIds: ids })}
          placeholder={t("conditions.excludeChannel")}
          label={t("conditions.channels")}
        />
        <DiscordMultiSelect
          guildId={guildId}
          type="role"
          selectedIds={conditions.excludeRoleIds ?? []}
          onChange={(ids) => update({ excludeRoleIds: ids })}
          placeholder={t("conditions.excludeRole")}
          label={t("conditions.roles")}
        />
        <UserIdInput
          label={t("conditions.users")}
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
