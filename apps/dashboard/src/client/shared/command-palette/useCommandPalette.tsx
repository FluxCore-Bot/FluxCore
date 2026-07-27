import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";

interface CommandPaletteValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteValue | null>(null);

export function useCommandPalette(): CommandPaletteValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used inside a CommandPaletteProvider");
  }
  return ctx;
}

export function CommandPaletteProvider({
  children, enabled = true,
}: {
  children: ReactNode;
  /**
   * When false (unauthenticated, or auth still resolving) the hotkey is not
   * registered at all: Ctrl+P stays with the browser on the login page, and a
   * stray Ctrl+K cannot latch the palette open for when auth lands.
   */
  enabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key !== "k" && key !== "p") return;
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.altKey || e.shiftKey) return;

      // Deliberate: this overrides browser print on Ctrl+P / ⌘P across the
      // dashboard. Accepted during design as the cost of Discord-style muscle
      // memory. Removing the "p" branch above restores print.
      e.preventDefault();
      toggle();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle, enabled]);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
}
