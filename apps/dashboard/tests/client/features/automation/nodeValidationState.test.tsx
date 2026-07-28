// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { ConditionNode } from "../../../../src/client/features/automation/workflow/nodes/ConditionNode";
import { DelayNode } from "../../../../src/client/features/automation/workflow/nodes/DelayNode";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { dir: () => "ltr" } }),
}));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/**
 * Returns the node's card — the element with role="group". Neither
 * `firstElementChild` nor "any element with a border class" works: ReactFlow
 * renders its connection handles as siblings before the card, and they carry
 * their own borders. Querying the wrong element made one of these assertions
 * pass spuriously.
 */
function renderNode(node: React.ReactNode) {
  render(<ReactFlowProvider>{node}</ReactFlowProvider>);
  return screen.getByRole("group");
}

/**
 * validateSteps emits warnings for a condition with no value, a condition with
 * no branches, an unconnected delay and an unreachable step — but only
 * ActionNode and TriggerNode rendered a `warning` border. On the canvas those
 * warnings were invisible, so the toolbar said "3 issues" and nothing on
 * screen said which node.
 */
describe("condition and delay nodes surface their warning state", () => {
  const conditionData = {
    condition: { field: "channelId", operator: "equals", value: "" },
    validationState: "warning" as const,
  };

  it("ConditionNode marks its warning state and announces it", () => {
    const el = renderNode(
      <ConditionNode data={conditionData} selected={false} {...({} as never)} />,
    );
    expect(el).toHaveAttribute("data-validation", "warning");
    expect(screen.getByLabelText("nodes.hasWarning")).toBeInTheDocument();
  });

  it("ConditionNode distinguishes an error from a warning", () => {
    const el = renderNode(
      <ConditionNode
        data={{ ...conditionData, validationState: "error" }}
        selected={false}
        {...({} as never)}
      />,
    );
    expect(el).toHaveAttribute("data-validation", "error");
    expect(screen.getByLabelText("nodes.hasError")).toBeInTheDocument();
  });

  it("DelayNode marks its warning state and announces it", () => {
    const el = renderNode(
      <DelayNode
        data={{ delayMs: 5000, validationState: "warning" }}
        selected={false}
        {...({} as never)}
      />,
    );
    expect(el).toHaveAttribute("data-validation", "warning");
    expect(screen.getByLabelText("nodes.hasWarning")).toBeInTheDocument();
  });

  it("says nothing when there is nothing wrong", () => {
    const el = renderNode(
      <DelayNode data={{ delayMs: 5000, validationState: null }} selected={false} {...({} as never)} />,
    );
    expect(el).not.toHaveAttribute("data-validation");
    expect(screen.queryByLabelText("nodes.hasWarning")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("nodes.hasError")).not.toBeInTheDocument();
  });
});
