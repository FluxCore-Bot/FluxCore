import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "../../../shared/ui/popover";
import { Icon } from "../../../shared/components/Icon";
import { MemberSearchList } from "../../../shared/ui/member-search-list";
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
 * A slimmed-down sibling of MemberMultiSelect: both are thin popover shells
 * around the shared `MemberSearchList` (search input, debounce, results).
 * This one resolves the pending action on a single pick and closes the
 * popover immediately — there is no multi-chip state to manage here, since
 * the role's assigned-member list is rendered separately by the caller, with
 * provenance, from `useRoleMembers`.
 */
export function RoleMemberPicker({ guildId, excludeIds, disabled, onSelect }: RoleMemberPickerProps) {
  const { t } = useTranslation("permissions");
  const [open, setOpen] = useState(false);
  const triggerId = useId();

  function handleSelect(member: GuildMember) {
    onSelect(member);
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
        <MemberSearchList
          guildId={guildId}
          excludeIds={excludeIds}
          onSelect={handleSelect}
          searchPlaceholder={t("roleEditor.membersSection.searchPlaceholder")}
          emptyQueryHint={t("roleEditor.membersSection.searchHint")}
          loadingLabel={t("roleEditor.membersSection.searchLoading")}
          noResultsLabel={t("roleEditor.membersSection.searchNoResults")}
          listAriaLabel={t("roleEditor.membersSection.addPlaceholder")}
        />
      </PopoverContent>
    </Popover>
  );
}
