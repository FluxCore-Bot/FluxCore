# Automation Canvas Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add right-click context menus to the automation workflow canvas for nodes, edges, and the empty pane, along with the four verbs the canvas is missing — duplicate, add-at-cursor, set-as-start, and disconnect.

**Architecture:** A controlled Radix `DropdownMenu` (the existing `shared/ui/dropdown-menu`) is anchored to a zero-size `position: fixed` element placed at the cursor. React Flow's `onNodeContextMenu` / `onEdgeContextMenu` / `onPaneContextMenu` supply the target. All menu-shape branching lives in one pure function so it is unit-testable without a DOM.

**Tech Stack:** React 19, TypeScript (strict), `@xyflow/react`, Radix UI, Tailwind 4, Vitest 4 + Testing Library, `react-i18next`, sonner.

**Spec:** `docs/superpowers/specs/2026-07-26-automation-canvas-context-menu-design.md`

## Global Constraints

- **No new npm dependencies.** `@radix-ui/react-context-menu` is explicitly rejected; build on the existing `shared/ui/dropdown-menu`.
- **All commands run inside Docker.** Host `node_modules` is root-owned and this worktree has none. Never run bare `pnpm` on the host.
- **Strict TypeScript** — no `any`.
- **Every task ends green.** Tests and typecheck must pass before the commit step.
- **i18n:** new keys go in `packages/i18n/src/locales/<lang>/rules.json` **and** `packages/i18n/dist/locales/<lang>/rules.json` for **all 48 locales**, with real translations. English placeholders are treated as unfinished work.
- **Never rewrite a locale file with `json.dump`.** Locale files have inconsistent formatting (`th` is semi-compact, 17 files use `\u` escapes). Insert text; gate on zero deleted lines.
- **Reuse existing i18n keys** where they already exist and are already translated (listed in Task 6).
- Lucide icons are never filled. Destructive affordances pair colour with an icon.

### Verified commands

Run these from the worktree root (`.claude/worktrees/feat+automation-canvas-context-menu`). Both were verified green against the untouched baseline before this plan was written.

```bash
# Run one dashboard test file
docker run --rm \
  -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" \
  -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" \
  -w /app/apps/dashboard fluxcore-bot:latest \
  pnpm exec vitest run <TEST_PATH>

# Run the whole dashboard suite
docker run --rm \
  -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" \
  -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" \
  -w /app/apps/dashboard fluxcore-bot:latest \
  pnpm exec vitest run

# Client typecheck
docker run --rm \
  -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" \
  -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" \
  -w /app/apps/dashboard fluxcore-bot:latest \
  pnpm exec tsc -p tsconfig.client.json --noEmit
```

This bypasses `docker compose`, which cannot run here — the compose `bot` service requires `.env.dev`, which is gitignored and absent from the worktree. The image's baked `node_modules` is used, and only `src` and `tests` are overlaid.

**Baseline note:** `apps/dashboard/tests/client/features/automation/RuleList.test.tsx` passes (4 tests) and `tsc -p tsconfig.client.json --noEmit` exits 0 on the starting commit.

---

## File Structure

**Create:**

| Path | Responsibility |
| --- | --- |
| `apps/dashboard/src/client/features/automation/workflow/contextMenu/types.ts` | `ContextMenuTarget`, `ContextMenuItem`, `ContextMenuSection`, `ContextMenuContext` |
| `apps/dashboard/src/client/features/automation/workflow/contextMenu/buildItems.ts` | `parseNodeId`, `stepHasConnections`, pure `buildContextMenuItems` |
| `apps/dashboard/src/client/features/automation/workflow/contextMenu/WorkflowContextMenu.tsx` | Presentational menu: controlled `DropdownMenu` + cursor anchor |
| `apps/dashboard/src/client/features/automation/workflow/contextMenu/useWorkflowContextMenu.ts` | Open/close state, React Flow openers, keyboard opener |
| `apps/dashboard/tests/client/features/automation/contextMenu/buildItems.test.ts` | Task 1 tests |
| `apps/dashboard/tests/client/features/automation/useWorkflowSteps.test.ts` | Task 2 tests |
| `apps/dashboard/tests/client/features/automation/contextMenu/WorkflowContextMenu.test.tsx` | Task 3 tests |
| `apps/dashboard/tests/client/features/automation/useWorkflowKeyboard.test.ts` | Task 4 tests |

**Modify:**

| Path | Change |
| --- | --- |
| `apps/dashboard/src/client/shared/components/Icon.tsx` | Add `link_off` → Lucide `Unlink` |
| `.gitignore` | Ignore `.claude/worktrees/` |
| `apps/dashboard/src/client/features/automation/workflow/useWorkflowSteps.ts` | `add*` return the new node id; add `duplicateNode`, `disconnectNode`, `setAsStart`, `snapshot`, `restore` |
| `apps/dashboard/src/client/features/automation/workflow/useWorkflowKeyboard.ts` | `Shift+F10` / `ContextMenu` key branch |
| `apps/dashboard/src/client/features/automation/workflow/WorkflowEditor.tsx` | Wire the three React Flow handlers, `pendingPositionsRef`, delete-with-undo, render the menu |
| `packages/i18n/{src,dist}/locales/*/rules.json` | 13 new `contextMenu.*` keys × 48 locales × 2 trees |

---

## Task 1: Menu shape — types, pure item builder, icon

**Files:**
- Create: `apps/dashboard/src/client/features/automation/workflow/contextMenu/types.ts`
- Create: `apps/dashboard/src/client/features/automation/workflow/contextMenu/buildItems.ts`
- Modify: `apps/dashboard/src/client/shared/components/Icon.tsx`
- Modify: `.gitignore`
- Test: `apps/dashboard/tests/client/features/automation/contextMenu/buildItems.test.ts`

**Interfaces:**
- Consumes: `RuleStep`, `ActionConfig` from `src/client/shared/lib/schemas`.
- Produces:
  - `type ContextMenuTarget = { kind: "node"; nodeId: string } | { kind: "edge"; edgeId: string } | { kind: "pane"; flowPosition: { x: number; y: number } }`
  - `interface ContextMenuItem { id: string; labelKey: string; labelParams?: Record<string, string | number>; icon: string; shortcut?: string; disabled?: boolean; danger?: boolean; onSelect: () => void }`
  - `type ContextMenuSection = ContextMenuItem[]`
  - `interface ContextMenuContext` (see code below)
  - `parseNodeId(nodeId: string): ParsedNodeId | null`
  - `stepHasConnections(stepId: string, steps: RuleStep[] | undefined, entryStepId: string | undefined): boolean`
  - `buildContextMenuItems(target: ContextMenuTarget, ctx: ContextMenuContext): ContextMenuSection[]`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/features/automation/contextMenu/buildItems.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec vitest run tests/client/features/automation/contextMenu/buildItems.test.ts
