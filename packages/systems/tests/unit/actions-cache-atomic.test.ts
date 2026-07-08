import { describe, it, expect, vi, beforeEach } from "vitest";

const getRulesByGuildMock = vi.fn();

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({}),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../src/actions/persistence.js", () => ({
  getRulesByGuild: (...args: unknown[]) => getRulesByGuildMock(...args),
  rowToRule: (r: unknown) => r,
}));

import {
  reloadGuild,
  getRulesForEvent,
  addRuleToCache,
  invalidateGuild,
} from "../../src/actions/cache.js";
import type { ActionRule, ActionEventType } from "../../src/actions/types.js";

function rule(id: number, eventType: string): ActionRule {
  return {
    id,
    guildId: "g1",
    name: `r${id}`,
    enabled: true,
    eventType: eventType as ActionEventType,
    actions: [],
    conditions: {},
    priority: 0,
    createdBy: "u1",
  };
}

describe("reloadGuild atomicity", () => {
  beforeEach(() => {
    invalidateGuild("g1");
    getRulesByGuildMock.mockReset();
  });

  it("never exposes an empty rule set during reload (synchronous fetch)", async () => {
    addRuleToCache(rule(1, "memberJoin"));
    expect(getRulesForEvent("g1", "memberJoin")).toHaveLength(1);

    const observed: number[] = [];
    getRulesByGuildMock.mockImplementation(async () => {
      observed.push(getRulesForEvent("g1", "memberJoin").length);
      return [rule(2, "memberJoin"), rule(3, "memberJoin")];
    });

    await reloadGuild("g1");

    expect(observed).toEqual([1]);
    expect(getRulesForEvent("g1", "memberJoin")).toHaveLength(2);
  });

  it("swaps the entire eventType map in one assignment", async () => {
    addRuleToCache(rule(10, "messageDeleted"));
    getRulesByGuildMock.mockResolvedValue([rule(11, "messageCreated")]);

    await reloadGuild("g1");

    expect(getRulesForEvent("g1", "messageDeleted")).toHaveLength(0);
    expect(getRulesForEvent("g1", "messageCreated")).toHaveLength(1);
  });

  it("preserves visibility across microtask boundaries", async () => {
    addRuleToCache(rule(20, "voiceJoin"));
    getRulesByGuildMock.mockImplementation(async () => {
      await Promise.resolve();
      return [rule(21, "voiceJoin")];
    });

    const reloadPromise = reloadGuild("g1");
    await Promise.resolve();
    expect(getRulesForEvent("g1", "voiceJoin").length).toBeGreaterThan(0);
    await reloadPromise;
    expect(getRulesForEvent("g1", "voiceJoin")).toHaveLength(1);
  });

  it("clears the guild cache when reload returns no rules", async () => {
    addRuleToCache(rule(30, "memberJoin"));
    getRulesByGuildMock.mockResolvedValue([]);

    await reloadGuild("g1");

    expect(getRulesForEvent("g1", "memberJoin")).toHaveLength(0);
  });

  it("sorts each event bucket by priority desc after reload", async () => {
    getRulesByGuildMock.mockResolvedValue([
      { ...rule(40, "memberJoin"), priority: 1 },
      { ...rule(41, "memberJoin"), priority: 5 },
      { ...rule(42, "memberJoin"), priority: 3 },
    ]);

    await reloadGuild("g1");

    const result = getRulesForEvent("g1", "memberJoin");
    expect(result.map((r) => r.id)).toEqual([41, 42, 40]);
  });
});
