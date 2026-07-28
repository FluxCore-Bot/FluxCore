import { useState, useMemo, useId } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Label } from "./label";
import { Badge } from "./badge";
import { Icon } from "../components/Icon";
import { useMemberSearch, useMembersByIds } from "../hooks/useMembers";
import { useDebounced } from "../hooks/useDebounced";

interface MemberMultiSelectProps {
  guildId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label: string;
  placeholder: string;
  chipColor?: "secondary" | "destructive";
}

/**
 * Member picker for trigger filters.
 *
 * Replaces a bare text box that demanded a raw 17-20 digit snowflake and
 * rendered saved members as those same digits — there was no members endpoint
 * in the dashboard at all until now, which is why it worked that way.
 */
export function MemberMultiSelect({
  guildId,
  selectedIds,
  onChange,
  label,
  placeholder,
  chipColor = "secondary",
}: MemberMultiSelectProps) {
  const { t } = useTranslation(["common", "rules"]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 250);
  const triggerId = useId();

  const { data: results = [], isLoading } = useMemberSearch(guildId, debouncedSearch);
  const { data: selected = [] } = useMembersByIds(guildId, selectedIds);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const options = results.filter((m) => !selectedSet.has(m.id));

  // A member who has since left the guild will not resolve; show the raw id
  // rather than dropping them silently, so the filter stays editable.
  const chips = selectedIds.map((id) => {
    const found = selected.find((m) => m.id === id);
    return { id, label: found?.displayName ?? id, avatar: found?.avatar ?? null };
  });

  return (
    <div className="space-y-1.5">
      <Label htmlFor={triggerId} className="text-xs">
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={triggerId}
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-sm bg-surface-lowest px-3 py-2 text-sm text-outline focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <span className="truncate">
              {chips.length > 0
                ? t("common:form.selectedCount", { count: chips.length })
                : placeholder}
            </span>
            <Icon name="expand_more" size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("common:form.search")}
            aria-label={t("common:form.search")}
            className="mb-2 w-full rounded-sm bg-surface-lowest px-2.5 py-1.5 text-sm text-text placeholder:text-outline focus:outline-none"
          />
          <div className="max-h-56 overflow-y-auto" role="listbox" aria-label={label}>
            {isLoading && (
              <p className="px-2 py-3 text-xs text-text-muted">{t("common:form.loading")}</p>
            )}
            {!isLoading && debouncedSearch.trim() === "" && (
              <p className="px-2 py-3 text-xs text-text-muted">
                {t("rules:conditions.memberSearchHint")}
              </p>
            )}
            {!isLoading && debouncedSearch.trim() !== "" && options.length === 0 && (
              <p className="px-2 py-3 text-xs text-text-muted">{t("common:form.noResults")}</p>
            )}
            {options.map((member) => (
              <button
                key={member.id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onChange([...selectedIds, member.id]);
                  setSearch("");
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate">{member.displayName}</span>
                <span className="ms-auto truncate text-[11px] text-text-muted">
                  @{member.username}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Badge key={chip.id} variant={chipColor} className="gap-1 pe-1 text-[11px]">
              {chip.label}
              <button
                type="button"
                aria-label={t("common:form.removeItem", { label: chip.label })}
                onClick={() => onChange(selectedIds.filter((id) => id !== chip.id))}
                className="ms-0.5 rounded-full p-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon name="close" size={10} />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
