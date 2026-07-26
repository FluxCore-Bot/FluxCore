import type { RuleStep } from "../../../../shared/lib/schemas";
import type { ContextMenuContext, ContextMenuSection, ContextMenuTarget } from "./types";

export type ParsedNodeId =
  | { kind: "trigger" }
  | { kind: "action"; index: number }
  | { kind: "step"; stepId: string };

/** Map a React Flow node id back onto the data model it came from. */
export function parseNodeId(nodeId: string): ParsedNodeId | null {
  if (nodeId === "trigger") return { kind: "trigger" };
  if (nodeId.startsWith("step-")) {
    const stepId = nodeId.slice("step-".length);
    return stepId ? { kind: "step", stepId } : null;
  }
  if (nodeId.startsWith("action-")) {
    const index = Number.parseInt(nodeId.slice("action-".length), 10);
    return Number.isNaN(index) ? null : { kind: "action", index };
  }
  return null;
}

/** True when the step is the entry, points at something, or is pointed at. */
export function stepHasConnections(
  stepId: string,
  steps: RuleStep[] | undefined,
  entryStepId: string | undefined,
): boolean {
  if (entryStepId === stepId) return true;
  const list = steps ?? [];
  const self = list.find((s) => s.id === stepId);
  if (self) {
    if (self.type === "condition" && (self.thenNext || self.elseNext)) return true;
    if ((self.type === "action" || self.type === "delay") && self.next) return true;
  }
  return list.some((s) =>
    s.type === "condition"
      ? s.thenNext === stepId || s.elseNext === stepId
      : s.next === stepId,
  );
}

export function buildContextMenuItems(
  target: ContextMenuTarget,
  ctx: ContextMenuContext,
): ContextMenuSection[] {
  const h = ctx.handlers;

  if (target.kind === "pane") {
    const position = target.flowPosition;
    const atCeiling = !ctx.isStepMode && ctx.actions.length >= ctx.maxActions;
    return [
      [
        {
          id: "add-action",
          labelKey: "contextMenu.addActionHere",
          icon: "add",
          disabled: atCeiling,
          onSelect: () => h.onAddAction(position),
        },
        {
          id: "add-condition",
          labelKey: "contextMenu.addConditionHere",
          icon: "call_split",
          onSelect: () => h.onAddCondition(position),
        },
        {
          id: "add-delay",
          labelKey: "contextMenu.addDelayHere",
          icon: "schedule",
          onSelect: () => h.onAddDelay(position),
        },
      ],
      [
        {
          id: "fit-view",
          labelKey: "editor.fitToView",
          icon: "fit_screen",
          shortcut: "Ctrl+Shift+F",
          onSelect: () => h.onFitView(),
        },
      ],
    ];
  }

  if (target.kind === "edge") {
    return [
      [
        {
          id: "delete-edge",
          labelKey: "contextMenu.deleteConnection",
          icon: "delete",
          danger: true,
          onSelect: () => h.onDeleteEdge(target.edgeId),
        },
      ],
    ];
  }

  const parsed = parseNodeId(target.nodeId);
  if (!parsed) return [];
  const nodeId = target.nodeId;

  if (parsed.kind === "trigger") {
    return [
      [
        {
          id: "configure",
          labelKey: "contextMenu.configureTrigger",
          icon: "tune",
          onSelect: () => h.onConfigure(nodeId),
        },
        {
          id: "add-action",
          labelKey: "contextMenu.addAction",
          icon: "add",
          disabled: !ctx.isStepMode && ctx.actions.length >= ctx.maxActions,
          // No position: an add from the trigger menu appends via auto-layout.
          onSelect: () => h.onAddAction(),
        },
      ],
    ];
  }

  const isLinear = parsed.kind === "action";
  // A linear action only maps onto a step once it has a type — convertToStepMode
  // drops unconfigured actions, so the graph verbs have nothing to point at.
  const linearConfigured = isLinear && !!ctx.actions[parsed.index]?.type;
  const atCeiling = !ctx.isStepMode && ctx.actions.length >= ctx.maxActions;

  const main: ContextMenuSection = [
    {
      id: "configure",
      labelKey: "contextMenu.configure",
      icon: "tune",
      onSelect: () => h.onConfigure(nodeId),
    },
    {
      id: "duplicate",
      labelKey: "ruleList.duplicate",
      icon: "content_copy",
      disabled: atCeiling,
      onSelect: () => h.onDuplicate(nodeId),
    },
  ];

  if (isLinear) {
    main.push(
      {
        id: "move-up",
        labelKey: "panel.moveUp",
        icon: "arrow_upward",
        shortcut: "Ctrl+↑",
        disabled: parsed.index === 0,
        onSelect: () => h.onMove(nodeId, "up"),
      },
      {
        id: "move-down",
        labelKey: "panel.moveDown",
        icon: "arrow_downward",
        shortcut: "Ctrl+↓",
        disabled: parsed.index >= ctx.actions.length - 1,
        onSelect: () => h.onMove(nodeId, "down"),
      },
    );
  }

  const isEntry = isLinear
    ? parsed.index === 0
    : ctx.entryStepId === parsed.stepId;
  const hasConnections = isLinear
    ? true // the linear chain always wires trigger → action-0 → …
    : stepHasConnections(parsed.stepId, ctx.steps, ctx.entryStepId);

  main.push(
    {
      id: "set-as-start",
      labelKey: "contextMenu.setAsStart",
      icon: "play_arrow",
      disabled: isEntry || (isLinear && !linearConfigured),
      onSelect: () => h.onSetAsStart(nodeId),
    },
    {
      id: "disconnect",
      labelKey: "contextMenu.disconnect",
      icon: "link_off",
      disabled: !hasConnections || (isLinear && !linearConfigured),
      onSelect: () => h.onDisconnect(nodeId),
    },
  );

  return [
    main,
    [
      {
        id: "delete",
        labelKey: isLinear ? "panel.removeAction" : "panel.removeStep",
        icon: "delete",
        shortcut: "Del",
        danger: true,
        onSelect: () => h.onDelete(nodeId),
      },
    ],
  ];
}
