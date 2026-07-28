// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWorkflowSteps } from "../../../../src/client/features/automation/workflow/useWorkflowSteps";
import type { ActionConfig, RuleStep } from "../../../../src/client/shared/lib/schemas";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// The hook's option is structurally Pick<Constants, "maxActionsPerRule">, so
// the one field it reads is all the test has to provide — no cast.
const constants = { maxActionsPerRule: 5 };

function setup(over: {
  initialActions?: ActionConfig[];
  initialSteps?: RuleStep[];
  initialEntryStepId?: string;
} = {}) {
  return renderHook(() =>
    useWorkflowSteps({
      initialActions: over.initialActions ?? [{ type: "sendMessage" }],
      initialSteps: over.initialSteps,
      initialEntryStepId: over.initialEntryStepId,
      constants,
    }),
  );
}

const graph: RuleStep[] = [
  { id: "step_0", type: "action", action: { type: "sendMessage", message: "hi" }, next: "step_1" },
  { id: "step_1", type: "condition", condition: { field: "channelId", operator: "equals", value: "9" }, thenNext: "step_2", elseNext: null },
  { id: "step_2", type: "delay", delayMs: 5000, next: null },
];

describe("add helpers return the new node id", () => {
  it("returns the linear action id", () => {
    const { result } = setup();
    let id: string | null = null;
    act(() => { id = result.current.addAction(); });
    expect(id).toBe("action-1");
    expect(result.current.actions).toHaveLength(2);
  });

  it("returns null when the linear ceiling is reached", () => {
    const { result } = setup({ initialActions: Array.from({ length: 5 }, () => ({ type: "sendMessage" })) });
    let id: string | null = "unset";
    act(() => { id = result.current.addAction(); });
    expect(id).toBeNull();
  });

  it("returns the step id in step mode", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    let id: string | null = null;
    act(() => { id = result.current.addDelayStep(); });
    expect(id).toBe("step-step_3");
  });
});

describe("duplicateNode", () => {
  it("inserts a copy right after the original in linear mode", () => {
    const { result } = setup({ initialActions: [{ type: "sendMessage" }, { type: "addRole" }] });
    let id: string | null = null;
    act(() => { id = result.current.duplicateNode("action-0"); });
    expect(id).toBe("action-1");
    expect(result.current.actions.map((a) => a.type)).toEqual([
      "sendMessage", "sendMessage", "addRole",
    ]);
  });

  it("refuses to duplicate past the linear ceiling", () => {
    const { result } = setup({ initialActions: Array.from({ length: 5 }, () => ({ type: "sendMessage" })) });
    let id: string | null = "unset";
    act(() => { id = result.current.duplicateNode("action-0"); });
    expect(id).toBeNull();
    expect(result.current.actions).toHaveLength(5);
  });

  it("clones a step with a fresh id and no outgoing links", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    let id: string | null = null;
    act(() => { id = result.current.duplicateNode("step-step_0"); });
    expect(id).toBe("step-step_3");
    const copy = result.current.steps!.find((s) => s.id === "step_3")!;
    expect(copy).toMatchObject({ type: "action", next: null });
    expect(copy.type === "action" ? copy.action.message : null).toBe("hi");
  });

  it("clears both branches when cloning a condition", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    act(() => { result.current.duplicateNode("step-step_1"); });
    const copy = result.current.steps!.find((s) => s.id === "step_3");
    expect(copy).toMatchObject({ type: "condition", thenNext: null, elseNext: null });
  });

  it("does not make the copy the entry step", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    act(() => { result.current.duplicateNode("step-step_0"); });
    expect(result.current.entryStepId).toBe("step_0");
  });

  it("deep-copies so editing the copy leaves the original alone", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    act(() => { result.current.duplicateNode("step-step_0"); });
    const copy = result.current.steps!.find((s) => s.id === "step_3")!;
    // Discriminant check instead of a cast: narrows `copy` for the spread
    // below, and fails loudly if the clone ever changes shape.
    if (copy.type !== "action") throw new Error(`expected an action step, got "${copy.type}"`);
    act(() => {
      result.current.handleStepChange("step_3", {
        ...copy,
        action: { type: "sendMessage", message: "changed" },
      });
    });
    const original = result.current.steps!.find((s) => s.id === "step_0")!;
    expect(original.type === "action" && original.action.message).toBe("hi");
  });
});

