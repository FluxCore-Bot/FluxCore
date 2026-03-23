import { useEffect, useCallback } from "react";

interface UseWorkflowKeyboardOptions {
  selectedNode: { type: string; index?: number; stepId?: string } | null;
  isStepMode: boolean;
  actionsLength: number;
  onClose: () => void;
  onDeselectNode: () => void;
  onSubmit: () => void;
  onFitView: () => void;
  onAddAction: () => void;
  onActionRemove: (index: number) => void;
  onActionReset: (index: number) => void;
  onActionMove: (index: number, direction: "up" | "down") => void;
  onStepRemove: (stepId: string) => void;
}

export function useWorkflowKeyboard({
  selectedNode,
  isStepMode,
  actionsLength,
  onClose,
  onDeselectNode,
  onSubmit,
  onFitView,
  onAddAction,
  onActionRemove,
  onActionReset,
  onActionMove,
  onStepRemove,
}: UseWorkflowKeyboardOptions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key !== "Escape" && !(e.key === "s" && (e.metaKey || e.ctrlKey))) return;
      }

      if (e.key === "Escape") {
        if (selectedNode) {
          onDeselectNode();
        } else {
          onClose();
        }
        return;
      }
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSubmit();
        return;
      }
      if (e.key === "F" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        onFitView();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNode) {
        e.preventDefault();
        if (selectedNode.type === "action" && !isStepMode && selectedNode.index !== undefined) {
          if (actionsLength > 1) {
            onActionRemove(selectedNode.index);
          } else {
            onActionReset(selectedNode.index);
          }
        } else if (selectedNode.type === "step" && selectedNode.stepId) {
          onStepRemove(selectedNode.stepId);
        }
        return;
      }
      if (e.key === "ArrowUp" && (e.metaKey || e.ctrlKey) && selectedNode?.type === "action" && !isStepMode && selectedNode.index !== undefined) {
        e.preventDefault();
        onActionMove(selectedNode.index, "up");
        return;
      }
      if (e.key === "ArrowDown" && (e.metaKey || e.ctrlKey) && selectedNode?.type === "action" && !isStepMode && selectedNode.index !== undefined) {
        e.preventDefault();
        onActionMove(selectedNode.index, "down");
        return;
      }
      if (e.key === "a" && !e.metaKey && !e.ctrlKey) {
        onAddAction();
        return;
      }
    },
    [selectedNode, isStepMode, actionsLength, onClose, onDeselectNode, onSubmit, onFitView, onAddAction, onActionRemove, onActionReset, onActionMove, onStepRemove],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