```

Expected: FAIL — cannot resolve `.../contextMenu/buildItems`.

- [ ] **Step 3: Create the types**

`apps/dashboard/src/client/features/automation/workflow/contextMenu/types.ts`:

```ts
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
```

- [ ] **Step 4: Create the item builder**

`apps/dashboard/src/client/features/automation/workflow/contextMenu/buildItems.ts`:

```ts
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
```

- [ ] **Step 5: Add the `link_off` icon**

In `apps/dashboard/src/client/shared/components/Icon.tsx`, add `Unlink` to the `lucide-react` import list (alphabetically, between `Ticket`/`Timer` region — it belongs after `TrendingUp` and before `Unlock`):

```ts
  TrendingUp,
  Unlink,
  Unlock,
```

Then add the map entry, keeping the map's alphabetical order (it goes after `list:` and before `lock:` — the map is sorted by the Material-Symbols key, so `link_off` sits between `lightbulb` and `list`):

```ts
  link_off: Unlink,
```

Verify placement by reading the surrounding lines first; the map is alphabetical by key and the import list is alphabetical by component name.

- [ ] **Step 6: Ignore the worktree directory**

Append to `.gitignore`:

```
# Claude Code worktrees
.claude/worktrees/
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec vitest run tests/client/features/automation/contextMenu/buildItems.test.ts
```

Expected: PASS — every test in the file green.

- [ ] **Step 8: Typecheck**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec tsc -p tsconfig.client.json --noEmit
```

Expected: exit 0, no output.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/src/client/features/automation/workflow/contextMenu \
        apps/dashboard/tests/client/features/automation/contextMenu \
        apps/dashboard/src/client/shared/components/Icon.tsx \
        .gitignore
git commit -m "feat(automation): pure context-menu item builder for the workflow canvas"
```

---

## Task 2: Canvas operations — duplicate, disconnect, set-as-start, snapshot

**Files:**
- Modify: `apps/dashboard/src/client/features/automation/workflow/useWorkflowSteps.ts`
- Test: `apps/dashboard/tests/client/features/automation/useWorkflowSteps.test.ts`

**Interfaces:**
- Consumes: `parseNodeId` from Task 1.
- Produces, added to the `useWorkflowSteps` return object:
  - `addAction: () => string | null` — was `() => void`
  - `addConditionStep: () => string | null` — was `() => void`
  - `addDelayStep: () => string | null` — was `() => void`
  - `duplicateNode: (nodeId: string) => string | null`
  - `disconnectNode: (nodeId: string) => void`
  - `setAsStart: (nodeId: string) => void`
  - `snapshot: () => WorkflowSnapshot`
  - `restore: (snap: WorkflowSnapshot) => void`
  - `export interface WorkflowSnapshot { actions: ActionConfig[]; steps?: RuleStep[]; entryStepId?: string }`

The returned ids are React Flow node ids (`action-2`, `step-step_3`), not bare step ids, so callers can key the position map directly.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/features/automation/useWorkflowSteps.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWorkflowSteps } from "../../../../src/client/features/automation/workflow/useWorkflowSteps";
import type { ActionConfig, Constants, RuleStep } from "../../../../src/client/shared/lib/schemas";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const constants = { maxActionsPerRule: 5 } as unknown as Constants;

function setup(over: {
  initialActions?: ActionConfig[];
  initialSteps?: RuleStep[];
  initialEntryStepId?: string;
} = {}) {
  return renderHook(() =>
    useWorkflowSteps({
      initialActions: over.initialActions ?? [{ type: "sendMessage" }],
      initialSteps: over.initialSteps,
      initialEntryStepId: over.initialEntryStepId,
      constants,
    }),
  );
}

const graph: RuleStep[] = [
  { id: "step_0", type: "action", action: { type: "sendMessage", message: "hi" }, next: "step_1" },
  { id: "step_1", type: "condition", condition: { field: "channelId", operator: "equals", value: "9" }, thenNext: "step_2", elseNext: null },
  { id: "step_2", type: "delay", delayMs: 5000, next: null },
];

describe("add helpers return the new node id", () => {
  it("returns the linear action id", () => {
    const { result } = setup();
    let id: string | null = null;
    act(() => { id = result.current.addAction(); });
    expect(id).toBe("action-1");
    expect(result.current.actions).toHaveLength(2);
  });

  it("returns null when the linear ceiling is reached", () => {
    const { result } = setup({ initialActions: Array.from({ length: 5 }, () => ({ type: "sendMessage" })) });
    let id: string | null = "unset";
    act(() => { id = result.current.addAction(); });
    expect(id).toBeNull();
  });

  it("returns the step id in step mode", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    let id: string | null = null;
    act(() => { id = result.current.addDelayStep(); });
    expect(id).toBe("step-step_3");
  });
});

describe("duplicateNode", () => {
  it("inserts a copy right after the original in linear mode", () => {
    const { result } = setup({ initialActions: [{ type: "sendMessage" }, { type: "addRole" }] });
    let id: string | null = null;
    act(() => { id = result.current.duplicateNode("action-0"); });
    expect(id).toBe("action-1");
    expect(result.current.actions.map((a) => a.type)).toEqual([
      "sendMessage", "sendMessage", "addRole",
    ]);
  });

  it("refuses to duplicate past the linear ceiling", () => {
    const { result } = setup({ initialActions: Array.from({ length: 5 }, () => ({ type: "sendMessage" })) });
    let id: string | null = "unset";
    act(() => { id = result.current.duplicateNode("action-0"); });
    expect(id).toBeNull();
    expect(result.current.actions).toHaveLength(5);
  });

  it("clones a step with a fresh id and no outgoing links", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    let id: string | null = null;
    act(() => { id = result.current.duplicateNode("step-step_0"); });
    expect(id).toBe("step-step_3");
    const copy = result.current.steps!.find((s) => s.id === "step_3")!;
    expect(copy).toMatchObject({ type: "action", next: null });
    expect(copy.type === "action" ? copy.action.message : null).toBe("hi");
  });

  it("clears both branches when cloning a condition", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    act(() => { result.current.duplicateNode("step-step_1"); });
    const copy = result.current.steps!.find((s) => s.id === "step_3");
    expect(copy).toMatchObject({ type: "condition", thenNext: null, elseNext: null });
  });

  it("does not make the copy the entry step", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    act(() => { result.current.duplicateNode("step-step_0"); });
    expect(result.current.entryStepId).toBe("step_0");
  });

  it("deep-copies so editing the copy leaves the original alone", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    act(() => { result.current.duplicateNode("step-step_0"); });
    const copy = result.current.steps!.find((s) => s.id === "step_3")!;
    act(() => {
      result.current.handleStepChange("step_3", {
        ...(copy as Extract<RuleStep, { type: "action" }>),
        action: { type: "sendMessage", message: "changed" },
      });
    });
    const original = result.current.steps!.find((s) => s.id === "step_0")!;
    expect(original.type === "action" && original.action.message).toBe("hi");
  });
});

describe("disconnectNode", () => {
  it("clears outgoing and incoming links but keeps the step", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    act(() => { result.current.disconnectNode("step-step_1"); });
    const s0 = result.current.steps!.find((s) => s.id === "step_0")!;
    const s1 = result.current.steps!.find((s) => s.id === "step_1")!;
    expect(s0.type === "action" && s0.next).toBeNull();
    expect(s1.type === "condition" && s1.thenNext).toBeNull();
    expect(result.current.steps).toHaveLength(3);
  });

  it("clears the entry when the entry step is disconnected", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    act(() => { result.current.disconnectNode("step-step_0"); });
    expect(result.current.entryStepId).toBeUndefined();
  });

  it("converts a linear rule to a step graph first", () => {
    const { result } = setup({ initialActions: [{ type: "sendMessage" }, { type: "addRole" }] });
    act(() => { result.current.disconnectNode("action-1"); });
    expect(result.current.isStepMode).toBe(true);
    const s0 = result.current.steps!.find((s) => s.id === "step_0")!;
    expect(s0.type === "action" && s0.next).toBeNull();
  });
});

describe("setAsStart", () => {
  it("re-points the entry in step mode", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    act(() => { result.current.setAsStart("step-step_2"); });
    expect(result.current.entryStepId).toBe("step_2");
  });

  it("converts a linear rule and points the entry at the chosen action", () => {
    const { result } = setup({ initialActions: [{ type: "sendMessage" }, { type: "addRole" }] });
    act(() => { result.current.setAsStart("action-1"); });
    expect(result.current.isStepMode).toBe(true);
    expect(result.current.entryStepId).toBe("step_1");
  });

  it("ignores an unconfigured linear action, which has no step", () => {
    const { result } = setup({ initialActions: [{ type: "sendMessage" }, { type: "" }] });
    act(() => { result.current.setAsStart("action-1"); });
    expect(result.current.entryStepId).toBeUndefined();
  });
});

describe("snapshot and restore", () => {
  it("restores steps, entry, and the neighbour rewiring a removal performed", () => {
    const { result } = setup({ initialSteps: graph, initialEntryStepId: "step_0" });
    const snap = result.current.snapshot();
    act(() => { result.current.handleStepRemove("step_1"); });
    expect(result.current.steps).toHaveLength(2);
    act(() => { result.current.restore(snap); });
    expect(result.current.steps).toHaveLength(3);
    const s0 = result.current.steps!.find((s) => s.id === "step_0")!;
    expect(s0.type === "action" && s0.next).toBe("step_1");
    expect(result.current.entryStepId).toBe("step_0");
  });

  it("restores a linear action that was reset to empty", () => {
    const { result } = setup({ initialActions: [{ type: "sendMessage", message: "hi" }] });
    const snap = result.current.snapshot();
    act(() => { result.current.handleActionChange(0, { type: "" }); });
    expect(result.current.actions[0].type).toBe("");
    act(() => { result.current.restore(snap); });
    expect(result.current.actions[0]).toMatchObject({ type: "sendMessage", message: "hi" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec vitest run tests/client/features/automation/useWorkflowSteps.test.ts
```

