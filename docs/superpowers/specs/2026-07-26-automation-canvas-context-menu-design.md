# Automation Canvas Context Menu — Design

**Date:** 2026-07-26
**Branch:** `worktree-feat+automation-canvas-context-menu`
**Status:** Approved

## Problem

The workflow canvas in `WorkflowEditor` exposes every operation through either the top toolbar or the
node detail panel. Adding a step always appends it to the auto-layout, reordering is keyboard-only,
and there is no way to duplicate a step, re-point the trigger, or detach a node from its neighbours
without editing each connection by hand.

Right-click is the expected gesture on a node canvas. This design adds context menus for the three
things a user can right-click — a node, an edge, and the empty pane — and, along the way, adds the
four verbs the canvas is missing: **duplicate**, **add at cursor**, **set as start**, and
**disconnect**.

## Non-goals

- Copy/paste between rules
- Multi-select operations
- Submenus
- Changing a node's type in place
- General undo/redo (the delete Undo toast is the only undo introduced)

## Approach

### Primitive: reuse `dropdown-menu`, do not add `@radix-ui/react-context-menu`

The menu is a **controlled `DropdownMenu`** anchored to a zero-size `position: fixed` element placed
at the cursor coordinates.

```tsx
<DropdownMenu open={menu !== null} onOpenChange={(open) => !open && close()}>
  <DropdownMenuTrigger asChild>
    <span aria-hidden style={{ position: "fixed", left: menu.x, top: menu.y, width: 0, height: 0 }} />
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start" dir={i18n.dir()} aria-label={menuLabel}>
    {items.map(renderItem)}
  </DropdownMenuContent>
</DropdownMenu>
```

Rationale:

- No new dependency, so no `pnpm add` inside Docker plus a `pnpm-lock.yaml` regeneration, which this
  repo has documented friction around.
- Radix `ContextMenu` wraps a *single* trigger element. On a React Flow canvas the interesting
  question is *which* thing was right-clicked; React Flow already answers that through
  `onNodeContextMenu` / `onEdgeContextMenu` / `onPaneContextMenu`, so the wrapper buys nothing and we
  would still discriminate the target by hand.
- Consistent with the repo's standing preference to reuse an existing shared primitive
  (cf. `SearchableSelect`) rather than pull in a new one.

Styling, keyboard navigation, typeahead, `Esc`, dismiss-on-outside-click, portalling, and focus
restoration all come from the existing `dropdown-menu` wrapper for free.

### File layout

`WorkflowEditor.tsx` is already 715 lines, so the feature lives in its own folder rather than inline:

| File | Responsibility |
| --- | --- |
| `workflow/contextMenu/types.ts` | `ContextMenuTarget`, `ContextMenuItem`, `ContextMenuSection` types |
| `workflow/contextMenu/buildItems.ts` | Pure `buildContextMenuItems(target, ctx) → ContextMenuSection[]` — all branching lives here |
| `workflow/contextMenu/useWorkflowContextMenu.ts` | Menu state, the React Flow openers, the keyboard opener, `close()` |
| `workflow/contextMenu/WorkflowContextMenu.tsx` | Dumb renderer: controlled `DropdownMenu` + cursor anchor |

```ts
export type ContextMenuTarget =
  | { kind: "node"; nodeId: string }
  | { kind: "edge"; edgeId: string }
  | { kind: "pane"; flowPosition: { x: number; y: number } };

export interface ContextMenuItem {
  id: string;
  labelKey: string;          // i18n key, resolved by the renderer
  icon: string;              // Icon.tsx name
  shortcut?: string;         // display-only, e.g. "Ctrl+↑"
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

export type ContextMenuSection = ContextMenuItem[];   // sections render separated
```

`buildContextMenuItems` returns `ContextMenuSection[]` so the separator positions are data, not
markup. It is pure — no React, no i18n resolution, no DOM — which makes every branch directly
unit-testable.

`WorkflowEditor` wires the three React Flow handlers to the hook's openers and renders
`<WorkflowContextMenu />` inside the canvas container.

### Data flow

No new persistent state. The menu only invokes handlers that already flow through
`useWorkflowSteps` → `actions` / `steps` state → `useWorkflowNodes` recompute → React Flow. Two
mechanical changes to existing code enable cursor placement:

1. `addAction`, `addConditionStep`, `addDelayStep` (and the new `duplicateStep`) **return the created
   node id** (`string | null`) instead of `void`. Existing callers ignore the return value, so this is
   source-compatible.
