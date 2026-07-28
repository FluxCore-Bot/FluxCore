import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "../../../shared/ui/popover";
import { Icon } from "../../../shared/components/Icon";
import { useMemberSearch } from "../../../shared/hooks/useMembers";
import { useDebounced } from "../../../shared/hooks/useDebounced";
import type { GuildMember } from "../../../shared/lib/schemas";

interface RoleMemberPickerProps {
  guildId: string;
  /** Ids to hide from results: members already on the role, plus the caller's
   * own id when they are not the owner (the self-assign 403 stays unreachable
   * rather than merely explained). */
  excludeIds: string[];
  disabled?: boolean;
  onSelect: (member: GuildMember) => void;
}

/**
 * Single-select "add a member to this role" control.
 *
 * A slimmed-down sibling of MemberMultiSelect (shares its search hook and
 * debounce timing): one pick resolves the pending action immediately and
 * closes the popover. There is no multi-chip state to manage here — the
 * role's assigned-member list is rendered separately by the caller, with
 * provenance, from `useRoleMembers`.
 */
export function RoleMemberPicker({ guildId, excludeIds, disabled, onSelect }: RoleMemberPickerProps) {
  const { t } = useTranslation("permissions");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 250);
  const triggerId = useId();

  const { data: results = [], isLoading } = useMemberSearch(guildId, debouncedSearch);
  const excludeSet = new Set(excludeIds);
  const options = results.filter((m) => !excludeSet.has(m.id));

  function handleSelect(member: GuildMember) {
    onSelect(member);
    setSearch("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={triggerId}
          type="button"
          disabled={disabled}
          className="flex h-9 w-full items-center gap-2 rounded-sm border border-dashed border-outline-variant/40 px-3 text-sm text-text-muted transition-colors hover:bg-surface-high/50 hover:text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-72"
        >
          <Icon name="person_add" size={16} />
          {t("roleEditor.membersSection.addPlaceholder")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("roleEditor.membersSection.searchPlaceholder")}
          aria-label={t("roleEditor.membersSection.searchPlaceholder")}
          className="mb-2 w-full rounded-sm bg-surface-lowest px-2.5 py-1.5 text-sm text-text placeholder:text-outline focus:outline-none"
        />
        <div
          className="max-h-56 overflow-y-auto"
          role="listbox"
          aria-label={t("roleEditor.membersSection.addPlaceholder")}
        >
          {isLoading && (
            <p className="px-2 py-3 text-xs text-text-muted">
              {t("roleEditor.membersSection.searchLoading")}
            </p>
          )}
          {!isLoading && debouncedSearch.trim() === "" && (
            <p className="px-2 py-3 text-xs text-text-muted">
              {t("roleEditor.membersSection.searchHint")}
            </p>
          )}
          {!isLoading && debouncedSearch.trim() !== "" && options.length === 0 && (
            <p className="px-2 py-3 text-xs text-text-muted">
              {t("roleEditor.membersSection.searchNoResults")}
            </p>
          )}
          {options.map((member) => (
            <button
              key={member.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => handleSelect(member)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate">{member.displayName}</span>
              <span className="ms-auto truncate text-[11px] text-text-muted">@{member.username}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