Expected: FAIL — `result.current.duplicateNode is not a function`, and the add helpers return `undefined`.

- [ ] **Step 3: Make the add helpers return node ids**

In `useWorkflowSteps.ts`, change the three add callbacks to return the new React Flow node id. `addAction` becomes:

```ts
  const addAction = useCallback((): string | null => {
    if (!constants) return null;
    if (isStepMode) {
      const newId = nextStepId();
      setSteps((prev) => [
        ...(prev ?? []),
        { id: newId, type: "action" as const, action: { ...emptyAction }, next: null },
      ]);
      if (!entryStepId) setEntryStepId(newId);
      return `step-${newId}`;
    }
    if (actions.length < constants.maxActionsPerRule) {
      setActions((prev) => [...prev, { ...emptyAction }]);
      return `action-${actions.length}`;
    }
    return null;
  }, [constants, actions.length, isStepMode, nextStepId, entryStepId]);
```

`addConditionStep` and `addDelayStep` follow the same shape. Both already branch on `isStepMode`; in the conversion branch return `step-${condId}` / `step-${delayId}`, and in the step-mode branch return `step-${newId}`. Neither has a ceiling, so neither returns `null`.

- [ ] **Step 4: Add the four new operations**

Add these to `useWorkflowSteps.ts`, after `handleStepRemove`. `cloneStep` is a module-level helper placed next to `emptyAction`:

```ts
export interface WorkflowSnapshot {
  actions: ActionConfig[];
  steps?: RuleStep[];
  entryStepId?: string;
}

/** Structured copy of a step under a new id, with every outgoing link cleared. */
function cloneStep(step: RuleStep, newId: string): RuleStep {
  if (step.type === "action") {
    return { id: newId, type: "action", action: { ...step.action }, next: null };
  }
  if (step.type === "condition") {
    return {
      id: newId,
      type: "condition",
      condition: { ...step.condition },
      thenNext: null,
      elseNext: null,
    };
  }
  return { id: newId, type: "delay", delayMs: step.delayMs, next: null };
}

/** Clear every link into and out of a step within a step list. */
function severStep(list: RuleStep[], stepId: string): RuleStep[] {
  return list.map((s) => {
    const self =
      s.id === stepId
        ? s.type === "condition"
          ? { ...s, thenNext: null, elseNext: null }
          : { ...s, next: null }
        : s;
    if (self.type === "condition") {
      return {
        ...self,
        thenNext: self.thenNext === stepId ? null : self.thenNext,
        elseNext: self.elseNext === stepId ? null : self.elseNext,
      };
    }
    return { ...self, next: self.next === stepId ? null : self.next };
  });
}
```

