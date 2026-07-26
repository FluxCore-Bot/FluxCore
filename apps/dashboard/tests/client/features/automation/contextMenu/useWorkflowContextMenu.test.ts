// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ReactFlowProvider, type Node } from "@xyflow/react";
import { useWorkflowContextMenu } from "../../../../../src/client/features/automation/workflow/contextMenu/useWorkflowContextMenu";

/**
 * The node's `data.label` ("Send message") deliberately differs from the
 * composed ARIA text rendered on the node element ("Action 1: Send message")
 * so the two sources can never be mistaken for one another in the assertion
 * below.
 */
const seedNodes: Node[] = [
  {
    id: "action-0",
    type: "action",
    position: { x: 0, y: 0 },
    data: { label: "Send message" },
  },
];

function wrapper({ children }: { children: ReactNode }) {
  return createElement(ReactFlowProvider, { initialNodes: seedNodes }, children);
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("useWorkflowContextMenu openFromKeyboard", () => {
  it("resolves the label from the flow store, not the focused node's composed aria-label", () => {
    const nodeEl = document.createElement("div");
    nodeEl.className = "react-flow__node";
    nodeEl.dataset.id = "action-0";
    nodeEl.tabIndex = 0;

    const group = document.createElement("div");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Action 1: Send message");
    nodeEl.appendChild(group);
    document.body.appendChild(nodeEl);
    nodeEl.focus();
    expect(document.activeElement).toBe(nodeEl);

    const { result } = renderHook(() => useWorkflowContextMenu(), { wrapper });

    act(() => {
      result.current.openFromKeyboard();
    });

    expect(result.current.menu?.label).toBe("Send message");
    expect(result.current.menu?.label).not.toBe("Action 1: Send message");
  });
});
