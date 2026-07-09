import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { SelectSkeleton } from "./skeletons";
import { cn } from "../lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Extra text folded into the search match (e.g. an event description). */
  keywords?: string;
  /** Optional leading icon, rendered per-row and on the trigger. */
  icon?: ReactNode;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  errorLabel?: string;
  emptyLabel?: string;
  noResultsLabel?: string;
  searchPlaceholder?: string;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder,
  allowNone,
  noneLabel = "None",
  disabled,
  loading,
  error,
  errorLabel = "Failed to load",
  emptyLabel = "No options available",
  noResultsLabel = "No results found",
  searchPlaceholder = "Search...",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) =>
      `${o.label} ${o.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [options, search]);

  const selected = options.find((o) => o.value === value);

  // Clear + focus the search box each time the popover opens.
  useEffect(() => {
    if (open) {
      setSearch("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  if (loading) {
    return <SelectSkeleton />;
  }

  if (error) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "flex h-9 w-full items-center rounded-sm bg-surface-lowest px-3 py-2 text-sm text-danger/70 opacity-50",
          className,
        )}
      >
        {errorLabel}
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
            !selected && "text-outline",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.icon}
            <span className="truncate">{selected?.label ?? placeholder}</span>
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
            className="ms-2 shrink-0 opacity-50"
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
        <div className="border-b border-outline-variant/10 p-2">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full rounded-sm bg-surface-lowest px-2.5 py-1.5 text-sm text-text placeholder:text-outline focus:outline-none"
          />
        </div>

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
              {noneLabel}
            </button>
          )}

          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-text-muted">
              {search ? noResultsLabel : emptyLabel}
            </p>
          ) : (
            filtered.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-surface-high",
                  opt.value === value ? "bg-surface-high text-text" : "text-text",
                )}
                onClick={() => {
                  onValueChange(opt.value);
                  setOpen(false);
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </span>
                {opt.value === value && (
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
