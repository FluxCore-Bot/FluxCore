import { useEffect, useCallback } from "react";

interface UseWorkflowKeyboardOptions {
  selectedNode: { type: string; index?: number; stepId?: string } | null;
  isStepMode: boolean;
  actionsLength: number;
  /**
   * True while the canvas context menu is open. Radix owns the keyboard
   * entirely then — navigation, typeahead, dismissal — and its dismissable
   * layer preventDefault()s Escape without stopping propagation, so the key
   * still bubbles to window. Without standing down, that Escape would fall
   * through to `onClose` (closing the whole editor underneath the menu), a
   * bare "a" would add an action behind the menu, and a second Shift+F10
   * would re-capture a focus origin that is about to unmount.
   */
  contextMenuOpen: boolean;
  onClose: () => void;
  onDeselectNode: () => void;
  onSubmit: () => void;
  onFitView: () => void;
  onAddAction: () => void;
  onActionRemove: (index: number) => void;
  onActionReset: (index: number) => void;
  onActionMove: (index: number, direction: "up" | "down") => void;
  onStepRemove: (stepId: string) => void;
  onOpenContextMenu: () => void;
}

export function useWorkflowKeyboard({
  selectedNode,
  isStepMode,
  actionsLength,
  contextMenuOpen,
  onClose,
  onDeselectNode,
  onSubmit,
  onFitView,
  onAddAction,
  onActionRemove,
  onActionReset,
  onActionMove,
  onStepRemove,
  onOpenContextMenu,
}: UseWorkflowKeyboardOptions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      // See the option's doc comment: the menu suspends the whole hotkey
      // layer rather than each binding guarding itself.
      if (contextMenuOpen) return;
      // Defence in depth: a key an overlay already handled (and cancelled)
      // must not be re-interpreted as an editor hotkey.
      if (e.defaultPrevented) return;
      const tag = e.target instanceof HTMLElement ? e.target.tagName : undefined;
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
      if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
        e.preventDefault();
        onOpenContextMenu();
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
    [selectedNode, isStepMode, actionsLength, contextMenuOpen, onClose, onDeselectNode, onSubmit, onFitView, onAddAction, onActionRemove, onActionReset, onActionMove, onStepRemove, onOpenContextMenu],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
