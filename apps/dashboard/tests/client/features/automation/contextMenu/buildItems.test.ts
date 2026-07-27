import { describe, it, expect, vi } from "vitest";
import {
  buildContextMenuItems,
  parseNodeId,
  stepHasConnections,
} from "../../../../../src/client/features/automation/workflow/contextMenu/buildItems";
import type { ContextMenuContext } from "../../../../../src/client/features/automation/workflow/contextMenu/types";
import type { ActionConfig, RuleStep } from "../../../../../src/client/shared/lib/schemas";

function makeHandlers(): ContextMenuContext["handlers"] {
  return {
    onConfigure: vi.fn(),
    onDuplicate: vi.fn(),
    onMove: vi.fn(),
    onSetAsStart: vi.fn(),
    onDisconnect: vi.fn(),
    onDelete: vi.fn(),
    onDeleteEdge: vi.fn(),
    onAddAction: vi.fn(),
    onAddCondition: vi.fn(),
    onAddDelay: vi.fn(),
    onFitView: vi.fn(),
  };
}

function linearCtx(over: Partial<ContextMenuContext> = {}): ContextMenuContext {
  const actions: ActionConfig[] = [{ type: "sendMessage" }, { type: "addRole" }];
  return {
    isStepMode: false,
    actions,
    maxActions: 5,
    steps: undefined,
    entryStepId: undefined,
    handlers: makeHandlers(),
    ...over,
  };
}

const steps: RuleStep[] = [
  { id: "step_0", type: "action", action: { type: "sendMessage" }, next: "step_1" },
  { id: "step_1", type: "condition", condition: { field: "channelId", operator: "equals", value: "1" }, thenNext: null, elseNext: null },
  { id: "step_2", type: "delay", delayMs: 5000, next: null },
];

function stepCtx(over: Partial<ContextMenuContext> = {}): ContextMenuContext {
  return {
    isStepMode: true,
    actions: [],
    maxActions: 5,
    steps,
    entryStepId: "step_0",
    handlers: makeHandlers(),
    ...over,
  };
}

const ids = (sections: ReturnType<typeof buildContextMenuItems>) =>
  sections.flat().map((i) => i.id);
const find = (sections: ReturnType<typeof buildContextMenuItems>, id: string) =>
  sections.flat().find((i) => i.id === id);

describe("parseNodeId", () => {
  it("recognises the trigger, indexed actions, and steps", () => {
    expect(parseNodeId("trigger")).toEqual({ kind: "trigger" });
    expect(parseNodeId("action-3")).toEqual({ kind: "action", index: 3 });
    expect(parseNodeId("step-step_1")).toEqual({ kind: "step", stepId: "step_1" });
  });

  it("returns null for unknown ids", () => {
    expect(parseNodeId("add-action")).toBeNull();
    expect(parseNodeId("action-nope")).toBeNull();
  });
});

describe("stepHasConnections", () => {
  it("is true for the entry step, a step with an outgoing link, and a link target", () => {
    expect(stepHasConnections("step_0", steps, "step_0")).toBe(true);
    expect(stepHasConnections("step_1", steps, "step_0")).toBe(true); // incoming from step_0
  });

  it("is false for a fully floating step", () => {
    expect(stepHasConnections("step_2", steps, "step_0")).toBe(false);
  });
});

describe("buildContextMenuItems — pane", () => {
  const target = { kind: "pane", flowPosition: { x: 10, y: 20 } } as const;

  it("offers the three add verbs and fit-to-view in two sections", () => {
    const sections = buildContextMenuItems(target, linearCtx());
    expect(sections).toHaveLength(2);
    expect(ids(sections)).toEqual(["add-action", "add-condition", "add-delay", "fit-view"]);
  });

  it("passes the flow position to the add handler", () => {
    const ctx = linearCtx();
    const sections = buildContextMenuItems(target, ctx);
    find(sections, "add-action")!.onSelect();
    expect(ctx.handlers.onAddAction).toHaveBeenCalledWith({ x: 10, y: 20 });
  });

  it("disables add-action at the linear action ceiling", () => {
    const ctx = linearCtx({ actions: [{ type: "a" }, { type: "b" }], maxActions: 2 });
    expect(find(buildContextMenuItems(target, ctx), "add-action")!.disabled).toBe(true);
  });

  it("does not apply the ceiling in step mode", () => {
    const ctx = stepCtx({ maxActions: 0 });
    expect(find(buildContextMenuItems(target, ctx), "add-action")!.disabled).toBe(false);
  });
});

describe("buildContextMenuItems — edge", () => {
  it("offers a single destructive delete that names the edge", () => {
    const ctx = stepCtx();
    const sections = buildContextMenuItems({ kind: "edge", edgeId: "e1" }, ctx);
    expect(ids(sections)).toEqual(["delete-edge"]);
    expect(find(sections, "delete-edge")!.danger).toBe(true);
    find(sections, "delete-edge")!.onSelect();
    expect(ctx.handlers.onDeleteEdge).toHaveBeenCalledWith("e1");
  });
});

