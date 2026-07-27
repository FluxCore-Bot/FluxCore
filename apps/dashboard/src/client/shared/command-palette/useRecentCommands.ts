import { useCallback, useMemo, useState } from "react";
import type { Command } from "./types";

const STORAGE_PREFIX = "fluxcore.palette.recent";
const MAX_RECENT = 5;

function read(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // Corrupt or unavailable storage must never break the palette.
    return [];
  }
}

function write(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
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
export function useRecentCommands(all: Command[], userId: string) {
  // Keyed per user: on a shared browser one account's trail must not leak
  // into another's palette. The hook remounts on login, so the key is stable
  // for the lifetime of the state below.
  const key = `${STORAGE_PREFIX}.${userId}`;
  const [ids, setIds] = useState<string[]>(() => read(key));

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
      write(key, next);
      return next;
    });
  }, [key]);

  return { recent, remember };
}
