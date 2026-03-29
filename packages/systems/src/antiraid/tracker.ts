import { ANTI_NUKE_WINDOW_MS } from "./constants.js";

// === Join Rate Tracker ===

interface JoinEntry {
  timestamps: number[];
}

const joinTracker = new Map<string, JoinEntry>();

/**
 * Record a join event and check if the threshold has been reached.
 * Returns true if the number of joins in the window exceeds the threshold.
 */
export function recordJoin(
  guildId: string,
  joinThreshold: number,
  joinWindowSeconds: number,
): boolean {
  const now = Date.now();
  const entry = joinTracker.get(guildId) ?? { timestamps: [] };
  const windowMs = joinWindowSeconds * 1000;

  // Prune timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
  entry.timestamps.push(now);

  joinTracker.set(guildId, entry);

  return entry.timestamps.length >= joinThreshold;
}

/**
 * Clear join tracking data for a guild.
 */
export function clearJoinTracker(guildId: string): void {
  joinTracker.delete(guildId);
}

// === Anti-Nuke Tracker ===
// Tracks destructive actions (channel/role deletion, mass bans) per executor

// guildId -> executorId -> timestamps
const nukeTracker = new Map<string, Map<string, number[]>>();

/**
 * Record a destructive action by an executor and check if the anti-nuke threshold is reached.
 * Returns true if the executor has performed >= threshold actions within the anti-nuke window.
 */
export function recordNukeAction(
  guildId: string,
  executorId: string,
  threshold: number,
): boolean {
  const now = Date.now();

  let guildMap = nukeTracker.get(guildId);
  if (!guildMap) {
    guildMap = new Map();
    nukeTracker.set(guildId, guildMap);
  }

  const timestamps = guildMap.get(executorId) ?? [];
  const filtered = timestamps.filter((t) => now - t < ANTI_NUKE_WINDOW_MS);
  filtered.push(now);
  guildMap.set(executorId, filtered);

  return filtered.length >= threshold;
}

/**
 * Clear nuke tracking data for a guild.
 */
export function clearNukeTracker(guildId: string): void {
  nukeTracker.delete(guildId);
}

// === Lockdown State Tracker ===

const lockdownStates = new Set<string>();

export function isLockdownActive(guildId: string): boolean {
  return lockdownStates.has(guildId);
}

export function setLockdownState(guildId: string, active: boolean): void {
  if (active) {
    lockdownStates.add(guildId);
  } else {
    lockdownStates.delete(guildId);
  }
}
