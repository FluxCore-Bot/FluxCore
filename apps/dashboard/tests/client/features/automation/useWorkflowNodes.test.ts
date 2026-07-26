// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type { TFunction } from "i18next";
import { useWorkflowNodes } from "../../../../src/client/features/automation/workflow/useWorkflowNodes";
import type { ActionConfig, RuleStep } from "../../../../src/client/shared/lib/schemas";

const t = ((key: string) => key) as unknown as TFunction;

const graph: RuleStep[] = [
  { id: "step_0", type: "action", action: { type: "sendMessage", message: "hi" }, next: "step_1" },
  { id: "step_1", type: "condition", condition: { field: "channelId", operator: "equals", value: "9" }, thenNext: "step_2", elseNext: null },
  { id: "step_2", type: "delay", delayMs: 5000, next: null },
];

// A stale legacy `actions` array left over from before the rule was ever
// converted to step mode. If the hook wrongly falls back to linear rendering,
// this is what would show up on the canvas instead of the step graph.
const staleActions: ActionConfig[] = [{ type: "" }];

describe("useWorkflowNodes — entry-less step graph", () => {
  it("renders the step graph (and the edges between steps) even when entryStepId is undefined", () => {
    const { result } = renderHook(() =>
      useWorkflowNodes({
        eventType: "messageCreate",
        actions: staleActions,
        steps: graph,
        entryStepId: undefined,
        t,
      }),
    );

    const { nodes, edges } = result.current;
    const nodeIds = nodes.map((n) => n.id);

    // Every step is rendered as a step node — none of it silently fell back
    // to the stale linear `actions` array.
    expect(nodeIds).toEqual(expect.arrayContaining(["step-step_0", "step-step_1", "step-step_2"]));
    expect(nodeIds.some((id) => id.startsWith("action-"))).toBe(false);

    // The edges between steps still render, since buildStepNodes places every
    // entry-less step in the "disconnected" layout pass and marks it visited,
    // so links between those steps are still drawn.
    const edgeIds = edges.map((e) => e.id);
    expect(edgeIds).toContain("step-step_0-to-step-step_1");
    expect(edgeIds).toContain("step-step_1-then-to-step-step_2");

    // No entry point means no trigger → entry edge.
    expect(edgeIds).not.toContain("trigger-to-entry");
  });
});
