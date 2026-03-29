import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/database", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  recordJoin,
  clearJoinTracker,
  recordNukeAction,
  clearNukeTracker,
  isLockdownActive,
  setLockdownState,
} from "../../src/antiraid/tracker.js";
import {
  VALID_RAID_ACTIONS,
  DEFAULT_CONFIG,
  DEFAULT_JOIN_THRESHOLD,
  DEFAULT_JOIN_WINDOW,
  DEFAULT_ANTI_NUKE_THRESHOLD,
  ANTI_NUKE_WINDOW_MS,
} from "../../src/antiraid/constants.js";

describe("antiraid tracker", () => {
  beforeEach(() => {
    clearJoinTracker("guild-1");
    clearNukeTracker("guild-1");
    setLockdownState("guild-1", false);
  });

  describe("recordJoin", () => {
    it("returns false when under threshold", () => {
      const result = recordJoin("guild-1", 5, 10);
      expect(result).toBe(false);
    });

    it("returns true when threshold is reached", () => {
      for (let i = 0; i < 4; i++) {
        recordJoin("guild-1", 5, 10);
      }
      const result = recordJoin("guild-1", 5, 10);
      expect(result).toBe(true);
    });

    it("tracks different guilds independently", () => {
      for (let i = 0; i < 4; i++) {
        recordJoin("guild-1", 5, 10);
      }
      const result = recordJoin("guild-2", 5, 10);
      expect(result).toBe(false);
    });

    it("clears data for a guild", () => {
      for (let i = 0; i < 4; i++) {
        recordJoin("guild-1", 5, 10);
      }
      clearJoinTracker("guild-1");
      const result = recordJoin("guild-1", 5, 10);
      expect(result).toBe(false);
    });
  });

  describe("recordNukeAction", () => {
    it("returns false when under threshold", () => {
      const result = recordNukeAction("guild-1", "user-1", 3);
      expect(result).toBe(false);
    });

    it("returns true when threshold is reached", () => {
      recordNukeAction("guild-1", "user-1", 3);
      recordNukeAction("guild-1", "user-1", 3);
      const result = recordNukeAction("guild-1", "user-1", 3);
      expect(result).toBe(true);
    });

    it("tracks different executors independently", () => {
      recordNukeAction("guild-1", "user-1", 3);
      recordNukeAction("guild-1", "user-1", 3);
      const result = recordNukeAction("guild-1", "user-2", 3);
      expect(result).toBe(false);
    });

    it("tracks different guilds independently", () => {
      recordNukeAction("guild-1", "user-1", 3);
      recordNukeAction("guild-1", "user-1", 3);
      const result = recordNukeAction("guild-2", "user-1", 3);
      expect(result).toBe(false);
    });

    it("clears data for a guild", () => {
      recordNukeAction("guild-1", "user-1", 3);
      recordNukeAction("guild-1", "user-1", 3);
      clearNukeTracker("guild-1");
      const result = recordNukeAction("guild-1", "user-1", 3);
      expect(result).toBe(false);
    });
  });

  describe("lockdown state", () => {
    it("is initially inactive", () => {
      expect(isLockdownActive("guild-1")).toBe(false);
    });

    it("can be activated", () => {
      setLockdownState("guild-1", true);
      expect(isLockdownActive("guild-1")).toBe(true);
    });

    it("can be deactivated", () => {
      setLockdownState("guild-1", true);
      setLockdownState("guild-1", false);
      expect(isLockdownActive("guild-1")).toBe(false);
    });

    it("tracks different guilds independently", () => {
      setLockdownState("guild-1", true);
      expect(isLockdownActive("guild-2")).toBe(false);
    });
  });
});

describe("antiraid constants", () => {
  it("has valid raid actions", () => {
    expect(VALID_RAID_ACTIONS).toContain("kick");
    expect(VALID_RAID_ACTIONS).toContain("ban");
    expect(VALID_RAID_ACTIONS).toContain("timeout");
    expect(VALID_RAID_ACTIONS).toHaveLength(3);
  });

  it("has expected default config values", () => {
    expect(DEFAULT_CONFIG.enabled).toBe(false);
    expect(DEFAULT_CONFIG.joinThreshold).toBe(DEFAULT_JOIN_THRESHOLD);
    expect(DEFAULT_CONFIG.joinWindow).toBe(DEFAULT_JOIN_WINDOW);
    expect(DEFAULT_CONFIG.joinAction).toBe("kick");
    expect(DEFAULT_CONFIG.accountAgeMinDays).toBe(0);
    expect(DEFAULT_CONFIG.antiNukeEnabled).toBe(false);
    expect(DEFAULT_CONFIG.antiNukeThreshold).toBe(DEFAULT_ANTI_NUKE_THRESHOLD);
    expect(DEFAULT_CONFIG.lockdownOnRaid).toBe(false);
    expect(DEFAULT_CONFIG.whitelistedRoleIds).toEqual([]);
    expect(DEFAULT_CONFIG.logChannelId).toBeNull();
  });

  it("anti-nuke window is 10 seconds", () => {
    expect(ANTI_NUKE_WINDOW_MS).toBe(10_000);
  });
});
