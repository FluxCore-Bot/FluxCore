import { useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { ActionConfig, Constants, RuleStep } from "../../lib/schemas";
import type { ValidationIssue } from "../../lib/workflow-validation";
import { getNodeValidationState } from "../../lib/workflow-validation";
import type { ConditionNodeData } from "./nodes/ConditionNode";
import type { DelayNodeData } from "./nodes/DelayNode";

interface WorkflowNodesInput {
  eventType: string;
  actions: ActionConfig[];
  steps?: RuleStep[];
  entryStepId?: string;
  constants?: Constants;
  maxActions?: number;
  selectedNodeId?: string | null;
  onAddAction?: () => void;
  validationIssues?: ValidationIssue[];
}

export interface TriggerNodeData {
  eventType: string;
  label: string;
  description: string;
  validationState?: "valid" | "warning" | "error" | null;
  [key: string]: unknown;
}

export interface ActionNodeData {
  index: number;
  action: ActionConfig;
  label: string;
  validationState?: "valid" | "warning" | "error" | null;
  [key: string]: unknown;
}

export interface AddActionNodeData {
  onAdd?: () => void;
  [key: string]: unknown;
}

const TRIGGER_X = 80;
const ACTION_X = 420;
const BRANCH_X = 700;
const NODE_Y_START = 60;
const NODE_Y_GAP = 130;
const EDGE_INTERACTION_WIDTH = 20; // wider click area for selecting edges

/**
 * Build nodes/edges from a flat linear actions array (v1 legacy).
 */
function buildLinearNodes(
  input: WorkflowNodesInput,
  triggerNode: Node<TriggerNodeData>,
): { nodes: Node[]; edges: Edge[] } {
  const { actions, constants, maxActions = 5, selectedNodeId, onAddAction, validationIssues = [] } = input;

  const actionNodes: Node<ActionNodeData>[] = actions.map((action, i) => {
    const nodeId = `action-${i}`;
    const actionLabel =
      constants?.actionTypes[action.type]?.label ?? (action.type || "Select Action");
    return {
      id: nodeId,
      type: "actionNode",
      position: { x: ACTION_X, y: NODE_Y_START + i * NODE_Y_GAP },
      data: {
        index: i,
        action,
        label: actionLabel,
        validationState: getNodeValidationState(nodeId, validationIssues),
      },
      draggable: true,
      selected: selectedNodeId === nodeId,
    };
  });

  const allNodes: Node[] = [triggerNode, ...actionNodes];
  const allEdges: Edge[] = [];

  if (actions.length > 0) {
    allEdges.push({
      id: "trigger-to-action-0",
      source: "trigger",
      target: "action-0",
      type: "smoothstep",
      animated: true,
      deletable: true,
      focusable: true,
      interactionWidth: EDGE_INTERACTION_WIDTH,
      style: { stroke: "rgba(163, 166, 255, 0.5)", strokeWidth: 2 },
    });
  }

  for (let i = 0; i < actions.length - 1; i++) {
    allEdges.push({
      id: `action-${i}-to-action-${i + 1}`,
      source: `action-${i}`,
      target: `action-${i + 1}`,
      type: "smoothstep",
      animated: true,
      deletable: true,
      focusable: true,
      interactionWidth: EDGE_INTERACTION_WIDTH,
      style: { stroke: "rgba(163, 166, 255, 0.3)", strokeWidth: 2 },
    });
  }

  return { nodes: allNodes, edges: allEdges };
}

/**
 * Build nodes/edges from a steps graph (v2).
 */
function buildStepNodes(
  input: WorkflowNodesInput,
  triggerNode: Node<TriggerNodeData>,
): { nodes: Node[]; edges: Edge[] } {
  const { steps = [], entryStepId, constants, selectedNodeId, validationIssues = [] } = input;

  const allNodes: Node[] = [triggerNode];
  const allEdges: Edge[] = [];

  // Layout: BFS from entryStepId to assign positions
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();

  // Simple column-based layout
  let actionIndex = 0;
  const queue: Array<{ id: string; col: number; row: number }> = [];
  if (entryStepId) {
    queue.push({ id: entryStepId, col: 0, row: 0 });
  }

  const colRowCounters = new Map<number, number>(); // track row usage per column

  while (queue.length > 0) {
    const { id, col, row } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const step = stepMap.get(id);
    if (!step) continue;

    const currentRow = colRowCounters.get(col) ?? row;
    colRowCounters.set(col, currentRow + 1);

    const x = ACTION_X + col * 280;
    const y = NODE_Y_START + currentRow * NODE_Y_GAP;
    positions.set(id, { x, y });

    if (step.type === "action") {
      const nodeId = `step-${step.id}`;
      const label = constants?.actionTypes[step.action.type]?.label ?? (step.action.type || "Select Action");
      allNodes.push({
        id: nodeId,
        type: "actionNode",
        position: { x, y },
        data: {
          index: actionIndex++,
          action: step.action,
          label,
          stepId: step.id,
          validationState: getNodeValidationState(nodeId, validationIssues),
        },
        draggable: true,
        selected: selectedNodeId === nodeId,
      });
      if (step.next) queue.push({ id: step.next, col, row: currentRow + 1 });
    } else if (step.type === "condition") {
      const nodeId = `step-${step.id}`;
      const condData: ConditionNodeData = {
        index: actionIndex++,
        field: step.condition.field,
        operator: step.condition.operator,
        value: step.condition.value,
        label: step.condition.field
          ? `If ${step.condition.field}`
          : "Configure condition",
        validationState: getNodeValidationState(nodeId, validationIssues),
      };
      allNodes.push({
        id: nodeId,
        type: "conditionNode",
        position: { x, y },
        data: condData,
        draggable: true,
        selected: selectedNodeId === nodeId,
      });
      // Then branch goes forward same column
      if (step.thenNext) queue.push({ id: step.thenNext, col, row: currentRow + 1 });
      // Else branch goes to a new column
      if (step.elseNext) queue.push({ id: step.elseNext, col: col + 1, row: currentRow });
    } else if (step.type === "delay") {
      const nodeId = `step-${step.id}`;
      const delayData: DelayNodeData = {
        index: actionIndex++,
        delayMs: step.delayMs,
        label: "Delay",
        validationState: getNodeValidationState(nodeId, validationIssues),
      };
      allNodes.push({
        id: nodeId,
        type: "delayNode",
        position: { x, y },
        data: delayData,
        draggable: true,
        selected: selectedNodeId === nodeId,
      });
      if (step.next) queue.push({ id: step.next, col, row: currentRow + 1 });
    }
  }

  // Place disconnected (unvisited) steps below the main graph
  const maxCol = Math.max(0, ...Array.from(colRowCounters.keys()));
  let floatingRow = Math.max(0, ...Array.from(colRowCounters.values())) + 1;
  for (const step of steps) {
    if (visited.has(step.id)) continue;
    visited.add(step.id);

    const x = ACTION_X + (maxCol + 1) * 280;
    const y = NODE_Y_START + floatingRow * NODE_Y_GAP;
    floatingRow++;

    const nodeId = `step-${step.id}`;

    if (step.type === "action") {
      const label = constants?.actionTypes[step.action.type]?.label ?? (step.action.type || "Select Action");
      allNodes.push({
        id: nodeId,
        type: "actionNode",
        position: { x, y },
        data: {
          index: actionIndex++,
          action: step.action,
          label,
          stepId: step.id,
          validationState: getNodeValidationState(nodeId, validationIssues),
        },
        draggable: true,
        selected: selectedNodeId === nodeId,
      });
    } else if (step.type === "condition") {
      const condData: ConditionNodeData = {
        index: actionIndex++,
        field: step.condition.field,
        operator: step.condition.operator,
        value: step.condition.value,
        label: step.condition.field
          ? `If ${step.condition.field}`
          : "Configure condition",
        validationState: getNodeValidationState(nodeId, validationIssues),
      };
      allNodes.push({
        id: nodeId,
        type: "conditionNode",
        position: { x, y },
        data: condData,
        draggable: true,
        selected: selectedNodeId === nodeId,
      });
    } else if (step.type === "delay") {
      const delayData: DelayNodeData = {
        index: actionIndex++,
        delayMs: step.delayMs,
        label: "Delay",
        validationState: getNodeValidationState(nodeId, validationIssues),
      };
      allNodes.push({
        id: nodeId,
        type: "delayNode",
        position: { x, y },
        data: delayData,
        draggable: true,
        selected: selectedNodeId === nodeId,
      });
    }
  }

  // Edge from trigger to first step
  if (entryStepId && stepMap.has(entryStepId)) {
    allEdges.push({
      id: "trigger-to-entry",
      source: "trigger",
      target: `step-${entryStepId}`,
      type: "smoothstep",
      animated: true,
      deletable: true,
      focusable: true,
      interactionWidth: EDGE_INTERACTION_WIDTH,
      style: { stroke: "rgba(163, 166, 255, 0.5)", strokeWidth: 2 },
    });
  }

  // Edges between steps
  for (const step of steps) {
    if (!visited.has(step.id)) continue;
    const sourceId = `step-${step.id}`;

    if (step.type === "action" || step.type === "delay") {
      if (step.next && visited.has(step.next)) {
        allEdges.push({
          id: `${sourceId}-to-step-${step.next}`,
          source: sourceId,
          target: `step-${step.next}`,
          type: "smoothstep",
          animated: true,
          deletable: true,
          focusable: true,
          interactionWidth: EDGE_INTERACTION_WIDTH,
          style: { stroke: "rgba(163, 166, 255, 0.3)", strokeWidth: 2 },
        });
      }
    } else if (step.type === "condition") {
      if (step.thenNext && visited.has(step.thenNext)) {
        allEdges.push({
          id: `${sourceId}-then-to-step-${step.thenNext}`,
          source: sourceId,
          sourceHandle: "then",
          target: `step-${step.thenNext}`,
          type: "smoothstep",
          animated: true,
          deletable: true,
          focusable: true,
          interactionWidth: EDGE_INTERACTION_WIDTH,
          label: "Yes",
          labelStyle: { fontSize: 10, fontWeight: 600, fill: "rgba(172,138,255,0.8)" },
          style: { stroke: "rgba(172, 138, 255, 0.4)", strokeWidth: 2 },
        });
      }
      if (step.elseNext && visited.has(step.elseNext)) {
        allEdges.push({
          id: `${sourceId}-else-to-step-${step.elseNext}`,
          source: sourceId,
          sourceHandle: "else",
          target: `step-${step.elseNext}`,
          type: "smoothstep",
          animated: true,
          deletable: true,
          focusable: true,
          interactionWidth: EDGE_INTERACTION_WIDTH,
          label: "No",
          labelStyle: { fontSize: 10, fontWeight: 600, fill: "rgba(255,100,100,0.8)" },
          style: { stroke: "rgba(255, 100, 100, 0.3)", strokeWidth: 2 },
        });
      }
    }
  }

  // Center trigger vertically
  if (allNodes.length > 1) {
    const stepNodes = allNodes.slice(1);
    const minY = Math.min(...stepNodes.map((n) => n.position.y));
    const maxY = Math.max(...stepNodes.map((n) => n.position.y));
    triggerNode.position.y = (minY + maxY) / 2;
  }

  return { nodes: allNodes, edges: allEdges };
}

export function useWorkflowNodes(input: WorkflowNodesInput) {
  const { nodes, edges } = useMemo(() => {
    const {
      eventType,
      steps,
      entryStepId,
      constants,
      selectedNodeId,
      validationIssues = [],
    } = input;

    const triggerLabel =
      constants?.eventTypes[eventType]?.label ?? (eventType || "Select Trigger");
    const triggerDescription =
      constants?.eventTypes[eventType]?.description ?? "";

    const triggerNode: Node<TriggerNodeData> = {
      id: "trigger",
      type: "triggerNode",
      position: { x: TRIGGER_X, y: NODE_Y_START },
      data: {
        eventType,
        label: triggerLabel,
        description: triggerDescription,
        validationState: getNodeValidationState("trigger", validationIssues),
      },
      draggable: true,
      selected: selectedNodeId === "trigger",
    };

    // V2: step-based graph
    if (steps?.length && entryStepId) {
      return buildStepNodes(input, triggerNode);
    }

    // V1: linear actions
    // Center trigger vertically for linear layout
    const totalActionNodes = input.actions.length;
    triggerNode.position.y =
      NODE_Y_START + ((totalActionNodes - 1) * NODE_Y_GAP) / 2;

    return buildLinearNodes(input, triggerNode);
  }, [
    input.eventType,
    input.actions,
    input.steps,
    input.entryStepId,
    input.constants,
    input.maxActions,
    input.selectedNodeId,
    input.onAddAction,
    input.validationIssues,
  ]);

  return { nodes, edges };
}