Inside the hook:

```ts
  /**
   * Index of a linear action inside the converted step list. `convertToStepMode`
   * drops unconfigured actions, so the two indexes only line up when every
   * earlier action has a type.
   */
  const convertedIndexOf = useCallback((actionIndex: number): number => {
    if (!actions[actionIndex]?.type) return -1;
    return actions.slice(0, actionIndex).filter((a) => a.type).length;
  }, [actions]);

  const duplicateNode = useCallback((nodeId: string): string | null => {
    const parsed = parseNodeId(nodeId);
    if (!parsed) return null;

    if (parsed.kind === "action") {
      if (!constants || actions.length >= constants.maxActionsPerRule) return null;
      const source = actions[parsed.index];
      if (!source) return null;
      setActions((prev) => [
        ...prev.slice(0, parsed.index + 1),
        { ...source },
        ...prev.slice(parsed.index + 1),
      ]);
      return `action-${parsed.index + 1}`;
    }

    if (parsed.kind === "step") {
      const source = steps?.find((s) => s.id === parsed.stepId);
      if (!source) return null;
      const newId = nextStepId();
      setSteps((prev) => [...(prev ?? []), cloneStep(source, newId)]);
      return `step-${newId}`;
    }

    return null;
  }, [actions, constants, steps, nextStepId]);

  const disconnectNode = useCallback((nodeId: string) => {
    const parsed = parseNodeId(nodeId);
    if (!parsed) return;

    if (parsed.kind === "step") {
      setSteps((prev) => (prev ? severStep(prev, parsed.stepId) : prev));
      if (entryStepId === parsed.stepId) setEntryStepId(undefined);
      return;
    }

    if (parsed.kind === "action") {
      const convertedIndex = convertedIndexOf(parsed.index);
      if (convertedIndex < 0) return;
      const { converted, entry } = convertToStepMode();
      const targetId = converted[convertedIndex]?.id;
      if (!targetId) return;
      setSteps(severStep(converted, targetId));
      setEntryStepId(entry === targetId ? undefined : entry || undefined);
    }
  }, [entryStepId, convertedIndexOf, convertToStepMode]);

  const setAsStart = useCallback((nodeId: string) => {
    const parsed = parseNodeId(nodeId);
    if (!parsed) return;

    if (parsed.kind === "step") {
      setEntryStepId(parsed.stepId);
      return;
    }

    if (parsed.kind === "action") {
      const convertedIndex = convertedIndexOf(parsed.index);
      if (convertedIndex < 0) return;
      const { converted } = convertToStepMode();
      const targetId = converted[convertedIndex]?.id;
      if (!targetId) return;
      setSteps(converted);
      setEntryStepId(targetId);
    }
  }, [convertedIndexOf, convertToStepMode]);

  const snapshot = useCallback(
    (): WorkflowSnapshot => ({ actions, steps, entryStepId }),
    [actions, steps, entryStepId],
  );

  const restore = useCallback((snap: WorkflowSnapshot) => {
    setActions(snap.actions);
    setSteps(snap.steps);
    setEntryStepId(snap.entryStepId);
  }, []);
```

Import `parseNodeId` at the top of the file:

```ts
import { parseNodeId } from "./contextMenu/buildItems";
```

Add the six new names to the hook's return object:

```ts
    duplicateNode,
    disconnectNode,
    setAsStart,
    snapshot,
    restore,
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec vitest run tests/client/features/automation/useWorkflowSteps.test.ts
```

Expected: PASS — every test in the file green.

- [ ] **Step 6: Typecheck**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec tsc -p tsconfig.client.json --noEmit
```

Expected: exit 0. `WorkflowEditor` calls `addAction` in a `void` position, so the widened return type does not break it.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/client/features/automation/workflow/useWorkflowSteps.ts \
        apps/dashboard/tests/client/features/automation/useWorkflowSteps.test.ts
git commit -m "feat(automation): duplicate, disconnect, set-as-start, and undo snapshots for workflow steps"
```

---

## Task 3: The menu component

**Files:**
- Create: `apps/dashboard/src/client/features/automation/workflow/contextMenu/WorkflowContextMenu.tsx`
- Test: `apps/dashboard/tests/client/features/automation/contextMenu/WorkflowContextMenu.test.tsx`

**Interfaces:**
- Consumes: `ContextMenuSection` from Task 1; `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator` from `shared/ui/dropdown-menu`; `Icon` from `shared/components/Icon`.
- Produces:
  ```ts
  interface WorkflowContextMenuProps {
    open: boolean;
    x: number;
    y: number;
    ariaLabel: string;
    sections: ContextMenuSection[];
    onClose: () => void;
  }
  export function WorkflowContextMenu(props: WorkflowContextMenuProps): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/features/automation/contextMenu/WorkflowContextMenu.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowContextMenu } from "../../../../../src/client/features/automation/workflow/contextMenu/WorkflowContextMenu";
import type { ContextMenuSection } from "../../../../../src/client/features/automation/workflow/contextMenu/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.label ? `${k}:${o.label}` : k),
    i18n: { dir: () => "ltr" },
  }),
}));

// Radix's popper and menu need these; jsdom ships none of them.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.scrollIntoView ??= () => {};
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
});

function makeSections(onSelect = vi.fn(), disabledSelect = vi.fn()): ContextMenuSection[] {
  return [
    [
      { id: "configure", labelKey: "contextMenu.configure", icon: "tune", onSelect },
      {
        id: "duplicate",
        labelKey: "ruleList.duplicate",
        icon: "content_copy",
        disabled: true,
        onSelect: disabledSelect,
      },
    ],
    [
      {
        id: "delete",
        labelKey: "panel.removeStep",
        icon: "delete",
        shortcut: "Del",
        danger: true,
        onSelect: vi.fn(),
      },
    ],
  ];
}

function setup(over: Partial<React.ComponentProps<typeof WorkflowContextMenu>> = {}) {
  const onClose = vi.fn();
  const sections = over.sections ?? makeSections();
  render(
    <WorkflowContextMenu
      open
      x={120}
      y={80}
      ariaLabel="contextMenu.menuLabel:Send message"
      sections={sections}
      onClose={onClose}
      {...over}
    />,
  );
  return { onClose, sections };
}

describe("WorkflowContextMenu", () => {
  it("renders every item, translated, when open", async () => {
    setup();
    expect(await screen.findByRole("menuitem", { name: /contextMenu.configure/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /ruleList.duplicate/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /panel.removeStep/ })).toBeInTheDocument();
  });

  it("names the menu after its target", async () => {
    setup();
    expect(await screen.findByRole("menu", { name: "contextMenu.menuLabel:Send message" }))
      .toBeInTheDocument();
  });

  it("renders the shortcut hint alongside its item", async () => {
    setup();
    expect(await screen.findByText("Del")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    setup({ open: false });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("fires onSelect and closes when an item is chosen", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { onClose } = setup({ sections: makeSections(onSelect) });
    await user.click(await screen.findByRole("menuitem", { name: /contextMenu.configure/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not fire a disabled item", async () => {
    const user = userEvent.setup();
    const disabledSelect = vi.fn();
    setup({ sections: makeSections(vi.fn(), disabledSelect) });
    await user.click(await screen.findByRole("menuitem", { name: /ruleList.duplicate/ }));
    expect(disabledSelect).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("separates sections", async () => {
    setup();
    await screen.findByRole("menu");
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("anchors at the cursor and hides the anchor from assistive tech", () => {
    setup();
    const anchor = screen.getByTestId("workflow-context-menu-anchor");
    expect(anchor).toHaveAttribute("aria-hidden", "true");
    expect(anchor).toHaveStyle({ position: "fixed", left: "120px", top: "80px" });
  });

  it("mounts after an existing body-level overlay, so it paints above it", async () => {
    // The editor portals itself to <body> at z-50 and so does the menu; the menu
    // wins only because it mounts later in document order. Assert that ordering
    // rather than trusting it.
    const editorOverlay = document.createElement("div");
    document.body.appendChild(editorOverlay);
    setup();
    const menu = await screen.findByRole("menu");
    expect(editorOverlay.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec vitest run tests/client/features/automation/contextMenu/WorkflowContextMenu.test.tsx
```

