import { useCallback, useRef, useState } from "react";
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

  /**
   * Whatever had focus when the menu opened — normally the `.react-flow__node`
   * a keyboard user was standing on. Radix's DropdownMenu returns focus to its
   * trigger on close, but ours is a zero-size, aria-hidden span that cannot
   * take focus, so without this the caller's place in the canvas is lost to
   * `<body>`. Held in a ref: it is read once, on close, and must never
   * re-render the editor.
   */
  const originRef = useRef<HTMLElement | null>(null);

  const captureOrigin = useCallback(() => {
    const active = document.activeElement;
    // A right-click usually leaves `<body>` focused; there is no place to
    // return to, and focusing the body is not a restoration.
    originRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
  }, []);

  /**
   * Hand focus back to the opener. Called from the menu's `onCloseAutoFocus`.
   */
  const restoreFocus = useCallback(() => {
    const origin = originRef.current;
    originRef.current = null;
    // Gone from the document when the menu's own verb deleted that node — the
    // detached element would silently swallow the focus call.
    if (origin?.isConnected) origin.focus();
  }, []);

  const openNodeMenu = useCallback<NodeMouseHandler>((event, node) => {
    event.preventDefault();
    captureOrigin();
    setMenu({
      target: { kind: "node", nodeId: node.id },
      x: event.clientX,
      y: event.clientY,
      label: typeof node.data?.label === "string" ? node.data.label : undefined,
    });
  }, [captureOrigin]);

  const openEdgeMenu = useCallback<EdgeMouseHandler>((event, edge) => {
    event.preventDefault();
    captureOrigin();
    setMenu({
      target: { kind: "edge", edgeId: edge.id },
      x: event.clientX,
      y: event.clientY,
    });
  }, [captureOrigin]);

  const openPaneMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      captureOrigin();
      setMenu({
        target: {
          kind: "pane",
          flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        },
        x: event.clientX,
        y: event.clientY,
      });
    },
    [screenToFlowPosition, captureOrigin],
  );

  /** Shift+F10 / the Menu key: anchor to the focused node, else to the canvas centre. */
  const openFromKeyboard = useCallback(() => {
    const active = document.activeElement;
    captureOrigin();
    const closest =
      active instanceof HTMLElement ? active.closest(".react-flow__node") : null;
    const nodeEl = closest instanceof HTMLElement ? closest : null;
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
  }, [screenToFlowPosition, getNode, captureOrigin]);

  const close = useCallback(() => setMenu(null), []);

  return {
    menu,
    contextMenuNodeId: menu?.target.kind === "node" ? menu.target.nodeId : null,
    openNodeMenu,
    openEdgeMenu,
    openPaneMenu,
    openFromKeyboard,
    close,
    restoreFocus,
  };
}