2. `WorkflowEditor` keeps `pendingPositionsRef: MutableRefObject<Map<string, {x, y}>>`. The existing
   node-sync effect becomes:

   ```ts
   position: posMap.get(n.id) ?? consumePendingPosition(n.id) ?? n.position
   ```

   A newly created node is absent from `prev`, so the override applies on its first sync and is then
   deleted from the map; from the next sync onward the node is in `prev` and behaves like any
   user-dragged node. An empty map leaves the effect behaving exactly as it does today.

### Layering

The editor portals to `document.body` at `z-50`, and so does `DropdownMenuContent`. The menu mounts
later in DOM order, so it paints above the editor. This is asserted in the component test rather than
assumed.

## Menu contents

| Target | Items (`·` separates items, `───` a separator) |
| --- | --- |
| **Trigger node** | Configure trigger · Add action |
| **Action node** | Configure · Duplicate · Move up `Ctrl+↑` · Move down `Ctrl+↓` *(linear mode only)* · Set as start · Disconnect · ─── · Delete `Del` |
| **Condition node** | Configure · Duplicate · Set as start · Disconnect · ─── · Delete `Del` |
| **Delay node** | Configure · Duplicate · Set as start · Disconnect · ─── · Delete `Del` |
| **Pane** | Add action here · Add condition here · Add delay here · ─── · Fit to view `Ctrl+Shift+F` |
| **Edge** | Delete connection |

### Disabled rules

| Item | Disabled when |
| --- | --- |
| Add action here / Duplicate | linear mode and `actions.length >= constants.maxActionsPerRule` |
| Move up | linear mode and `index === 0` |
| Move down | linear mode and `index === actions.length - 1` |
| Set as start | the node is already the entry (`entryStepId`, or `action-0` in linear mode) |
| Disconnect | the node has no incoming and no outgoing connection |
| Set as start / Disconnect | linear mode and the action has no type — `convertToStepMode()` drops unconfigured actions, so there is no step for these verbs to point at |

Disabled items stay visible and are rendered through `DropdownMenuItem`'s `disabled` prop, which
Radix already styles at 50% opacity and skips during arrow-key navigation.

### Icons

All names resolve through the existing `Icon.tsx` map: `tune` (configure), `content_copy`
(duplicate), `arrow_upward` / `arrow_downward` (move), `play_arrow` (set as start), `delete`,
`add`, `call_split`, `schedule`, `fit_screen`.

`Icon.tsx` has no name for *disconnect*; add one mapping — `link_off` → Lucide `Unlink`. Per the
earlier a11y audit, Lucide icons are never filled.

## Behaviour

- **Right-click highlights, it does not select.** `selectedNode` drives the `NodeDetailPanel`, so
  setting it on right-click would slide the panel open underneath the menu — the panel would fight
  the menu for attention on every right-click. Instead the hook exposes `contextMenuNodeId`, and the
  editor passes `selectedNodeId ?? contextMenuNodeId` to `useWorkflowNodes`. The node gets the
  existing selected ring for as long as the menu is open, with no change to `useWorkflowNodes` and no
  panel. `Configure` is the item that sets `selectedNode` and opens the panel.
  Right-clicking the pane does *not* clear the selection (unlike left-click, which does).
- **Duplicate keeps the current mode.**
  - Linear mode: splice a structural copy of the `ActionConfig` in at `index + 1`. No position
    override — the linear layout is deterministic and index-keyed ids shift on insert.
  - Step mode: create a step with a fresh id from `nextStepId()`, a deep copy of the payload, and
    `next` / `thenNext` / `elseNext` set to `null`. It is a floating node; the position override
    places it at the original's position offset by `(+40, +60)`.
  - A duplicate never inherits the original's wiring, and never becomes the entry step.
- **Set as start and Disconnect force the step graph.** Both are graph-only concepts, so on a legacy
  linear rule they run `convertToStepMode()` first — silently, exactly as dragging a connection
  already does today.
- **Disconnect** clears the node's outgoing links (`next`, or `thenNext` *and* `elseNext` for a
  condition), rewrites every step pointing *at* it to `null`, and clears `entryStepId` if it was the
  entry. Unlike delete, the node survives as a floating node.
- **Delete on the last remaining linear action resets it to empty** rather than removing it, matching
  the current `Del`-key rule in `useWorkflowKeyboard`. The Undo toast still appears and restores the
  action's previous configuration — a reset discards a configured action just as destructively as a
  removal does.