Expected: FAIL — cannot resolve `.../contextMenu/WorkflowContextMenu`.

- [ ] **Step 3: Write the component**

`apps/dashboard/src/client/features/automation/workflow/contextMenu/WorkflowContextMenu.tsx`:

```tsx
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../../shared/ui/dropdown-menu";
import { Icon } from "../../../../shared/components/Icon";
import type { ContextMenuSection } from "./types";

export interface WorkflowContextMenuProps {
  open: boolean;
  /** Viewport coordinates of the cursor (or of the focused node, for keyboard opens). */
  x: number;
  y: number;
  ariaLabel: string;
  sections: ContextMenuSection[];
  onClose: () => void;
}

/**
 * A context menu for the workflow canvas, built on the shared DropdownMenu and
 * anchored to a zero-size element at the cursor. Radix owns keyboard
 * navigation, dismissal, and focus restoration.
 */
export function WorkflowContextMenu({
  open,
  x,
  y,
  ariaLabel,
  sections,
  onClose,
}: WorkflowContextMenuProps) {
  const { t, i18n } = useTranslation(["rules", "common"]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden="true"
          data-testid="workflow-context-menu-anchor"
          style={{ position: "fixed", left: x, top: y, width: 0, height: 0 }}
        />
      </DropdownMenuTrigger>
      {/* The canvas container is force-dir="ltr" for React Flow, so the menu
          has to opt back into the document direction. */}
      <DropdownMenuContent align="start" dir={i18n.dir()} aria-label={ariaLabel} className="min-w-52">
        {sections.map((section, sectionIndex) => (
          <Fragment key={section[0]?.id ?? sectionIndex}>
            {sectionIndex > 0 && <DropdownMenuSeparator />}
            {section.map((item) => (
              <DropdownMenuItem
                key={item.id}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={item.danger ? "text-danger focus:text-danger" : undefined}
              >
                <Icon
                  name={item.icon}
                  size={14}
                  className={item.danger ? "text-danger" : "text-text-muted"}
                />
                <span>{t(item.labelKey, item.labelParams)}</span>
                {item.shortcut && (
                  <kbd className="ms-auto rounded bg-surface-lowest px-1 py-0.5 font-mono text-[10px] text-text-muted">
                    {item.shortcut}
                  </kbd>
                )}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec vitest run tests/client/features/automation/contextMenu/WorkflowContextMenu.test.tsx
```

Expected: PASS — every test in the file green.

If Radix's `onSelect` closes the menu before the assertion runs, note that `DropdownMenuItem.onSelect` receives an `Event`; the item callbacks take no argument, so passing `item.onSelect` directly is safe. Do not call `event.preventDefault()` — the menu is meant to close on selection.

- [ ] **Step 5: Typecheck**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec tsc -p tsconfig.client.json --noEmit
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/client/features/automation/workflow/contextMenu/WorkflowContextMenu.tsx \
        apps/dashboard/tests/client/features/automation/contextMenu/WorkflowContextMenu.test.tsx
