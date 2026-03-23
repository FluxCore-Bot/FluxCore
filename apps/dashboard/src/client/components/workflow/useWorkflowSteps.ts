import { useState, useCallback, useRef, useEffect } from "react";
import type { Connection } from "@xyflow/react";
import { toast } from "sonner";
import type { ActionConfig, RuleStep, Constants } from "../../lib/schemas";

const emptyAction: ActionConfig = { type: "" };

export interface UseWorkflowStepsOptions {
  initialSteps?: RuleStep[];
  initialEntryStepId?: string;
  initialActions: ActionConfig[];
  constants: Constants | undefined;
}

export function useWorkflowSteps({
  initialSteps,
  initialEntryStepId,
  initialActions,
  constants,
}: UseWorkflowStepsOptions) {
  const [actions, setActions] = useState<ActionConfig[]>(initialActions);
  const [steps, setSteps] = useState<RuleStep[] | undefined>(initialSteps);
  const [entryStepId, setEntryStepId] = useState<string | undefined>(initialEntryStepId);
  const pendingConnectionRef = useRef<Connection | null>(null);

  const isStepMode = !!(steps?.length && entryStepId);

  const nextStepId = useCallback(() => {
    const existing = steps ?? [];
    let idx = existing.length;
    while (existing.some((s) => s.id === `step_${idx}`)) idx++;
    return `step_${idx}`;
  }, [steps]);

  const convertToStepMode = useCallback((): { converted: RuleStep[]; entry: string; nextIdx: number } => {
    const actionSteps: RuleStep[] = actions
      .filter((a) => a.type)
      .map((a, i, arr) => ({
        id: `step_${i}`,
        type: "action" as const,
        action: a,
        next: i < arr.length - 1 ? `step_${i + 1}` : null,
      }));
    return {
      converted: actionSteps,
      entry: actionSteps.length > 0 ? "step_0" : "",
      nextIdx: actionSteps.length,
    };
  }, [actions]);

  /** Convert V1 to step mode, severing specific edges by their React Flow IDs. */
  const convertAndSeverEdges = useCallback((removedEdgeIds: Set<string>) => {
    const { converted, entry } = convertToStepMode();
    const severed = converted.map((step, i) => {
      if (step.type !== "action" || !step.next) return step;
      const edgeId = `action-${i}-to-action-${i + 1}`;
      if (removedEdgeIds.has(edgeId)) {
        return { ...step, next: null };
      }
      return step;
    });
    const triggerSevered = removedEdgeIds.has("trigger-to-action-0");
    setSteps(severed);
    setEntryStepId(triggerSevered ? undefined : (entry || undefined));
  }, [convertToStepMode]);

  const addAction = useCallback(() => {
    if (!constants) return;
    if (isStepMode) {
      const newId = nextStepId();
      setSteps((prev) => [
        ...(prev ?? []),
        { id: newId, type: "action" as const, action: { ...emptyAction }, next: null },
      ]);
      if (!entryStepId) setEntryStepId(newId);
    } else if (actions.length < constants.maxActionsPerRule) {
      setActions((prev) => [...prev, { ...emptyAction }]);
    }
  }, [constants, actions.length, isStepMode, nextStepId, entryStepId]);

  const addConditionStep = useCallback(() => {
    if (!isStepMode) {
      const { converted, entry, nextIdx } = convertToStepMode();
      const condId = `step_${nextIdx}`;
      const condStep: RuleStep = {
        id: condId,
        type: "condition",
        condition: { field: "channelId", operator: "equals", value: "" },
        thenNext: null,
        elseNext: null,
      };
      setSteps([...converted, condStep]);
      setEntryStepId(entry || condId);
    } else {
      const newId = nextStepId();
      const condStep: RuleStep = {
        id: newId,
        type: "condition",
        condition: { field: "channelId", operator: "equals", value: "" },
        thenNext: null,
        elseNext: null,
      };
      setSteps((prev) => [...(prev ?? []), condStep]);
      if (!entryStepId) setEntryStepId(newId);
    }
  }, [isStepMode, convertToStepMode, nextStepId, entryStepId]);

  const addDelayStep = useCallback(() => {
    if (!isStepMode) {
      const { converted, entry, nextIdx } = convertToStepMode();
      const delayId = `step_${nextIdx}`;
      const delayStep: RuleStep = {
        id: delayId,
        type: "delay",
        delayMs: 5000,
        next: null,
      };
      setSteps([...converted, delayStep]);
      setEntryStepId(entry || delayId);
    } else {
      const newId = nextStepId();
      const newStep: RuleStep = {
        id: newId,
        type: "delay",
        delayMs: 5000,
        next: null,
      };
      setSteps((prev) => [...(prev ?? []), newStep]);
      if (!entryStepId) setEntryStepId(newId);
    }
  }, [isStepMode, convertToStepMode, nextStepId, entryStepId]);

  const handleStepChange = useCallback((stepId: string, updatedStep: RuleStep) => {
    setSteps((prev) => (prev ?? []).map((s) => (s.id === stepId ? updatedStep : s)));
  }, []);

  const handleStepRemove = useCallback((stepId: string) => {
    setSteps((prev) => {
      if (!prev) return prev;
      const step = prev.find((s) => s.id === stepId);
      if (!step) return prev;
      const nextId = step.type === "condition" ? step.thenNext : step.next;
      return prev
        .filter((s) => s.id !== stepId)
        .map((s) => {
          if (s.type === "action" || s.type === "delay") {
            return s.next === stepId ? { ...s, next: nextId } : s;
          }
          if (s.type === "condition") {
            return {
              ...s,
              thenNext: s.thenNext === stepId ? nextId : s.thenNext,
              elseNext: s.elseNext === stepId ? (step.type === "condition" ? step.elseNext : nextId) : s.elseNext,
            };
          }
          return s;
        });
    });
    if (entryStepId === stepId) {
      const step = steps?.find((s) => s.id === stepId);
      const nextId = step?.type === "condition" ? step.thenNext : step?.type === "action" || step?.type === "delay" ? step.next : undefined;
      setEntryStepId(nextId ?? undefined);
    }
  }, [steps, entryStepId]);

  // --- Connection helpers ---

  const nodeIdToStepId = useCallback((nodeId: string): string | null => {
    if (nodeId.startsWith("step-")) return nodeId.slice(5);
    return null;
  }, []);

  const wouldCreateCycle = useCallback((sourceStepId: string, targetStepId: string): boolean => {
    if (!steps) return false;
    const stepMap = new Map(steps.map((s) => [s.id, s]));
    const visited = new Set<string>();
    const queue = [targetStepId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (id === sourceStepId) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      const step = stepMap.get(id);
      if (!step) continue;
      if (step.type === "condition") {
        if (step.thenNext) queue.push(step.thenNext);
        if (step.elseNext) queue.push(step.elseNext);
      } else if ((step.type === "action" || step.type === "delay") && step.next) {
        queue.push(step.next);
      }
    }
    return false;
  }, [steps]);

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;

    // When dragging from a target (left) handle, React Flow may reverse
    // the source and target.  Normalise so source is always the node whose
    // source/output handle was involved and target is the node whose
    // target/input handle was involved.
    let { source, target, sourceHandle, targetHandle } = connection;
    if (sourceHandle === "target" || targetHandle === "source") {
      [source, target] = [target, source];
      [sourceHandle, targetHandle] = [targetHandle, sourceHandle];
    }

    if (source === "trigger") {
      const tStep = nodeIdToStepId(target);
      if (tStep) setEntryStepId(tStep);
      return;
    }
    if (target === "trigger") {
      const tStep = nodeIdToStepId(source);
      if (tStep) setEntryStepId(tStep);
      return;
    }

    const sourceStep = nodeIdToStepId(source);
    const targetStep = nodeIdToStepId(target);
    if (!sourceStep || !targetStep) return;

    if (!isStepMode) {
      const { converted, entry } = convertToStepMode();
      setSteps(converted);
      setEntryStepId(entry || undefined);
      pendingConnectionRef.current = connection;
      return;
    }

    if (wouldCreateCycle(sourceStep, targetStep)) {
      toast.error("Cannot connect: would create a cycle");
      return;
    }

    const handleId = sourceHandle;
    setSteps((prev) => {
      if (!prev) return prev;
      return prev.map((s) => {
        if (s.id !== sourceStep) return s;
        if (s.type === "condition") {
          if (handleId === "else") return { ...s, elseNext: targetStep };
          return { ...s, thenNext: targetStep };
        }
        if (s.type === "action" || s.type === "delay") {
          return { ...s, next: targetStep };
        }
        return s;
      });
    });
  }, [isStepMode, nodeIdToStepId, wouldCreateCycle, convertToStepMode, setEntryStepId]);

  // Apply pending connection after auto-conversion to step mode
  useEffect(() => {
    if (!isStepMode || !pendingConnectionRef.current) return;
    const connection = pendingConnectionRef.current;
    pendingConnectionRef.current = null;
    handleConnect(connection);
  }, [isStepMode, handleConnect]);

  const handleEdgeRemoval = useCallback((sourceNodeId: string, handleId: string | null | undefined) => {
    if (sourceNodeId === "trigger") {
      setEntryStepId(undefined);
      return;
    }
    const sourceStep = nodeIdToStepId(sourceNodeId);
    if (!sourceStep) return;
    setSteps((prev) => {
      if (!prev) return prev;
      return prev.map((s) => {
        if (s.id !== sourceStep) return s;
        if (s.type === "condition") {
          if (handleId === "else") return { ...s, elseNext: null };
          if (handleId === "then") return { ...s, thenNext: null };
          return s;
        }
        if (s.type === "action" || s.type === "delay") {
          return { ...s, next: null };
        }
        return s;
      });
    });
  }, [nodeIdToStepId]);

  const handleActionChange = useCallback((index: number, action: ActionConfig) => {
    setActions((prev) => prev.map((a, i) => (i === index ? action : a)));
  }, []);

  const handleActionRemove = useCallback((index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleActionMove = useCallback((index: number, direction: "up" | "down") => {
    setActions((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  return {
    actions,
    steps,
    entryStepId,
    isStepMode,
    addAction,
    addConditionStep,
    addDelayStep,
    handleStepChange,
    handleStepRemove,
    handleConnect,
    handleEdgeRemoval,
    handleActionChange,
    handleActionRemove,
    handleActionMove,
    convertToStepMode,
    convertAndSeverEdges,
    nodeIdToStepId,
    setEntryStepId,
  };
}
