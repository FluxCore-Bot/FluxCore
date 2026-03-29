import { describe, it, expect } from "vitest";
import { selectWinners, rerollWinners } from "../../src/giveaways/winner.js";
import type { Giveaway } from "@fluxcore/types";

function makeGiveaway(overrides: Partial<Giveaway> = {}): Giveaway {
  return {
    id: 1,
    guildId: "guild-1",
    channelId: "ch-1",
    messageId: null,
    hostId: "host-1",
    prize: "Test Prize",
    winners: 1,
    endsAt: new Date(),
    ended: false,
    winnerIds: [],
    entrantIds: [],
    requiredRoleIds: [],
    createdAt: new Date(),
    ...overrides,
  };
}

describe("selectWinners", () => {
  it("returns empty array when no entrants", () => {
    const giveaway = makeGiveaway({ entrantIds: [] });
    expect(selectWinners(giveaway)).toEqual([]);
  });

  it("selects a single winner", () => {
    const giveaway = makeGiveaway({
      entrantIds: ["u1", "u2", "u3"],
      winners: 1,
    });
    const result = selectWinners(giveaway);
    expect(result).toHaveLength(1);
    expect(giveaway.entrantIds).toContain(result[0]);
  });

  it("selects multiple winners", () => {
    const giveaway = makeGiveaway({
      entrantIds: ["u1", "u2", "u3", "u4", "u5"],
      winners: 3,
    });
    const result = selectWinners(giveaway);
    expect(result).toHaveLength(3);

    // All winners should be unique
    expect(new Set(result).size).toBe(3);

    // All winners should be from entrants
    for (const w of result) {
      expect(giveaway.entrantIds).toContain(w);
    }
  });

  it("caps winners to number of entrants", () => {
    const giveaway = makeGiveaway({
      entrantIds: ["u1", "u2"],
      winners: 5,
    });
    const result = selectWinners(giveaway);
    expect(result).toHaveLength(2);
  });

  it("allows overriding winner count", () => {
    const giveaway = makeGiveaway({
      entrantIds: ["u1", "u2", "u3"],
      winners: 1,
    });
    const result = selectWinners(giveaway, 2);
    expect(result).toHaveLength(2);
  });
});

describe("rerollWinners", () => {
  it("returns empty when no eligible entrants after excluding winners", () => {
    const giveaway = makeGiveaway({
      entrantIds: ["u1"],
      winnerIds: ["u1"],
      winners: 1,
    });
    const result = rerollWinners(giveaway);
    expect(result).toEqual([]);
  });

  it("excludes previous winners by default", () => {
    const giveaway = makeGiveaway({
      entrantIds: ["u1", "u2", "u3"],
      winnerIds: ["u1"],
      winners: 1,
    });

    // Run multiple times to verify exclusion
    for (let i = 0; i < 20; i++) {
      const result = rerollWinners(giveaway);
      expect(result).toHaveLength(1);
      expect(result[0]).not.toBe("u1");
    }
  });

  it("uses custom exclude list", () => {
    const giveaway = makeGiveaway({
      entrantIds: ["u1", "u2", "u3"],
      winnerIds: ["u1"],
      winners: 1,
    });

    for (let i = 0; i < 20; i++) {
      const result = rerollWinners(giveaway, 1, ["u1", "u2"]);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe("u3");
    }
  });

  it("selects multiple new winners", () => {
    const giveaway = makeGiveaway({
      entrantIds: ["u1", "u2", "u3", "u4", "u5"],
      winnerIds: ["u1"],
      winners: 2,
    });

    const result = rerollWinners(giveaway);
    expect(result).toHaveLength(2);
    expect(result).not.toContain("u1");
    expect(new Set(result).size).toBe(2);
  });
});