git commit -m "feat(automation): workflow context menu component"
```

---

## Task 4: Menu state and the keyboard opener

**Files:**
- Create: `apps/dashboard/src/client/features/automation/workflow/contextMenu/useWorkflowContextMenu.ts`
- Modify: `apps/dashboard/src/client/features/automation/workflow/useWorkflowKeyboard.ts`
- Test: `apps/dashboard/tests/client/features/automation/useWorkflowKeyboard.test.ts`

**Interfaces:**
- Consumes: `ContextMenuTarget` from Task 1; `useReactFlow` from `@xyflow/react`.
- Produces:
  ```ts
  interface OpenContextMenu {
    target: ContextMenuTarget;
    x: number;
    y: number;
    /** Node label captured at open time, for the menu's aria-label. */
    label?: string;
  }
  export function useWorkflowContextMenu(): {
    menu: OpenContextMenu | null;
    contextMenuNodeId: string | null;
    openNodeMenu: NodeMouseHandler;
    openEdgeMenu: EdgeMouseHandler;
    openPaneMenu: (event: React.MouseEvent | MouseEvent) => void;
    openFromKeyboard: () => void;
    close: () => void;
  }
  ```
- `useWorkflowKeyboard` gains one required option: `onOpenContextMenu: () => void`.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/features/automation/useWorkflowKeyboard.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWorkflowKeyboard } from "../../../../src/client/features/automation/workflow/useWorkflowKeyboard";

function setup(over: Partial<Parameters<typeof useWorkflowKeyboard>[0]> = {}) {
  const opts = {
    selectedNode: null,
    isStepMode: false,
    actionsLength: 1,
    onClose: vi.fn(),
    onDeselectNode: vi.fn(),
    onSubmit: vi.fn(),
    onFitView: vi.fn(),
    onAddAction: vi.fn(),
    onActionRemove: vi.fn(),
    onActionReset: vi.fn(),
    onActionMove: vi.fn(),
    onStepRemove: vi.fn(),
    onOpenContextMenu: vi.fn(),
    ...over,
  };
  renderHook(() => useWorkflowKeyboard(opts));
  return opts;
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, ...init });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("useWorkflowKeyboard context menu binding", () => {
  it("opens the menu on the dedicated ContextMenu key", () => {
    const opts = setup();
    press("ContextMenu");
    expect(opts.onOpenContextMenu).toHaveBeenCalledTimes(1);
  });

  it("opens the menu on Shift+F10", () => {
    const opts = setup();
    press("F10", { shiftKey: true });
    expect(opts.onOpenContextMenu).toHaveBeenCalledTimes(1);
  });

  it("ignores a bare F10", () => {
    const opts = setup();
    press("F10");
    expect(opts.onOpenContextMenu).not.toHaveBeenCalled();
  });

  it("stays inert while focus is in a text input", () => {
    const opts = setup();
    const input = document.createElement("input");
    document.body.appendChild(input);
    press("ContextMenu", {}, input);
    expect(opts.onOpenContextMenu).not.toHaveBeenCalled();
  });

  it("still handles the pre-existing bindings", () => {
    const opts = setup();
    press("Escape");
    expect(opts.onClose).toHaveBeenCalled();
    press("a");
    expect(opts.onAddAction).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec vitest run tests/client/features/automation/useWorkflowKeyboard.test.ts
```

Expected: FAIL — `onOpenContextMenu` is never called (the binding does not exist yet).

- [ ] **Step 3: Add the keyboard binding**

In `useWorkflowKeyboard.ts`, add `onOpenContextMenu: () => void;` to `UseWorkflowKeyboardOptions`, destructure it in the hook signature, and insert this branch immediately after the `Escape` branch (so it sits inside the handler, after the input guard has already returned for text fields):

```ts
      if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
        e.preventDefault();
        onOpenContextMenu();
        return;
      }
```

Add `onOpenContextMenu` to the `useCallback` dependency array.

- [ ] **Step 4: Run the test to verify it passes**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec vitest run tests/client/features/automation/useWorkflowKeyboard.test.ts
```

Expected: PASS — every test in the file green.

- [ ] **Step 5: Write the menu state hook**

`apps/dashboard/src/client/features/automation/workflow/contextMenu/useWorkflowContextMenu.ts`:

```ts
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
  const { screenToFlowPosition } = useReactFlow();

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
      const labelled = nodeEl.querySelector("[role='group']");
      setMenu({
        target: { kind: "node", nodeId: nodeEl.dataset.id },
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        label: labelled?.getAttribute("aria-label") ?? undefined,
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
  }, [screenToFlowPosition]);

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
```

- [ ] **Step 6: Typecheck**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec tsc -p tsconfig.client.json --noEmit
```

Expected: FAIL with one error — `WorkflowEditor.tsx` does not pass the now-required `onOpenContextMenu` to `useWorkflowKeyboard`. Task 5 fixes it. Do not add a temporary stub; commit with the known break and resolve it in the next task.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/client/features/automation/workflow/contextMenu/useWorkflowContextMenu.ts \
        apps/dashboard/src/client/features/automation/workflow/useWorkflowKeyboard.ts \
        apps/dashboard/tests/client/features/automation/useWorkflowKeyboard.test.ts
git commit -m "feat(automation): context menu state and Shift+F10 opener"
```

---

## Task 5: Wire it into the editor

**Files:**
- Modify: `apps/dashboard/src/client/features/automation/workflow/WorkflowEditor.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 1–4.
- Produces: no new exports. Ends with the client typecheck and the full dashboard suite green.

- [ ] **Step 1: Add the imports**

```ts
import { useWorkflowContextMenu } from "./contextMenu/useWorkflowContextMenu";
import { WorkflowContextMenu } from "./contextMenu/WorkflowContextMenu";
import { buildContextMenuItems, parseNodeId } from "./contextMenu/buildItems";
```

- [ ] **Step 2: Pull the new operations out of `useWorkflowSteps`**

Extend the existing destructure with:

```ts
    duplicateNode,
    disconnectNode,
    setAsStart,
    snapshot,
    restore,
```

- [ ] **Step 3: Add the position-override map**

Next to `reactFlowInstance`:

```ts
  /**
   * Positions for nodes the user created at a specific spot (context-menu adds
   * and duplicates). Consumed by the node-sync effect the first time the node
   * appears, then cleaned up once it is part of `nodes`.
   */
  const pendingPositionsRef = useRef(new Map<string, { x: number; y: number }>());
```

Change the node-sync effect to consult it. The read must stay pure — React may invoke a state updater twice — so entries are deleted in a separate effect, not inside the updater:

```ts
  useEffect(() => {
    setNodes((prev) => {
      const posMap = new Map(prev.map((n) => [n.id, n.position]));
      return computedNodes.map((n) => ({
        ...n,
        position: posMap.get(n.id) ?? pendingPositionsRef.current.get(n.id) ?? n.position,
      }));
    });
  }, [computedNodes, setNodes]);

  // Once a pending position has been applied, the node carries it in `nodes`;
  // drop the entry so a recycled node id cannot inherit a stale position.
  useEffect(() => {
    for (const node of nodes) pendingPositionsRef.current.delete(node.id);
  }, [nodes]);
```

- [ ] **Step 4: Add the menu state and the handlers**

After `useWorkflowKeyboard`'s existing callbacks (`handleActionReset` and friends) and before the `useWorkflowKeyboard` call:

