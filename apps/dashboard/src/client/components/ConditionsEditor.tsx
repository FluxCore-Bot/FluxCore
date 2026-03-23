import { useState } from "react";
import { Icon } from "./Icon";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { ActionConditions, Channel, Role } from "../lib/schemas";

interface ConditionsEditorProps {
  conditions: ActionConditions;
  onChange: (conditions: ActionConditions) => void;
  channels: Channel[];
  roles: Role[];
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
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge
          key={item.id}
          variant={color}
          className="gap-1 pr-1 text-[11px]"
        >
          {item.label}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-white/10"
          >
            <Icon name="close" size={10} />
          </button>
        </Badge>
      ))}
    </div>
  );
}

function IdSelector({
  label,
  placeholder,
  selectedIds,
  options,
  onAdd,
  onRemove,
  chipColor = "secondary",
}: {
  label: string;
  placeholder: string;
  selectedIds: string[];
  options: { id: string; name: string }[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  chipColor?: "secondary" | "destructive";
}) {
  const available = options.filter((o) => !selectedIds.includes(o.id));
  const chips = selectedIds
    .map((id) => {
      const opt = options.find((o) => o.id === id);
      return { id, label: opt?.name ?? id };
    });

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {available.length > 0 && (
        <Select value="" onValueChange={(v) => v && onAdd(v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {available.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <ChipList items={chips} onRemove={onRemove} color={chipColor} />
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
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          placeholder="User ID..."
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
  conditions,
  onChange,
  channels,
  roles,
  compact,
  alwaysExpanded,
}: ConditionsEditorProps) {
  const update = (patch: Partial<ActionConditions>) => {
    onChange({ ...conditions, ...patch });
  };

  const addToList = (key: keyof ActionConditions, id: string) => {
    const current = (conditions[key] ?? []) as string[];
    if (!current.includes(id)) {
      update({ [key]: [...current, id] });
    }
  };

  const removeFromList = (key: keyof ActionConditions, id: string) => {
    const current = (conditions[key] ?? []) as string[];
    update({ [key]: current.filter((v) => v !== id) });
  };

  const hasAnyConditions =
    (conditions.channelIds?.length ?? 0) +
    (conditions.roleIds?.length ?? 0) +
    (conditions.userIds?.length ?? 0) +
    (conditions.excludeChannelIds?.length ?? 0) +
    (conditions.excludeRoleIds?.length ?? 0) +
    (conditions.excludeUserIds?.length ?? 0) > 0;

  const [expanded, setExpanded] = useState(hasAnyConditions || !!alwaysExpanded);

  if (!expanded && !alwaysExpanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
      >
        <Icon name="filter_alt" size={14} />
        Add conditions to filter when this rule fires
        {hasAnyConditions && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {(conditions.channelIds?.length ?? 0) +
              (conditions.roleIds?.length ?? 0) +
              (conditions.userIds?.length ?? 0) +
              (conditions.excludeChannelIds?.length ?? 0) +
              (conditions.excludeRoleIds?.length ?? 0) +
              (conditions.excludeUserIds?.length ?? 0)}{" "}
            active
          </Badge>
        )}
      </button>
    );
  }

  return (
    <div className={`space-y-4 rounded-lg border border-border ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="filter_alt" size={16} className="text-accent" />
          <span className="text-xs font-semibold">Conditions</span>
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
        When set, this rule only fires if the event matches <strong>all</strong> include
        filters and <strong>none</strong> of the exclude filters.
      </p>

      {/* Include filters */}
      <div className="space-y-3">
        <span className="section-label text-secondary">
          Include (whitelist)
        </span>
        <IdSelector
          label="Channels"
          placeholder="Add channel..."
          selectedIds={conditions.channelIds ?? []}
          options={channels}
          onAdd={(id) => addToList("channelIds", id)}
          onRemove={(id) => removeFromList("channelIds", id)}
        />
        <IdSelector
          label="Roles"
          placeholder="Add role..."
          selectedIds={conditions.roleIds ?? []}
          options={roles}
          onAdd={(id) => addToList("roleIds", id)}
          onRemove={(id) => removeFromList("roleIds", id)}
        />
        <UserIdInput
          label="Users"
          selectedIds={conditions.userIds ?? []}
          onAdd={(id) => addToList("userIds", id)}
          onRemove={(id) => removeFromList("userIds", id)}
        />
      </div>

      {/* Exclude filters */}
      <div className="space-y-3 border-t border-border pt-3">
        <span className="section-label text-danger">
          Exclude (blacklist)
        </span>
        <IdSelector
          label="Channels"
          placeholder="Exclude channel..."
          selectedIds={conditions.excludeChannelIds ?? []}
          options={channels}
          onAdd={(id) => addToList("excludeChannelIds", id)}
          onRemove={(id) => removeFromList("excludeChannelIds", id)}
          chipColor="destructive"
        />
        <IdSelector
          label="Roles"
          placeholder="Exclude role..."
          selectedIds={conditions.excludeRoleIds ?? []}
          options={roles}
          onAdd={(id) => addToList("excludeRoleIds", id)}
          onRemove={(id) => removeFromList("excludeRoleIds", id)}
          chipColor="destructive"
        />
        <UserIdInput
          label="Users"
          selectedIds={conditions.excludeUserIds ?? []}
          onAdd={(id) => addToList("excludeUserIds", id)}
          onRemove={(id) => removeFromList("excludeUserIds", id)}
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
          Clear all conditions
        </Button>
      )}
    </div>
  );
}
