import { useState, useRef, useEffect, useMemo } from "react";
import { useChannels } from "../hooks/useChannels";
import { useRoles } from "../hooks/useRoles";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { SelectSkeleton } from "./skeletons";
import { Label } from "./label";
import { cn } from "../lib/utils";

export type DiscordMultiSelectType = "text" | "voice" | "any" | "role";

export interface DiscordMultiSelectProps {
  guildId: string;
  type: DiscordMultiSelectType;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  label?: string;
}

function channelLabel(name: string, channelType: number): string {
  return channelType === 2 ? `🔊 ${name}` : `# ${name}`;
}

export function DiscordMultiSelect({
  guildId,
  type,
  selectedIds,
  onChange,
  placeholder,
  label,
}: DiscordMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const isRole = type === "role";
  const {
    data: channels,
    isLoading: chLoading,
    isError: chError,
  } = useChannels(guildId, { enabled: !isRole });
  const {
    data: roles,
    isLoading: roLoading,
    isError: roError,
  } = useRoles(guildId, { enabled: isRole });

  const isLoading = isRole ? roLoading : chLoading;
  const isError = isRole ? roError : chError;

  const allOptions = useMemo(
    () =>
      isRole
        ? (roles ?? []).map((r) => ({ id: r.id, name: `● ${r.name}` }))
        : (channels ?? [])
            .filter((c) => {
              if (type === "text") return c.type === 0;
              if (type === "voice") return c.type === 2;
              return c.type === 0 || c.type === 2;
            })
            .map((c) => ({ id: c.id, name: channelLabel(c.name, c.type) })),
    [isRole, roles, channels, type],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allOptions.filter(
      (o) => !selectedSet.has(o.id) && (!q || o.name.toLowerCase().includes(q)),
    );
  }, [allOptions, selectedSet, search]);

  const chips = useMemo(
    () =>
      selectedIds.map((id) => {
        const found = allOptions.find((o) => o.id === id);
        return { id, label: found?.name ?? id };
      }),
    [selectedIds, allOptions],
  );

  function add(id: string) {
    if (!selectedSet.has(id)) onChange([...selectedIds, id]);
  }

  function remove(id: string) {
    onChange(selectedIds.filter((v) => v !== id));
  }

  function toggle(id: string) {
    if (selectedSet.has(id)) remove(id);
    else add(id);
  }

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      setSearch("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const defaultPlaceholder = isRole ? "Add roles..." : "Add channels...";

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs">{label}</Label>}

      {isLoading ? (
        <SelectSkeleton />
      ) : isError ? (
        <button
          type="button"
          disabled
          className="flex h-9 w-full items-center rounded-sm bg-surface-lowest px-3 py-2 text-sm text-danger/70 opacity-50"
        >
          Failed to load
        </button>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-9 w-full items-center justify-between rounded-sm bg-surface-lowest px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring",
                chips.length > 0 ? "text-text" : "text-outline",
              )}
            >
              <span className="truncate">
                {chips.length > 0
                  ? `${chips.length} selected`
                  : placeholder ?? defaultPlaceholder}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-2 shrink-0 opacity-50"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </PopoverTrigger>

          <PopoverContent
            className="w-(--radix-popover-trigger-width) p-0"
            align="start"
            sideOffset={4}
          >
            {/* Search */}
            <div className="border-b border-outline-variant/10 p-2">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-sm bg-surface-lowest px-2.5 py-1.5 text-sm text-text placeholder:text-outline focus:outline-none"
              />
            </div>

            {/* Options list with checkboxes */}
            <div className="max-h-56 overflow-y-auto p-1 scrollbar-thin">
              {/* Selected items first */}
              {chips.map((chip) => (
                <button
                  type="button"
                  key={chip.id}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-text hover:bg-surface-high"
                  onClick={() => toggle(chip.id)}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border border-accent bg-accent/20">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-accent"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="truncate">{chip.label}</span>
                </button>
              ))}

              {/* Divider between selected and available */}
              {chips.length > 0 && filtered.length > 0 && (
                <div className="mx-2 my-1 h-px bg-outline-variant/10" />
              )}

              {/* Available items */}
              {filtered.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-text/80 hover:bg-surface-high"
                  onClick={() => toggle(opt.id)}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border border-outline-variant/30" />
                  <span className="truncate">{opt.name}</span>
                </button>
              ))}

              {filtered.length === 0 && chips.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-text-muted">
                  {isRole ? "No roles available" : "No channels available"}
                </p>
              )}

              {filtered.length === 0 && chips.length > 0 && search && (
                <p className="px-2 py-3 text-center text-xs text-text-muted">
                  No results found
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Selected chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 rounded-sm bg-accent/10 px-2 py-0.5 text-xs text-accent"
            >
              <span className="max-w-32 truncate">{chip.label}</span>
              <button
                type="button"
                aria-label={`Remove ${chip.label}`}
                onClick={() => remove(chip.id)}
                className="rounded-xs p-0.5 transition-colors hover:bg-accent/20 hover:text-text"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
