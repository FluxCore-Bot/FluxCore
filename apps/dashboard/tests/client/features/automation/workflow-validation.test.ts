import { describe, it, expect } from "vitest";
import { validateWorkflow } from "../../../../src/client/features/automation/lib/workflow-validation";
import type { RuleStep } from "../../../../src/client/shared/lib/schemas";

// validateWorkflow takes the structural TranslateFn, so a plain passthrough
// needs no cast.
const t = (key: string) => key;

const graph: RuleStep[] = [
  { id: "step_0", type: "action", action: { type: "sendMessage", message: "hi" }, next: "step_1" },
  { id: "step_1", type: "condition", condition: { field: "channelId", operator: "equals", value: "9" }, thenNext: "step_2", elseNext: null },
  { id: "step_2", type: "delay", delayMs: 5000, next: null },
];

describe("validateWorkflow — entry-less step graph", () => {
  it("blocks save with a noEntryStep error anchored to the trigger, and does not flood unreachable-step warnings", () => {
    const result = validateWorkflow("messageCreate", [], "Test Rule", undefined, t, graph, undefined);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      nodeId: "trigger",
      level: "error",
      message: "validation.noEntryStep",
    });

    // The reachability BFS is guarded on entryStepId. Without that guard,
    // every step in an entry-less graph gets flagged "unreachable" (the BFS
    // queue would start on a literal `undefined` id and never reach any real
    // step), burying the one error that actually matters under a wall of
    // warning noise.
    expect(result.issues.some((i) => i.message === "validation.stepUnreachable")).toBe(false);
  });

  it("does not report noEntryStep once the graph has an entry point", () => {
    const result = validateWorkflow("messageCreate", [], "Test Rule", undefined, t, graph, "step_0");

    expect(result.issues.some((i) => i.message === "validation.noEntryStep")).toBe(false);
  });
});
