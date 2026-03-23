import { useSyncExternalStore, useCallback } from "react";

interface Preferences {
  // Extensible — add future preferences here
  [key: string]: unknown;
}

const STORAGE_KEY = "fluxcore:preferences";

const defaults: Preferences = {};

let listeners: Array<() => void> = [];

function getSnapshot(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // Ignore parse errors
  }
  return defaults;
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function setPreferences(patch: Partial<Preferences>): void {
  const current = getSnapshot();
  const updated = { ...current, ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  listeners.forEach((l) => l());
}

// Keep a stable reference for useSyncExternalStore
let cachedSnapshot = getSnapshot();
function getStableSnapshot(): Preferences {
  const fresh = getSnapshot();
  if (JSON.stringify(fresh) !== JSON.stringify(cachedSnapshot)) {
    cachedSnapshot = fresh;
  }
  return cachedSnapshot;
}

export function usePreferences() {
  const prefs = useSyncExternalStore(subscribe, getStableSnapshot);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPreferences(patch);
  }, []);

  return [prefs, update] as const;
}
