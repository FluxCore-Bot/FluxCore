import { useCallback, useMemo, useState } from "react";
import type { Command } from "./types";

const STORAGE_KEY = "fluxcore.palette.recent";
const MAX_RECENT = 5;

function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // Corrupt or unavailable storage must never break the palette.
    return [];
  }
}

function write(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Private mode / quota exceeded — recents are a convenience, not a feature
    // worth failing over.
  }
}

/**
 * Only ids are persisted; the Command objects are resolved from the live list
 * on every render. That means a page the viewer has lost permission for, or a
 * route that no longer exists, silently drops out instead of lingering as a
 * dead entry.
 */
export function useRecentCommands(all: Command[]) {
  const [ids, setIds] = useState<string[]>(read);

  const recent = useMemo(
    () =>
      ids
        .map((id) => all.find((c) => c.id === id))
        .filter((c): c is Command => c !== undefined)
        .map((c) => ({ ...c, group: "recent" as const })),
    [ids, all],
  );

  const remember = useCallback((command: Command) => {
    setIds((prev) => {
      const next = [command.id, ...prev.filter((id) => id !== command.id)]
        .slice(0, MAX_RECENT);
      write(next);
      return next;
    });
  }, []);

  return { recent, remember };
}
