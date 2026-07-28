import { useState, useId } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Label } from "./label";
import { Badge } from "./badge";
import { Icon } from "../components/Icon";
import { useMembersByIds } from "../hooks/useMembers";
import { MemberSearchList } from "./member-search-list";

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
  const triggerId = useId();

  const { data: selected = [] } = useMembersByIds(guildId, selectedIds);

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
          <MemberSearchList
            guildId={guildId}
            excludeIds={selectedIds}
            onSelect={(member) => onChange([...selectedIds, member.id])}
            searchPlaceholder={t("common:form.search")}
            emptyQueryHint={t("rules:conditions.memberSearchHint")}
            loadingLabel={t("common:form.loading")}
            noResultsLabel={t("common:form.noResults")}
            listAriaLabel={label}
          />
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
