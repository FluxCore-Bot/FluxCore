import { Collection } from "discord.js";

const cooldowns = new Collection<string, Collection<string, number>>();

const CLEANUP_INTERVAL_MS = 60_000;

// Periodic cleanup to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [commandName, timestamps] of cooldowns) {
    for (const [userId, expiresAt] of timestamps) {
      if (now >= expiresAt) {
        timestamps.delete(userId);
      }
    }
    if (timestamps.size === 0) {
      cooldowns.delete(commandName);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

export function isOnCooldown(
  commandName: string,
  userId: string,
): { onCooldown: boolean; remainingMs: number } {
  const timestamps = cooldowns.get(commandName);
  if (!timestamps) return { onCooldown: false, remainingMs: 0 };

  const expiresAt = timestamps.get(userId);
  if (!expiresAt) return { onCooldown: false, remainingMs: 0 };

  const now = Date.now();
  if (now < expiresAt) {
    return { onCooldown: true, remainingMs: expiresAt - now };
  }

  timestamps.delete(userId);
  return { onCooldown: false, remainingMs: 0 };
}

export function setCooldown(
  commandName: string,
  userId: string,
  durationSeconds: number,
): void {
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Collection());
  }

  const timestamps = cooldowns.get(commandName)!;
  timestamps.set(userId, Date.now() + durationSeconds * 1000);
}
