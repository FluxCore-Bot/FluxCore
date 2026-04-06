import { useState, useRef, useEffect, useMemo } from "react";
import { useChannels } from "../../lib/hooks/useChannels";
import { useRoles } from "../../lib/hooks/useRoles";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Skeleton } from "./skeleton";
import { cn } from "../../lib/utils";

export type DiscordSelectType = "text" | "voice" | "category" | "any" | "role";

export interface DiscordSelectProps {
  guildId: string;
  type: DiscordSelectType;
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  /** Adds a "None" option that passes null to onValueChange */
  allowNone?: boolean;
  disabled?: boolean;
  className?: string;
}

function channelLabel(name: string, channelType: number): string {
  if (channelType === 2) return `🔊 ${name}`;
  if (channelType === 4) return `📁 ${name}`;
  return `# ${name}`;
}

export function DiscordSelect({
  guildId,
  type,
  value,
  onValueChange,
  placeholder,
  allowNone,
  disabled,
  className,
}: DiscordSelectProps) {
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

  const options: { id: string; label: string }[] = useMemo(
    () =>
      isRole
        ? (roles ?? []).map((r) => ({ id: r.id, label: `● ${r.name}` }))
        : (channels ?? [])
            .filter((c) => {
              if (type === "text") return c.type === 0;
              if (type === "voice") return c.type === 2;
              if (type === "category") return c.type === 4;
              return c.type === 0 || c.type === 2;
            })
            .map((c) => ({ id: c.id, label: channelLabel(c.name, c.type) })),
    [isRole, roles, channels, type],
  );

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabel = options.find((o) => o.id === value)?.label;
  const defaultPlaceholder = isRole ? "Select a role" : "Select a channel";

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      setSearch("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  if (isLoading) {
    return <Skeleton className={cn("h-9 w-full", className)} />;
  }

  if (isError) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "flex h-9 w-full items-center rounded-sm bg-surface-lowest px-3 py-2 text-sm text-danger/70 opacity-50",
          className,
        )}
      >
        Failed to load
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-sm bg-surface-lowest px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            !selectedLabel && "text-outline",
            className,
          )}
        >
          <span className="truncate">
            {selectedLabel ?? placeholder ?? defaultPlaceholder}
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
        {/* Search input */}
        <div className="border-b border-outline-variant/10 p-2">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-sm bg-surface-lowest px-2.5 py-1.5 text-sm text-text placeholder:text-outline focus:outline-none"
          />
        </div>

        {/* Options list */}
        <div className="max-h-56 overflow-y-auto p-1 scrollbar-thin">
          {allowNone && (
            <button
              type="button"
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-text-muted hover:bg-surface-high",
                value === null && "bg-surface-high text-text",
              )}
              onClick={() => {
                onValueChange(null);
                setOpen(false);
              }}
            >
              None
            </button>
          )}

          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-text-muted">
              {search
                ? "No results found"
                : isRole
                  ? "No roles available"
                  : "No channels available"}
            </p>
          ) : (
            filtered.map((opt) => (
              <button
                type="button"
                key={opt.id}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-surface-high",
                  opt.id === value
                    ? "bg-surface-high text-text"
                    : "text-text/80",
                )}
                onClick={() => {
                  onValueChange(opt.id);
                  setOpen(false);
                }}
              >
                <span className="truncate">{opt.label}</span>
                {opt.id === value && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-accent"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