- **Delete uses an Undo toast, not a modal.** Before removing, snapshot `{ actions, steps,
  entryStepId }`; remove; then `toast.success(t("contextMenu.nodeDeleted"), { action: { label:
  t("common:actions.undo"), onClick: restore } })`. This matches the rule-list delete pattern already
  in the codebase and avoids a modal interrupting canvas work. The snapshot restores the neighbour
  rewiring that `handleStepRemove` performs, which a naive re-add would lose.
- **Edge delete** routes through the existing `handleEdgeRemoval` / `convertAndSeverEdges` path, so
  it behaves identically to selecting an edge and pressing `Del`. No confirm, no Undo — re-dragging
  the connection is trivial.

## Keyboard and accessibility

`useWorkflowKeyboard` gains one branch: `Shift+F10` or the dedicated `ContextMenu` key opens the menu
for whatever currently has focus.

- A focused node element (`document.activeElement` matching `.react-flow__node`) opens the node menu
  anchored to its `getBoundingClientRect()`.
- Anything else opens the pane menu at the canvas centre, with the corresponding flow position
  derived through `screenToFlowPosition`.
- The existing `INPUT` / `TEXTAREA` / `SELECT` guard applies unchanged.

Radix then owns arrow-key navigation, typeahead, `Esc`, and focus restoration; none of that is
hand-rolled.

Additional a11y details:

- `DropdownMenuContent` gets `dir={i18n.dir()}`. The canvas container is force-`dir="ltr"` for React
  Flow's sake, so the menu must opt back into the document direction or RTL locales lay out wrongly.
- `DropdownMenuContent` gets an `aria-label` naming its target, e.g. *"Actions for Send message"*, so
  the menu is self-describing to a screen reader that did not see the pointer.
- The anchor element is `aria-hidden` — it exists only to position the popper.
- Destructive items pair `text-danger` with a trash icon rather than relying on colour alone.

## i18n

Reuses `rules:editor.addAction`, `addCondition`, `addDelay`, `fitToView` and `common:actions.delete`
where they already exist. New keys under `rules:contextMenu.*`:

`configure`, `configureTrigger`, `duplicate`, `moveUp`, `moveDown`, `setAsStart`, `disconnect`,
`deleteNode`, `deleteConnection`, `addActionHere`, `addConditionHere`, `addDelayHere`, `nodeDeleted`,
`menuLabel` (interpolates the node label).

Plus `common:actions.undo` if it is not already present.

Per the repo's i18n rules, all keys are translated in **all 48 locales up front** — English
placeholders are treated as unfinished work — and written to **both** `packages/i18n/src/locales/`
and `packages/i18n/dist/locales/`, because the running app serves `dist`. `menuLabel` interpolates a
node label, not a count, so no plural categories are involved.

## Testing

All four are required by the repo's mandatory-tests rule.

1. **`tests/client/features/automation/contextMenu/buildItems.test.ts`** — pure function:
   which item ids appear per target kind and per mode; the trigger menu has no Delete; every disabled
   rule from the table above; condition and delay menus omit Move up/down.
2. **`tests/client/features/automation/contextMenu/WorkflowContextMenu.test.tsx`** — RTL: labels and
   shortcuts render; selecting an item fires its `onSelect` and closes the menu; a disabled item does
   not fire; `Esc` closes; the content renders above the editor layer.
3. **`tests/client/features/automation/useWorkflowSteps.test.ts`** (new file) — `renderHook`:
   duplicate in both modes (including the `maxActionsPerRule` ceiling and the null-wiring guarantee);
   disconnect clearing incoming, outgoing, and entry; `setAsStart` converting a linear rule; and the
   delete snapshot/undo restoring `steps` + `entryStepId` including neighbour rewiring.
4. **`useWorkflowKeyboard`** — `Shift+F10` and `ContextMenu` open the menu with the correct target,
   and both stay inert while focus is in a text input.

## Housekeeping

`.claude/worktrees/` is not in `.gitignore`, so worktrees created by the harness show up as untracked
in `git status`. Add the line in this branch.

## Risks

- **Position-override lifetime.** If a computed node id changes between the add and the first sync,
  the override is orphaned. Mitigated by consuming entries on first use and by keying on the id the
  `add*` helper returns rather than on a reconstructed one.
- **Linear-mode index churn.** Duplicating in linear mode shifts `action-N` ids, so any positions the
  user dragged for later nodes shift with them. This is pre-existing behaviour for insert/remove/move
  and is not addressed here.
- **Silent mode conversion.** Set as start and Disconnect can flip a rule from linear to step mode
  with no visible announcement. Consistent with the existing connect-drag behaviour, but worth
  revisiting if users report confusion.
