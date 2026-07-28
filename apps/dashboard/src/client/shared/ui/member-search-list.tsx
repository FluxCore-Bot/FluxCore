import { useMemo, useState } from "react";
import { useMemberSearch } from "../hooks/useMembers";
import { useDebounced } from "../hooks/useDebounced";
import type { GuildMember } from "../lib/schemas";

interface MemberSearchListProps {
  guildId: string;
  /** Ids to hide from the results (already-selected members, self, etc.). */
  excludeIds: string[];
  onSelect: (member: GuildMember) => void;
  searchPlaceholder: string;
  emptyQueryHint: string;
  loadingLabel: string;
  noResultsLabel: string;
  /** aria-label for the results `listbox`. */
  listAriaLabel: string;
}

/**
 * Debounced member search box + results list, shared by every member picker
 * (`MemberMultiSelect`'s trigger-filter chips, `RoleMemberPicker`'s single-
 * select add control). Owns the search input, the 250ms debounce, the
 * `useMemberSearch` call, and the loading/empty-query-hint/no-results/option
 * branching — callers own everything around it (the popover trigger, whether
 * picking a result also closes the popover, multi- vs. single-select state).
 *
 * All four states below are intentionally not mutually exclusive in the
 * markup (no early return): `isLoading` gates the loading message, the hint
 * and no-results messages are keyed off the debounced query, and the option
 * buttons render from whatever `results` currently holds. In production this
 * self-resolves (the hook returns `[]` while disabled on an empty query), so
 * only one of them is ever visible at a time in practice.
 */
export function MemberSearchList({
  guildId,
  excludeIds,
  onSelect,
  searchPlaceholder,
  emptyQueryHint,
  loadingLabel,
  noResultsLabel,
  listAriaLabel,
}: MemberSearchListProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 250);

  const { data: results = [], isLoading } = useMemberSearch(guildId, debouncedSearch);
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);
  const options = results.filter((m) => !excludeSet.has(m.id));

  function handleSelect(member: GuildMember) {
    onSelect(member);
    setSearch("");
  }

  return (
    <>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="mb-2 w-full rounded-sm bg-surface-lowest px-2.5 py-1.5 text-sm text-text placeholder:text-outline focus:outline-none"
      />
      <div className="max-h-56 overflow-y-auto" role="listbox" aria-label={listAriaLabel}>
        {isLoading && <p className="px-2 py-3 text-xs text-text-muted">{loadingLabel}</p>}
        {!isLoading && debouncedSearch.trim() === "" && (
          <p className="px-2 py-3 text-xs text-text-muted">{emptyQueryHint}</p>
        )}
        {!isLoading && debouncedSearch.trim() !== "" && options.length === 0 && (
          <p className="px-2 py-3 text-xs text-text-muted">{noResultsLabel}</p>
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
    </>
  );
}
