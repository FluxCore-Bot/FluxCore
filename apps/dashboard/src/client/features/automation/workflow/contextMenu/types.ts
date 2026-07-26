import type { ActionConfig, RuleStep } from "../../../../shared/lib/schemas";

/** What the user right-clicked. */
export type ContextMenuTarget =
  | { kind: "node"; nodeId: string }
  | { kind: "edge"; edgeId: string }
  | { kind: "pane"; flowPosition: { x: number; y: number } };

export interface ContextMenuItem {
  /** Stable identity, used by tests and as the React key. */
  id: string;
  /** i18n key, resolved by the renderer. Prefix with a namespace for non-`rules` keys. */
  labelKey: string;
  labelParams?: Record<string, string | number>;
  /** Name from the Icon.tsx map. */
  icon: string;
  /** Display-only hint, e.g. "Ctrl+↑". Not a live binding. */
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

/** Items in one section; sections render with a separator between them. */
export type ContextMenuSection = ContextMenuItem[];

export interface ContextMenuHandlers {
  onConfigure: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onMove: (nodeId: string, direction: "up" | "down") => void;
  onSetAsStart: (nodeId: string) => void;
  onDisconnect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  /** Position is omitted by the trigger menu's plain "Add action", which appends. */
  onAddAction: (flowPosition?: { x: number; y: number }) => void;
  onAddCondition: (flowPosition?: { x: number; y: number }) => void;
  onAddDelay: (flowPosition?: { x: number; y: number }) => void;
  onFitView: () => void;
}

export interface ContextMenuContext {
  isStepMode: boolean;
  /** Legacy linear actions. Empty in step mode. */
  actions: ActionConfig[];
  maxActions: number;
  steps?: RuleStep[];
  entryStepId?: string;
  handlers: ContextMenuHandlers;
}
