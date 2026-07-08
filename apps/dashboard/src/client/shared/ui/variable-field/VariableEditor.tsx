import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { Popover, PopoverAnchor, PopoverContent } from "../popover";
import { ScrollArea } from "../scroll-area";
import type { VariableDescriptor } from "./types";
import { tokenize } from "./tokens";
import { detectUnknownTokens } from "./validation";
import { insertToken, getActiveQuery } from "./caret";
import { filterByQuery } from "./filterVariables";
import { knownTokenSet } from "./registry";

interface VariableEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: VariableDescriptor[];
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

const SHARED =
  "w-full rounded-sm border border-transparent bg-surface-lowest px-3 text-sm text-text placeholder:text-outline focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[0_0_4px_rgba(163,166,255,0.10)] disabled:cursor-not-allowed disabled:opacity-50";
const INPUT_BOX = "h-9 py-1";
const AREA_BOX = "min-h-[60px] py-2";

export default function VariableEditor(props: VariableEditorProps) {
  const {
    value,
    onChange,
    variables,
    multiline,
    rows = 3,
    maxLength,
    placeholder,
    disabled,
    id,
  } = props;
  const { t } = useTranslation("common");
  const known = React.useMemo(() => knownTokenSet(variables), [variables]);
  const fieldRef = React.useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [queryStart, setQueryStart] = React.useState(0);
  // -1 means "no item highlighted yet"; ArrowDown moves to 0 first
  const [active, setActive] = React.useState(-1);

  const matches = React.useMemo(
    () => (open ? filterByQuery(variables, query) : []),
    [open, query, variables],
  );
  // Use value prop for overlay rendering; unknown tokens computed from prop
  const unknowns = React.useMemo(() => detectUnknownTokens(value, known), [value, known]);
  const segments = React.useMemo(() => tokenize(value, known), [value, known]);

  React.useEffect(() => {
    // Reset to -1 (nothing highlighted) whenever the match list changes
    setActive(-1);
  }, [matches.length]);

  function syncQueryFromValue(domValue: string, caret: number) {
    const q = getActiveQuery(domValue, caret);
    if (q) {
      setQuery(q.query);
      setQueryStart(q.start);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  function syncQueryFromCaret() {
    const el = fieldRef.current;
    if (!el) return;
    syncQueryFromValue(el.value, el.selectionStart ?? el.value.length);
  }

  function commit(token: string) {
    const el = fieldRef.current;
    if (!el) return;
    // Use the DOM's live value so we always have the real current text
    const domValue = el.value;
    const caret = el.selectionStart ?? domValue.length;
    const { value: next, cursor } = insertToken(domValue, queryStart, caret, token);
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) {
    const newValue = e.target.value;
    const caret = e.target.selectionStart ?? newValue.length;
    onChange(newValue);
    // Read directly from the event target — available synchronously before rAF
    syncQueryFromValue(newValue, caret);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      // If nothing is highlighted yet, default to first match
      const idx = active < 0 ? 0 : active;
      commit(matches[idx].token);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  function handleScroll(e: React.UIEvent<HTMLElement>) {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }

  const listboxId = id ? `${id}-listbox` : "vf-listbox";

  return (
    <div>
      <Popover open={open && matches.length > 0}>
        <PopoverAnchor asChild>
          <div className={cn("relative", props.className)}>
            {/* Overlay backdrop for token highlighting — aria-hidden, pointer-events-none */}
            <div
              ref={backdropRef}
              aria-hidden="true"
              className={cn(
                SHARED,
                multiline ? AREA_BOX : INPUT_BOX,
                "pointer-events-none absolute inset-0 overflow-hidden border-transparent text-text",
                multiline ? "whitespace-pre-wrap break-words" : "whitespace-pre",
              )}
            >
              {segments.map((seg, i) =>
                seg.type === "var" ? (
                  <span
                    key={i}
                    className={
                      seg.known
                        ? "text-accent"
                        : "text-danger underline decoration-danger/50"
                    }
                  >
                    {seg.value}
                  </span>
                ) : (
                  <span key={i}>{seg.value}</span>
                ),
              )}
              {/* Preserve trailing newline height in textarea */}
              {value.endsWith("\n") ? "\n" : ""}
            </div>

            {multiline ? (
              <textarea
                ref={fieldRef}
                id={id}
                rows={rows}
                value={value}
                maxLength={maxLength}
                placeholder={placeholder}
                disabled={disabled}
                aria-label={props["aria-label"]}
                role="combobox"
                aria-expanded={open && matches.length > 0}
                aria-controls={listboxId}
                aria-autocomplete="list"
                className={cn(
                  SHARED,
                  AREA_BOX,
                  "relative bg-transparent text-transparent caret-text whitespace-pre-wrap break-words",
                )}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                onClick={syncQueryFromCaret}
                onBlur={() => setTimeout(() => setOpen(false), 100)}
              />
            ) : (
              <input
                ref={fieldRef}
                id={id}
                type="text"
                value={value}
                maxLength={maxLength}
                placeholder={placeholder}
                disabled={disabled}
                aria-label={props["aria-label"]}
                role="combobox"
                aria-expanded={open && matches.length > 0}
                aria-controls={listboxId}
                aria-autocomplete="list"
                className={cn(
                  SHARED,
                  INPUT_BOX,
                  "relative bg-transparent text-transparent caret-text",
                )}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                onClick={syncQueryFromCaret}
                onBlur={() => setTimeout(() => setOpen(false), 100)}
              />
            )}
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          className="w-72 p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <ScrollArea className="max-h-56">
            <ul role="listbox" id={listboxId} className="p-1">
              {matches.map((m, i) => (
                <li
                  key={m.token}
                  role="option"
                  aria-selected={active >= 0 && i === active}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm",
                    active >= 0 && i === active
                      ? "bg-accent/15 text-text"
                      : "text-text-muted",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(m.token);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="font-mono text-accent">{m.token}</span>
                  <span className="truncate text-xs">
                    {m.description ?? (m.labelKey ? t(m.labelKey) : "")}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {unknowns.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {unknowns.map((u) => (
            <li key={u.token} className="text-xs text-danger">
              {t("variableField.unknown", { token: u.token })}
              {u.suggestion
                ? " " + t("variableField.didYouMean", { suggestion: u.suggestion })
                : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