describe("buildContextMenuItems — trigger node", () => {
  it("offers configure and add-action, and never a delete", () => {
    const sections = buildContextMenuItems({ kind: "node", nodeId: "trigger" }, linearCtx());
    expect(ids(sections)).toEqual(["configure", "add-action"]);
  });

  it("adds without a position, so the new node follows auto-layout", () => {
    const ctx = linearCtx();
    const sections = buildContextMenuItems({ kind: "node", nodeId: "trigger" }, ctx);
    find(sections, "add-action")!.onSelect();
    expect(ctx.handlers.onAddAction).toHaveBeenCalledWith();
  });
});

describe("buildContextMenuItems — linear action node", () => {
  const target = { kind: "node", nodeId: "action-1" } as const;

  it("includes move up/down between duplicate and set-as-start", () => {
    expect(ids(buildContextMenuItems(target, linearCtx()))).toEqual([
      "configure", "duplicate", "move-up", "move-down", "set-as-start", "disconnect", "delete",
    ]);
  });

  it("puts delete alone in the last section and marks it destructive", () => {
    const sections = buildContextMenuItems(target, linearCtx());
    expect(sections).toHaveLength(2);
    expect(ids([sections[1]])).toEqual(["delete"]);
    expect(find(sections, "delete")!.danger).toBe(true);
  });

  it("disables move-up on the first action and move-down on the last", () => {
    const first = buildContextMenuItems({ kind: "node", nodeId: "action-0" }, linearCtx());
    expect(find(first, "move-up")!.disabled).toBe(true);
    expect(find(first, "move-down")!.disabled).toBe(false);
    const last = buildContextMenuItems(target, linearCtx());
    expect(find(last, "move-down")!.disabled).toBe(true);
  });

  it("disables set-as-start on the first action, which is already the entry", () => {
    const first = buildContextMenuItems({ kind: "node", nodeId: "action-0" }, linearCtx());
    expect(find(first, "set-as-start")!.disabled).toBe(true);
  });

  it("disables the graph verbs on an unconfigured action, which has no step to map to", () => {
    const ctx = linearCtx({ actions: [{ type: "sendMessage" }, { type: "" }] });
    const sections = buildContextMenuItems(target, ctx);
    expect(find(sections, "set-as-start")!.disabled).toBe(true);
    expect(find(sections, "disconnect")!.disabled).toBe(true);
  });

  it("disables duplicate at the action ceiling", () => {
    const ctx = linearCtx({ maxActions: 2 });
    expect(find(buildContextMenuItems(target, ctx), "duplicate")!.disabled).toBe(true);
  });

  it("labels delete with the linear remove-action string", () => {
    expect(find(buildContextMenuItems(target, linearCtx()), "delete")!.labelKey)
      .toBe("panel.removeAction");
  });
});

describe("buildContextMenuItems — step nodes", () => {
  it("omits move up/down for a step-mode action node", () => {
    const sections = buildContextMenuItems({ kind: "node", nodeId: "step-step_0" }, stepCtx());
    expect(ids(sections)).toEqual([
      "configure", "duplicate", "set-as-start", "disconnect", "delete",
    ]);
  });

  it("disables set-as-start on the entry step", () => {
    const sections = buildContextMenuItems({ kind: "node", nodeId: "step-step_0" }, stepCtx());
    expect(find(sections, "set-as-start")!.disabled).toBe(true);
  });

  it("disables disconnect on a floating step", () => {
    const sections = buildContextMenuItems({ kind: "node", nodeId: "step-step_2" }, stepCtx());
    expect(find(sections, "disconnect")!.disabled).toBe(true);
  });

  it("labels delete with the step remove string", () => {
    const sections = buildContextMenuItems({ kind: "node", nodeId: "step-step_1" }, stepCtx());
    expect(find(sections, "delete")!.labelKey).toBe("panel.removeStep");
  });

  it("routes every verb to its handler with the node id", () => {
    const ctx = stepCtx();
    const sections = buildContextMenuItems({ kind: "node", nodeId: "step-step_2" }, ctx);
    find(sections, "configure")!.onSelect();
    find(sections, "duplicate")!.onSelect();
    find(sections, "delete")!.onSelect();
    expect(ctx.handlers.onConfigure).toHaveBeenCalledWith("step-step_2");
    expect(ctx.handlers.onDuplicate).toHaveBeenCalledWith("step-step_2");
    expect(ctx.handlers.onDelete).toHaveBeenCalledWith("step-step_2");
  });
});

describe("buildContextMenuItems — unknown node", () => {
  it("returns no sections rather than throwing", () => {
    expect(buildContextMenuItems({ kind: "node", nodeId: "mystery" }, linearCtx())).toEqual([]);
  });
});