```ts
  const contextMenu = useWorkflowContextMenu();

  const addAt = useCallback(
    (add: () => string | null, position?: { x: number; y: number }) => {
      const nodeId = add();
      // No position (the trigger menu's plain "Add action") → auto-layout decides.
      if (nodeId && position) pendingPositionsRef.current.set(nodeId, position);
    },
    [],
  );

  const handleContextConfigure = useCallback((nodeId: string) => {
    const parsed = parseNodeId(nodeId);
    if (!parsed) return;
    if (parsed.kind === "trigger") setSelectedNode({ type: "trigger" });
    else if (parsed.kind === "action") setSelectedNode({ type: "action", index: parsed.index });
    else setSelectedNode({ type: "step", stepId: parsed.stepId });
  }, []);

  const handleContextDuplicate = useCallback((nodeId: string) => {
    const origin = nodes.find((n) => n.id === nodeId)?.position;
    const newNodeId = duplicateNode(nodeId);
    if (newNodeId && origin) {
      pendingPositionsRef.current.set(newNodeId, { x: origin.x + 40, y: origin.y + 60 });
    }
  }, [nodes, duplicateNode]);

  const handleContextMove = useCallback((nodeId: string, direction: "up" | "down") => {
    const parsed = parseNodeId(nodeId);
    if (parsed?.kind === "action") handleActionMove(parsed.index, direction);
  }, [handleActionMove]);

  const handleContextDelete = useCallback((nodeId: string) => {
    const parsed = parseNodeId(nodeId);
    if (!parsed || parsed.kind === "trigger") return;
    const snap = snapshot();
    if (parsed.kind === "action") {
      if (actions.length > 1) handleActionRemove(parsed.index);
      else handleActionReset(parsed.index);
    } else {
      handleStepRemove(parsed.stepId);
    }
    toast.success(t("contextMenu.nodeDeleted"), {
      action: {
        label: t("common:actions.undo"),
        onClick: () => restore(snap),
      },
    });
  }, [snapshot, restore, actions.length, handleActionRemove, handleActionReset, handleStepRemove, t]);

  const handleContextDeleteEdge = useCallback((edgeId: string) => {
    onEdgesChange([{ id: edgeId, type: "remove" }]);
  }, [onEdgesChange]);

  const contextSections = useMemo(() => {
    if (!contextMenu.menu || !constants) return [];
    return buildContextMenuItems(contextMenu.menu.target, {
      isStepMode,
      actions,
      maxActions: constants.maxActionsPerRule,
      steps,
      entryStepId,
      handlers: {
        onConfigure: handleContextConfigure,
        onDuplicate: handleContextDuplicate,
        onMove: handleContextMove,
        onSetAsStart: setAsStart,
        onDisconnect: disconnectNode,
        onDelete: handleContextDelete,
        onDeleteEdge: handleContextDeleteEdge,
        onAddAction: (position) => addAt(addAction, position),
        onAddCondition: (position) => addAt(addConditionStep, position),
        onAddDelay: (position) => addAt(addDelayStep, position),
        onFitView: handleFitView,
      },
    });
  }, [
    contextMenu.menu, constants, isStepMode, actions, steps, entryStepId,
    handleContextConfigure, handleContextDuplicate, handleContextMove,
    setAsStart, disconnectNode, handleContextDelete, handleContextDeleteEdge,
    addAt, addAction, addConditionStep, addDelayStep, handleFitView,
  ]);

  const contextMenuAriaLabel = useMemo(() => {
    const menu = contextMenu.menu;
    if (!menu) return "";
    if (menu.target.kind === "node") {
      return t("contextMenu.menuLabel", { label: menu.label ?? "" });
    }
    if (menu.target.kind === "edge") return t("contextMenu.edgeMenuLabel");
    return t("contextMenu.paneMenuLabel");
  }, [contextMenu.menu, t]);
```

`handleContextDeleteEdge` reuses the editor's own `onEdgesChange`, so an edge deleted from the menu takes the identical path — including the linear-mode `convertAndSeverEdges` conversion — as one deleted with `Del`.

- [ ] **Step 5: Pass the keyboard opener**

Add to the `useWorkflowKeyboard({ ... })` call:

```ts
    onOpenContextMenu: contextMenu.openFromKeyboard,
```

- [ ] **Step 6: Highlight the target node without opening the panel**

`selectedNode` drives `NodeDetailPanel`, so it must not be set on right-click. Feed the ring through the existing `selectedNodeId` argument instead — change the `useWorkflowNodes` call:

```ts
    selectedNodeId: selectedNodeId ?? contextMenu.contextMenuNodeId,
```

- [ ] **Step 7: Wire the React Flow handlers and render the menu**

Add to the `<ReactFlow>` props:

```tsx
          onNodeContextMenu={contextMenu.openNodeMenu}
          onEdgeContextMenu={contextMenu.openEdgeMenu}
          onPaneContextMenu={contextMenu.openPaneMenu}
```

And render the menu just after `</ReactFlow>`, inside the canvas container:

```tsx
        {contextMenu.menu && (
          <WorkflowContextMenu
            open
            x={contextMenu.menu.x}
            y={contextMenu.menu.y}
            ariaLabel={contextMenuAriaLabel}
            sections={contextSections}
            onClose={contextMenu.close}
          />
        )}
```

- [ ] **Step 8: Typecheck**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec tsc -p tsconfig.client.json --noEmit
```

Expected: exit 0 — this also clears the break Task 4 left behind.

- [ ] **Step 9: Run the whole dashboard suite**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec vitest run
```

Expected: PASS. One pre-existing failure is known and unrelated: `tests/server/auth/routes.test.ts` asserts `SameSite=Strict` while the code correctly sends `Lax`. Do not fix it here. Every other test must pass.

- [ ] **Step 10: Commit**

```bash
git add apps/dashboard/src/client/features/automation/workflow/WorkflowEditor.tsx
git commit -m "feat(automation): right-click menus on canvas nodes, edges, and pane"
```

---

## Task 6: Translations

**Files:**
- Modify: `packages/i18n/src/locales/<lang>/rules.json` (48 files)
- Modify: `packages/i18n/dist/locales/<lang>/rules.json` (48 files)

**Interfaces:**
- Consumes: the `labelKey` values emitted by `buildItems.ts` (Task 1) and the toast keys used in `WorkflowEditor` (Task 5).
- Produces: a `contextMenu` object at the top level of the `rules` namespace in every locale.

**Already translated — reused as-is, do not duplicate:** `rules:ruleList.duplicate`, `rules:panel.moveUp`, `rules:panel.moveDown`, `rules:panel.removeAction`, `rules:panel.removeStep`, `rules:editor.fitToView`, `common:actions.undo`.

**The 13 new keys.** English source of truth:

```json
{
  "configure": "Configure",
  "configureTrigger": "Configure trigger",
  "addAction": "Add action",
  "addActionHere": "Add action here",
  "addConditionHere": "Add condition here",
  "addDelayHere": "Add delay here",
  "setAsStart": "Set as start",
  "disconnect": "Disconnect",
  "deleteConnection": "Delete connection",
  "nodeDeleted": "Step deleted",
  "menuLabel": "Actions for {{label}}",
  "paneMenuLabel": "Canvas actions",
  "edgeMenuLabel": "Connection actions"
}
```

