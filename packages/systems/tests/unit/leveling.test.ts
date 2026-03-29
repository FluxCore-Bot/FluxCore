import { describe, it, expect, vi } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    logLevel: "info",
  },
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@fluxcore/database", () => ({
  getPrisma: vi.fn(),
}));

const { xpForLevel, totalXpForLevel, levelFromXp, applyMultipliers } = await import(
  "../../src/leveling/xp.js"
);

describe("xpForLevel", () => {
  it("returns 100 XP for level 0", () => {
    expect(xpForLevel(0)).toBe(100);
  });

  it("returns 155 XP for level 1", () => {
    expect(xpForLevel(1)).toBe(155);
  });

  it("returns correct XP for level 5", () => {
    // 5 * 25 + 50 * 5 + 100 = 125 + 250 + 100 = 475
    expect(xpForLevel(5)).toBe(475);
  });

  it("returns correct XP for level 10", () => {
    // 5 * 100 + 50 * 10 + 100 = 500 + 500 + 100 = 1100
    expect(xpForLevel(10)).toBe(1100);
  });

  it("follows exponential growth", () => {
    const xp5 = xpForLevel(5);
    const xp10 = xpForLevel(10);
    const xp20 = xpForLevel(20);
    expect(xp10).toBeGreaterThan(xp5);
    expect(xp20).toBeGreaterThan(xp10);
  });
});

describe("totalXpForLevel", () => {
  it("returns 0 for level 0", () => {
    expect(totalXpForLevel(0)).toBe(0);
  });

  it("returns 100 for level 1 (xpForLevel(0) = 100)", () => {
    expect(totalXpForLevel(1)).toBe(100);
  });

  it("returns correct cumulative for level 2", () => {
    // xpForLevel(0) + xpForLevel(1) = 100 + 155 = 255
    expect(totalXpForLevel(2)).toBe(255);
  });

  it("is monotonically increasing", () => {
    for (let i = 1; i <= 10; i++) {
      expect(totalXpForLevel(i)).toBeGreaterThan(totalXpForLevel(i - 1));
    }
  });
});

describe("levelFromXp", () => {
  it("returns level 0 for 0 XP", () => {
    expect(levelFromXp(0)).toBe(0);
  });

  it("returns level 0 for 99 XP (not enough for level 1)", () => {
    expect(levelFromXp(99)).toBe(0);
  });

  it("returns level 1 for exactly 100 XP", () => {
    expect(levelFromXp(100)).toBe(1);
  });

  it("returns level 2 for exactly totalXpForLevel(2) XP", () => {
    const xp = totalXpForLevel(2);
    expect(levelFromXp(xp)).toBe(2);
  });

  it("returns correct level for large XP values", () => {
    const level10Xp = totalXpForLevel(10);
    expect(levelFromXp(level10Xp)).toBe(10);
    expect(levelFromXp(level10Xp + 1)).toBe(10); // still level 10, just with 1 XP extra
    expect(levelFromXp(level10Xp - 1)).toBe(9); // not quite level 10
  });

  it("is inverse of totalXpForLevel", () => {
    for (let level = 0; level <= 20; level++) {
      const xp = totalXpForLevel(level);
      expect(levelFromXp(xp)).toBe(level);
    }
  });
});

describe("applyMultipliers", () => {
  function createMockMember(roleIds: string[]) {
    const roles = new Map(roleIds.map((id) => [id, { id }]));
    return {
      roles: {
        cache: {
          filter: (fn: (role: { id: string }) => boolean) => {
            const filtered = [...roles.values()].filter(fn);
            return {
              map: (mapFn: (role: { id: string }) => number) => filtered.map(mapFn),
            };
          },
        },
      },
    };
  }

  const baseSettings = {
    guildId: "guild-1",
    enabled: true,
    xpPerMessage: 15,
    xpCooldownSeconds: 60,
    voiceXpPerMinute: 5,
    voiceXpEnabled: true,
    announceChannel: null,
    announceMessage: "{user} reached level {level}",
    announceEnabled: true,
    noXpChannels: [] as string[],
    noXpRoles: [] as string[],
    xpMultipliers: {},
  };

  it("returns base XP when no multipliers configured", () => {
    const member = createMockMember(["role-1"]);
    const result = applyMultipliers(15, baseSettings, "channel-1", member as never);
    expect(result).toBe(15);
  });

  it("applies channel multiplier", () => {
    const settings = {
      ...baseSettings,
      xpMultipliers: { channels: { "channel-1": 2 } },
    };
    const member = createMockMember(["role-1"]);
    const result = applyMultipliers(15, settings, "channel-1", member as never);
    expect(result).toBe(30);
  });

  it("does not apply channel multiplier for different channel", () => {
    const settings = {
      ...baseSettings,
      xpMultipliers: { channels: { "channel-1": 2 } },
    };
    const member = createMockMember(["role-1"]);
    const result = applyMultipliers(15, settings, "channel-2", member as never);
    expect(result).toBe(15);
  });

  it("applies role multiplier (uses highest)", () => {
    const settings = {
      ...baseSettings,
      xpMultipliers: { roles: { "role-1": 1.5, "role-2": 3 } },
    };
    const member = createMockMember(["role-1", "role-2"]);
    const result = applyMultipliers(10, settings, "channel-1", member as never);
    expect(result).toBe(30); // 10 * 3
  });

  it("combines channel and role multipliers", () => {
    const settings = {
      ...baseSettings,
      xpMultipliers: { channels: { "channel-1": 2 }, roles: { "role-1": 1.5 } },
    };
    const member = createMockMember(["role-1"]);
    const result = applyMultipliers(10, settings, "channel-1", member as never);
    expect(result).toBe(30); // 10 * 2 * 1.5 = 30
  });

  it("floors the result", () => {
    const settings = {
      ...baseSettings,
      xpMultipliers: { channels: { "channel-1": 1.3 } },
    };
    const member = createMockMember([]);
    const result = applyMultipliers(10, settings, "channel-1", member as never);
    expect(result).toBe(13); // floor(10 * 1.3)
  });
});
