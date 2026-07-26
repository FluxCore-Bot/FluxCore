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

  // Reset between openings so the palette never reopens mid-search.
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setCursor(0);
    }
  }, [isOpen]);

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
      case "Enter":
        e.preventDefault();
        activate(flat[cursor]);
        break;
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
          <Icon name="search" size={18} className="shrink-0 text-text-muted" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={`${baseId}-listbox`}
            aria-activedescendant={activeId ?? undefined}
            aria-label={t("palette.placeholder")}
            placeholder={t("palette.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="h-12 w-full bg-transparent text-sm text-text placeholder:text-outline focus:outline-none"
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

        <div className="flex items-center gap-4 border-t border-border/50 px-4 py-2 text-[0.625rem] text-text-muted">
          <span><kbd className="font-mono">↑↓</kbd> {t("palette.hint.navigate")}</span>
          <span><kbd className="font-mono">⏎</kbd> {t("palette.hint.select")}</span>
          <span><kbd className="font-mono">esc</kbd> {t("palette.hint.close")}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
