import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", guildId: undefined, logLevel: "info" },
}));

const mockGetGuildSettingsOrDefault = vi.fn().mockReturnValue({ globalEnabled: true, maxRules: 25 });
vi.mock("@fluxcore/systems/actions/config", () => ({
  getGuildSettingsOrDefault: (...a: unknown[]) => mockGetGuildSettingsOrDefault(...a),
}));

const mockGetRulesForEvent = vi.fn().mockReturnValue([]);
vi.mock("@fluxcore/systems/actions/cache", () => ({
  getRulesForEvent: (...a: unknown[]) => mockGetRulesForEvent(...a),
}));

const mockLogExecution = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/actions/persistence", () => ({
  logExecution: (...a: unknown[]) => mockLogExecution(...a),
}));

/** Records which action ran, in order, so branch/order assertions are exact. */
const ran: string[] = [];
const mockExecutor = vi.fn(async (_c: unknown, _ctx: unknown, config: { type: string; message?: string }) => {
  ran.push(config.message ?? config.type);
});
vi.mock("../../../../src/features/automation/system/registry.js", () => ({
  getExecutor: vi.fn((type: string) => (type === "unknownAction" ? null : mockExecutor)),
}));

const { processEvent } = await import(
  "../../../../src/features/automation/system/executor.js"
);

const ctx = {
  eventType: "memberJoin" as const,
  guildId: "g1",
  guildName: "G",
  userId: "u1",
  userName: "ada",
  channelId: "c1",
  channelName: "general",
  memberCount: 42,
  timestamp: new Date().toISOString(),
};

function action(id: string, message: string, next: string | null) {
  return { id, type: "action", action: { type: "sendMessage", message }, next };
}

function rule(steps: unknown[], entryStepId: string) {
  return [{ name: "graph", enabled: true, conditions: {}, actions: [], steps, entryStepId }];
}

/**
 * The v2 step graph is what the canvas actually saves once a rule has any
 * condition or delay, and the executor prefers it over the flat action list —
 * yet none of it was covered. These are the paths a user's branching workflow
 * depends on.
 */
describe("executor — v2 step graph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ran.length = 0;
    mockGetGuildSettingsOrDefault.mockReturnValue({ globalEnabled: true, maxRules: 25 });
  });

  it("runs steps in `next` order, not array order", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(
      rule(
        [action("a", "first", "c"), action("b", "third", null), action("c", "second", "b")],
        "a",
      ),
    );

    await processEvent({} as never, ctx);

    expect(ran).toEqual(["first", "second", "third"]);
  });

  it("prefers the step graph over the flat action list", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([
      {
        name: "both",
        enabled: true,
        conditions: {},
        actions: [{ type: "sendMessage", message: "legacy" }],
        steps: [action("a", "graph", null)],
        entryStepId: "a",
      },
    ]);

    await processEvent({} as never, ctx);

    expect(ran).toEqual(["graph"]);
  });

  it("takes the then-branch when the condition matches", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(
      rule(
        [
          { id: "q", type: "condition", condition: { field: "channelName", operator: "equals", value: "general" }, thenNext: "yes", elseNext: "no" },
          action("yes", "matched", null),
          action("no", "missed", null),
        ],
        "q",
      ),
    );

    await processEvent({} as never, ctx);

    expect(ran).toEqual(["matched"]);
  });

  it("takes the else-branch when it does not", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(
      rule(
        [
          { id: "q", type: "condition", condition: { field: "channelName", operator: "equals", value: "other" }, thenNext: "yes", elseNext: "no" },
          action("yes", "matched", null),
          action("no", "missed", null),
        ],
        "q",
      ),
    );

    await processEvent({} as never, ctx);

    expect(ran).toEqual(["missed"]);
  });

  it("stops cleanly on a null branch", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(
      rule(
        [{ id: "q", type: "condition", condition: { field: "channelName", operator: "equals", value: "nope" }, thenNext: "yes", elseNext: null }, action("yes", "matched", null)],
        "q",
      ),
    );

    await processEvent({} as never, ctx);

    expect(ran).toEqual([]);
  });

  it("caps a cyclic graph instead of looping forever", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(
      rule([action("a", "loop", "b"), action("b", "loop", "a")], "a"),
    );

    await processEvent({} as never, ctx);

    // MAX_STEP_ITERATIONS is 20 and every iteration here is an action.
    expect(ran.length).toBe(20);
  });

  it("stops when `next` points at a step that does not exist", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(
      rule([action("a", "only", "ghost")], "a"),
    );

    await expect(processEvent({} as never, ctx)).resolves.not.toThrow();
    expect(ran).toEqual(["only"]);
  });

  it("keeps going after one action fails, and logs the failure", async () => {
    mockExecutor.mockRejectedValueOnce(new Error("boom"));
    mockGetRulesForEvent.mockReturnValueOnce(
      rule([action("a", "bad", "b"), action("b", "good", null)], "a"),
    );

    await processEvent({} as never, ctx);

    expect(ran).toEqual(["good"]);
    expect(mockLogExecution).toHaveBeenCalledWith(
      expect.anything(), "sendMessage", false, "boom",
    );
  });

  it("runs a delay step and continues", async () => {
    vi.useFakeTimers();
    mockGetRulesForEvent.mockReturnValueOnce(
      rule([{ id: "d", type: "delay", delayMs: 1000, next: "a" }, action("a", "after", null)], "d"),
    );

    const done = processEvent({} as never, ctx);
    await vi.advanceTimersByTimeAsync(1000);
    await done;
    vi.useRealTimers();

    expect(ran).toEqual(["after"]);
  });

  it("does not run the graph without an entry step", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([
      { name: "no-entry", enabled: true, conditions: {}, actions: [], steps: [action("a", "x", null)] },
    ]);

    await processEvent({} as never, ctx);

    expect(ran).toEqual([]);
  });

  it("skips the whole graph when the rule's trigger filters do not match", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([
      {
        name: "filtered",
        enabled: true,
        conditions: { channelIds: ["somewhere-else"] },
        actions: [],
        steps: [action("a", "x", null)],
        entryStepId: "a",
      },
    ]);

    await processEvent({} as never, ctx);

    expect(ran).toEqual([]);
  });

  it("logs each condition evaluation with its outcome", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(
      rule(
        [{ id: "q", type: "condition", condition: { field: "channelName", operator: "equals", value: "general" }, thenNext: null, elseNext: null }],
        "q",
      ),
    );

    await processEvent({} as never, ctx);

    expect(mockLogExecution).toHaveBeenCalledWith(
      expect.anything(),
      "condition:channelName",
      true,
      null,
      expect.objectContaining({ result: true }),
    );
  });
});