describe("disconnectNode", () => {
  it("clears outgoing and incoming links but keeps the step", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    act(() => { result.current.disconnectNode("step-step_1"); });
    const s0 = result.current.steps!.find((s) => s.id === "step_0")!;
    const s1 = result.current.steps!.find((s) => s.id === "step_1")!;
    expect(s0.type === "action" && s0.next).toBeNull();
    expect(s1.type === "condition" && s1.thenNext).toBeNull();
    expect(result.current.steps).toHaveLength(3);
  });

  it("clears the entry when the entry step is disconnected", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    act(() => { result.current.disconnectNode("step-step_0"); });
    expect(result.current.entryStepId).toBeUndefined();
  });

  it("converts a linear rule to a step graph first", () => {
    const { result } = setup({ initialActions: [{ type: "sendMessage" }, { type: "addRole" }] });
    act(() => { result.current.disconnectNode("action-1"); });
    expect(result.current.isStepMode).toBe(true);
    const s0 = result.current.steps!.find((s) => s.id === "step_0")!;
    expect(s0.type === "action" && s0.next).toBeNull();
  });
});

describe("setAsStart", () => {
  it("re-points the entry in step mode", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    act(() => { result.current.setAsStart("step-step_2"); });
    expect(result.current.entryStepId).toBe("step_2");
  });

  it("converts a linear rule and points the entry at the chosen action", () => {
    const { result } = setup({ initialActions: [{ type: "sendMessage" }, { type: "addRole" }] });
    act(() => { result.current.setAsStart("action-1"); });
    expect(result.current.isStepMode).toBe(true);
    expect(result.current.entryStepId).toBe("step_1");
  });

  it("ignores an unconfigured linear action, which has no step", () => {
    const { result } = setup({ initialActions: [{ type: "sendMessage" }, { type: "" }] });
    act(() => { result.current.setAsStart("action-1"); });
    expect(result.current.entryStepId).toBeUndefined();
  });
});

describe("snapshot and restore", () => {
  it("restores steps, entry, and the neighbour rewiring a removal performed", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    const snap = result.current.snapshot();
    act(() => { result.current.handleStepRemove("step_1"); });
    expect(result.current.steps).toHaveLength(2);
    act(() => { result.current.restore(snap); });
    expect(result.current.steps).toHaveLength(3);
    const s0 = result.current.steps!.find((s) => s.id === "step_0")!;
    expect(s0.type === "action" && s0.next).toBe("step_1");
    expect(result.current.entryStepId).toBe("step_0");
  });

  it("restores a linear action that was reset to empty", () => {
    const { result } = setup({ initialActions: [{ type: "sendMessage", message: "hi" }] });
    const snap = result.current.snapshot();
    act(() => { result.current.handleActionChange(0, { type: "" }); });
    expect(result.current.actions[0].type).toBe("");
    act(() => { result.current.restore(snap); });
    expect(result.current.actions[0]).toMatchObject({ type: "sendMessage", message: "hi" });
  });
});

/**
 * React Flow delivers one `remove` change per node in a multi-select Delete,
 * and WorkflowEditor applied each by index in a loop. Every removal splices
 * the array, so from the second one onward the index referred to a different
 * action — deleting nodes 0 and 2 removed actions 0 and 3. Removing the whole
 * set in one pass is the only way indices stay meaningful.
 */
describe("useWorkflowSteps — removing several actions at once", () => {
  const four: ActionConfig[] = [
    { type: "sendMessage", message: "zero" },
    { type: "sendMessage", message: "one" },
    { type: "sendMessage", message: "two" },
    { type: "sendMessage", message: "three" },
  ];

  it("removes exactly the given indices, not their post-splice neighbours", () => {
    const { result } = setup({ initialActions: four });

    act(() => { result.current.handleActionsRemove([0, 2]); });

    expect(result.current.actions.map((a) => a.message)).toEqual(["one", "three"]);
  });

  it("is order-independent", () => {
    const { result } = setup({ initialActions: four });

    act(() => { result.current.handleActionsRemove([2, 0]); });

    expect(result.current.actions.map((a) => a.message)).toEqual(["one", "three"]);
  });

  it("ignores indices that do not exist", () => {
    const { result } = setup({ initialActions: four });

    act(() => { result.current.handleActionsRemove([1, 99]); });

    expect(result.current.actions.map((a) => a.message)).toEqual(["zero", "two", "three"]);
  });

  it("never empties the list — the last surviving action is reset instead", () => {
    const { result } = setup({ initialActions: four });

    act(() => { result.current.handleActionsRemove([0, 1, 2, 3]); });

    expect(result.current.actions).toHaveLength(1);
    expect(result.current.actions[0]).toEqual({ type: "" });
  });
});
