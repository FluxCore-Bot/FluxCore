import { useCallback, useState } from "react";
import {
  useReactFlow,
  type EdgeMouseHandler,
  type NodeMouseHandler,
} from "@xyflow/react";
import type { ContextMenuTarget } from "./types";

export interface OpenContextMenu {
  target: ContextMenuTarget;
  /** Viewport coordinates the menu is anchored to. */
  x: number;
  y: number;
  /** Node label captured when the menu opened, for the menu's aria-label. */
  label?: string;
}

/**
 * Owns which context menu is open and where. Kept apart from WorkflowEditor so
 * the editor only has to render the menu and supply handlers.
 */
export function useWorkflowContextMenu() {
  const [menu, setMenu] = useState<OpenContextMenu | null>(null);
  const { screenToFlowPosition, getNode } = useReactFlow();

  const openNodeMenu = useCallback<NodeMouseHandler>((event, node) => {
    event.preventDefault();
    setMenu({
      target: { kind: "node", nodeId: node.id },
      x: event.clientX,
      y: event.clientY,
      label: typeof node.data?.label === "string" ? node.data.label : undefined,
    });
  }, []);

  const openEdgeMenu = useCallback<EdgeMouseHandler>((event, edge) => {
    event.preventDefault();
    setMenu({
      target: { kind: "edge", edgeId: edge.id },
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const openPaneMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setMenu({
        target: {
          kind: "pane",
          flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        },
        x: event.clientX,
        y: event.clientY,
      });
    },
    [screenToFlowPosition],
  );

  /** Shift+F10 / the Menu key: anchor to the focused node, else to the canvas centre. */
  const openFromKeyboard = useCallback(() => {
    const active = document.activeElement as HTMLElement | null;
    const nodeEl = active?.closest?.(".react-flow__node") as HTMLElement | null;
    if (nodeEl?.dataset.id) {
      const rect = nodeEl.getBoundingClientRect();
      const node = getNode(nodeEl.dataset.id);
      setMenu({
        target: { kind: "node", nodeId: nodeEl.dataset.id },
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        label: typeof node?.data?.label === "string" ? node.data.label : undefined,
      });
      return;
    }
    const pane = document.querySelector(".react-flow__pane");
    const rect = pane?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : 0;
    const y = rect ? rect.top + rect.height / 2 : 0;
    setMenu({
      target: { kind: "pane", flowPosition: screenToFlowPosition({ x, y }) },
      x,
      y,
    });
  }, [screenToFlowPosition, getNode]);

  const close = useCallback(() => setMenu(null), []);

  return {
    menu,
    contextMenuNodeId: menu?.target.kind === "node" ? menu.target.nodeId : null,
    openNodeMenu,
    openEdgeMenu,
    openPaneMenu,
    openFromKeyboard,
    close,
  };
}
