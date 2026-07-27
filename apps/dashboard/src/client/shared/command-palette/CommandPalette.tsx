import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/dialog";
import { Icon } from "../components/Icon";
import { CommandGroup } from "./CommandGroup";
import { useCommandPalette } from "./useCommandPalette";
import { buildGroups, flatten } from "./useCommandSources";
import type { Command } from "./types";

export function CommandPalette({
  commands, onNavigate,
}: {
  commands: Command[];
  onNavigate: (command: Command) => void;
}) {
  const { t } = useTranslation();
  const { isOpen, close } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const baseId = useId();

  const groups = useMemo(() => buildGroups(commands, query), [commands, query]);
  const flat = useMemo(() => flatten(groups), [groups]);

  /**
   * Keyed on group AND id: recent destinations are re-grouped copies that keep
   * the original's id, so the same id appears twice in `flat`. Keying on id
   * alone would emit duplicate DOM ids, mark both rows aria-selected, and make
   * `aria-activedescendant` resolve to whichever came first.
   */
  const optionId = (command: Command) => `${baseId}-opt-${command.group}-${command.id}`;
  const activeId = flat[cursor] ? optionId(flat[cursor]) : null;

  // A fresh query means a fresh list; leaving the cursor where it was would
  // point at an unrelated row.
  useEffect(() => setCursor(0), [query]);

  // A background refetch can shrink the list while the palette is open; an
  // out-of-range cursor would hand Enter an undefined command.
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(flat.length - 1, 0)));
  }, [flat.length]);

  // Reset between openings so the palette never reopens mid-search.
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setCursor(0);
    }
  }, [isOpen]);

  // DOM focus stays in the input, so the browser never scrolls the listbox to
  // follow the aria-activedescendant cursor on its own.
  useEffect(() => {
    if (activeId) {
      document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeId]);

  function activate(command: Command) {
    onNavigate(command);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (flat.length === 0) {
      if (e.key === "Enter") e.preventDefault();
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setCursor((c) => (c + 1) % flat.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setCursor((c) => (c - 1 + flat.length) % flat.length);
        break;
      case "Home":
        e.preventDefault();
        setCursor(0);
        break;
      case "End":
        e.preventDefault();
        setCursor(flat.length - 1);
        break;
      case "Enter": {
        e.preventDefault();
        // The clamp effect runs after render; a keydown racing it can still
        // see a stale cursor, so never trust the index blindly.
        const target = flat[cursor];
        if (target) activate(target);
        break;
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="top-[15%] max-w-xl translate-y-0 gap-0 p-0">
        {/* Named for assistive tech; the visible affordance is the input. */}
        <DialogTitle className="sr-only">{t("palette.dialogTitle")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("palette.dialogDescription")}
        </DialogDescription>

        <div className="flex items-center gap-3 border-b border-border/50 px-4">
          <Icon name="search" size={18} className="shrink-0 text-text-secondary" />
          {/*
            Transparent, borderless and glow-less: this input spans the full
            width of a glass panel, so the default recessed black fill would
            punch an opaque hole through the frost, and the focus border would
            trace a box around the whole dialog head. The caret plus the
            highlighted row carry focus instead — it is auto-focused and the
            only input here.
          */}
          <input
            autoFocus
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={`${baseId}-listbox`}
            aria-activedescendant={activeId ?? undefined}
            aria-label={t("palette.placeholder")}
            placeholder={t("palette.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="command-palette-input h-14 w-full bg-transparent text-base text-text placeholder:text-text-secondary focus:border-transparent focus:shadow-none focus:outline-none"
          />
        </div>

        <ul
          id={`${baseId}-listbox`}
          role="listbox"
          aria-label={t("palette.dialogTitle")}
          className="max-h-80 overflow-y-auto p-2 scrollbar-thin"
        >
          {groups.map((group) => (
            <CommandGroup
              key={group.key}
              group={group}
              query={query}
              activeId={activeId}
              optionId={optionId}
              onActivate={activate}
              onHover={(command) =>
                setCursor(
                  flat.findIndex(
                    (c) => c.group === command.group && c.id === command.id,
                  ),
                )
              }
            />
          ))}
        </ul>

        {flat.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            {t("palette.empty", { query })}
          </p>
        )}

        {/*
          `total`, never `count` — i18next treats a `count` variable as a plural
          selector, which would demand plural categories in all 48 locales.
        */}
        <p aria-live="polite" role="status" className="sr-only">
          {t("palette.resultCount", { total: flat.length })}
        </p>

        {/*
          12px floor, not 10px: the codebase's own `.section-label` records
          12px as the WCAG minimum, and these hints were below it. The chips
          are bordered so they read as keys rather than as dimmed prose.
        */}
        <div className="flex items-center gap-4 border-t border-border/50 px-4 py-2.5 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-surface-high px-1.5 py-0.5 font-mono">↑↓</kbd>
            {t("palette.hint.navigate")}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-surface-high px-1.5 py-0.5 font-mono">⏎</kbd>
            {t("palette.hint.select")}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-surface-high px-1.5 py-0.5 font-mono">esc</kbd>
            {t("palette.hint.close")}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
