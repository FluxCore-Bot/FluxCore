import { describe, it, expect, vi, beforeEach } from "vitest";

const { warnMock } = vi.hoisted(() => ({ warnMock: vi.fn() }));

vi.mock("@fluxcore/utils", () => ({
  logger: {
    info: vi.fn(),
    warn: warnMock,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({}),
}));

vi.mock("@fluxcore/config", () => ({
  config: { logLevel: "info" },
}));

import { rowToRule } from "../../src/actions/persistence.js";

describe("rowToRule fallback logging", () => {
  beforeEach(() => warnMock.mockReset());

  it("logs a warning when actions JSON is malformed", () => {
    rowToRule({
      id: 42,
      guildId: "g1",
      name: "broken",
      enabled: true,
      eventType: "memberJoin",
      actions: "{not-json",
      conditions: "{}",
      priority: 0,
      createdBy: "u1",
    });
    expect(warnMock).toHaveBeenCalledTimes(1);
    const msg = warnMock.mock.calls[0]?.[0] as string;
    expect(msg).toContain("ActionRule");
    expect(msg).toContain("id=42");
    expect(msg).toContain("actions");
  });

  it("logs a warning when conditions JSON is malformed", () => {
    rowToRule({
      id: 7,
      guildId: "g1",
      name: "broken",
      enabled: true,
      eventType: "memberJoin",
      actions: "[]",
      conditions: "{bad",
      priority: 0,
      createdBy: "u1",
    });
    expect(warnMock).toHaveBeenCalledTimes(1);
    expect(warnMock.mock.calls[0]?.[0]).toContain("conditions");
    expect(warnMock.mock.calls[0]?.[0]).toContain("id=7");
  });

  it("does NOT warn on valid JSON", () => {
    rowToRule({
      id: 1,
      guildId: "g1",
      name: "ok",
      enabled: true,
      eventType: "memberJoin",
      actions: "[]",
      conditions: "{}",
      priority: 0,
      createdBy: "u1",
    });
    expect(warnMock).not.toHaveBeenCalled();
  });

  it("falls back to empty defaults when both columns are malformed", () => {
    const rule = rowToRule({
      id: 99,
      guildId: "g9",
      name: "broken",
      enabled: true,
      eventType: "memberJoin",
      actions: "not-json",
      conditions: "also-not-json",
      priority: 0,
      createdBy: "u1",
    });
    expect(rule.actions).toEqual([]);
    expect(rule.conditions).toEqual({});
    expect(warnMock).toHaveBeenCalledTimes(2);
  });
});