`menuLabel` interpolates a node label, not a count, so no plural categories are involved.

- [ ] **Step 1: Write the insertion script**

Create `/tmp/insert-context-menu.py` (a throwaway, not committed). It inserts a top-level `contextMenu` key immediately after the opening brace of each file. Inserting text rather than re-serialising is required: `th` is semi-compact and 17 locales use `\u` escapes, so a `json.dump` round-trip would rewrite unrelated lines.

```python
import json, pathlib, sys

# lang -> {key: translation}
TRANSLATIONS = json.load(open("/tmp/context-menu-translations.json", encoding="utf-8"))

roots = [pathlib.Path("packages/i18n/src/locales"), pathlib.Path("packages/i18n/dist/locales")]
missing = []

for root in roots:
    for lang_dir in sorted(root.iterdir()):
        lang = lang_dir.name
        path = lang_dir / "rules.json"
        if not path.exists():
            missing.append(str(path))
            continue
        raw = path.read_text(encoding="utf-8")
        if '"contextMenu"' in raw:
            print(f"skip (already present): {path}")
            continue
        block = TRANSLATIONS.get(lang)
        if block is None:
            missing.append(f"no translations for {lang}")
            continue
        body = json.dumps(block, ensure_ascii=False, indent=2).replace("\n", "\n  ")
        insert = f'\n  "contextMenu": {body},'
        brace = raw.index("{")
        path.write_text(raw[: brace + 1] + insert + raw[brace + 1 :], encoding="utf-8")
        json.loads(path.read_text(encoding="utf-8"))  # fail loudly on malformed output

if missing:
    print("PROBLEMS:", *missing, sep="\n  ")
    sys.exit(1)
print("done")
```

- [ ] **Step 2: Write the translations file**

Create `/tmp/context-menu-translations.json`: an object keyed by each of the 48 locale directory names under `packages/i18n/src/locales`, each mapping to all 13 keys.

Rules:
- Every locale gets a real translation. English strings in a non-English locale are a defect, not a fallback.
- Match the tone and terminology already used in that locale's `rules.json` — reuse the words it already uses for "step", "action", "condition", "delay", "connection", and "canvas".
- Keep the `{{label}}` placeholder verbatim in `menuLabel`.
- RTL locales (`ar`, `fa`, `he`, `ur`) need no directional markers; the UI handles direction.

Enumerate the locales first:

```bash
ls packages/i18n/src/locales
```

- [ ] **Step 3: Run the insertion**

```bash
python3 /tmp/insert-context-menu.py
```

Expected: `done`, with no `PROBLEMS` block.

- [ ] **Step 4: Verify no existing content was touched**

```bash
git diff --numstat packages/i18n | awk '$2 != 0 { print "DELETIONS in " $3; bad=1 } END { if (bad) exit 1; print "no deletions" }'
git diff --numstat packages/i18n | wc -l
```

Expected: `no deletions`, and 96 changed files.

- [ ] **Step 5: Verify key parity and valid JSON across all locales**

```bash
python3 - <<'PY'
import json, pathlib, sys
KEYS = {"configure","configureTrigger","addAction","addActionHere","addConditionHere",
        "addDelayHere","setAsStart","disconnect","deleteConnection","nodeDeleted",
        "menuLabel","paneMenuLabel","edgeMenuLabel"}
en = json.load(open("packages/i18n/src/locales/en/rules.json", encoding="utf-8"))["contextMenu"]
bad = []
for root in ("src", "dist"):
    base = pathlib.Path(f"packages/i18n/{root}/locales")
    for lang_dir in sorted(base.iterdir()):
        data = json.load(open(lang_dir / "rules.json", encoding="utf-8"))
        cm = data.get("contextMenu")
        if cm is None:
            bad.append(f"{root}/{lang_dir.name}: missing contextMenu"); continue
        if set(cm) != KEYS:
            bad.append(f"{root}/{lang_dir.name}: key mismatch {set(KEYS) ^ set(cm)}")
        if "{{label}}" not in cm.get("menuLabel", ""):
            bad.append(f"{root}/{lang_dir.name}: menuLabel lost its placeholder")
        if lang_dir.name != "en" and cm == en:
            bad.append(f"{root}/{lang_dir.name}: untranslated (identical to English)")
print("\n".join(bad) if bad else "all 48 locales OK in src and dist")
sys.exit(1 if bad else 0)
PY
```

Expected: `all 48 locales OK in src and dist`, exit 0.

- [ ] **Step 6: Confirm src and dist agree**

```bash
diff -r packages/i18n/src/locales packages/i18n/dist/locales && echo "src and dist identical"
```

Expected: `src and dist identical`. If they differ for reasons predating this change, only the `rules.json` files must match; investigate anything else before continuing.

- [ ] **Step 7: Run the full dashboard suite once more**

```bash
docker run --rm -v "$PWD/apps/dashboard/src:/app/apps/dashboard/src" -v "$PWD/apps/dashboard/tests:/app/apps/dashboard/tests" -w /app/apps/dashboard fluxcore-bot:latest pnpm exec vitest run
```

Expected: PASS, with only the known pre-existing `auth/routes.test.ts` SameSite failure.

- [ ] **Step 8: Commit**

```bash
git add packages/i18n/src/locales packages/i18n/dist/locales
git commit -m "i18n(rules): translate the canvas context menu in all 48 locales"
```

---

## Manual verification

Not a substitute for the tests, but worth one pass before opening a PR. The dev stack needs `.env.dev`, which lives only in the main checkout, so run this from the main checkout after merging, or copy the file in yourself.

1. `pnpm dev:dashboard`, open a guild → Automation → edit a rule → the workflow canvas.
2. Right-click an action node: the menu appears at the cursor, the node gets its selection ring, and the detail panel stays closed.
3. Choose Duplicate: a copy appears just below-right, wired to nothing.
4. Right-click empty canvas → Add condition here: the condition node lands where you clicked.
5. Right-click a node → Delete: the node disappears and a toast offers Undo; clicking Undo restores the node *and* its connections.
6. Right-click an edge → Delete connection: the edge disappears.
7. Tab to a node, press Shift+F10: the same menu opens anchored to the node; arrow keys move through it; Esc closes it and focus returns to the node.
8. Switch the dashboard to Arabic: the menu's text and item layout follow RTL while the canvas itself stays LTR.
