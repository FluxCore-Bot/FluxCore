import { describe, it, expect, vi } from "vitest";

// Mock the config module before importing cooldown
vi.mock("../../src/config/index.js", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const { isOnCooldown, setCooldown } = await import(
  "../../src/systems/cooldown.js"
);

describe("cooldown system", () => {
  const command = "test-cmd";
  const userId = "user-123";

  it("returns not on cooldown when no cooldown is set", () => {
    const result = isOnCooldown("unset-cmd", userId);
    expect(result.onCooldown).toBe(false);
    expect(result.remainingMs).toBe(0);
  });

  it("sets and detects cooldown", () => {
    setCooldown(command, userId, 60);
    const result = isOnCooldown(command, userId);
    expect(result.onCooldown).toBe(true);
    expect(result.remainingMs).toBeGreaterThan(0);
    expect(result.remainingMs).toBeLessThanOrEqual(60_000);
  });

  it("cooldown expires after time passes", () => {
    const expiredCommand = "expired-cmd";
    setCooldown(expiredCommand, userId, 0);

    // With 0 seconds, the cooldown should already be expired or at the boundary
    const result = isOnCooldown(expiredCommand, userId);
    expect(result.onCooldown).toBe(false);
  });

  it("tracks cooldowns per user independently", () => {
    const perUserCmd = "per-user-cmd";
    setCooldown(perUserCmd, "user-a", 60);

    const resultA = isOnCooldown(perUserCmd, "user-a");
    const resultB = isOnCooldown(perUserCmd, "user-b");

    expect(resultA.onCooldown).toBe(true);
    expect(resultB.onCooldown).toBe(false);
  });
});