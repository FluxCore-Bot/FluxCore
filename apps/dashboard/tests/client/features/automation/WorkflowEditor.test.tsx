// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkflowEditor, type RuleDraft } from "../../../../src/client/features/automation/workflow/WorkflowEditor";
import type { Constants } from "../../../../src/client/shared/lib/schemas";

// Passthrough translator (matches the sibling automation tests' convention).
// `t` MUST be a stable reference across renders: useWorkflowNodes memoizes
// on `input.t`, which feeds the node-sync effect that calls setNodes. A `t`
// that's a fresh function every call (as in some sibling mocks, harmless
// there) turns that into an infinite render loop here — computedNodes would
// never stabilize, so it's not a shortcut so much as a correctness
// requirement for this specific tree.
function translate(key: string, opts?: Record<string, unknown>): string {
  return opts ? `${key}:${JSON.stringify(opts)}` : key;
}
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate, i18n: { dir: () => "ltr" } }),
}));

// The delete verb hands its Undo to sonner as a toast action. The tests below
// need to invoke that Undo, so the mock records the handlers it is given
// rather than discarding them. Only our own callback is exercised this way —
// sonner's button rendering is its own contract, not this suite's subject.
const toastCapture = vi.hoisted(() => {
  const undoHandlers: Array<() => void> = [];
  return {
    undoHandlers,
    success(_message: string, options?: { action?: { label: string; onClick: () => void } }) {
      if (options?.action) undoHandlers.push(options.action.onClick);
    },
    error() {},
  };
});
vi.mock("sonner", () => ({
  toast: { success: toastCapture.success, error: toastCapture.error },
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ guildId: "123456789" }),
}));

// A complete Constants object (every field the schema declares), not a
// partial cast — NodeDetailPanel's ActionPanel reaches into
// eventTypeVariables/templateVariables too when it renders, and a shortcut
// stub would crash before the assertion below ever ran.
const constants: Constants = {
  eventTypes: { messageCreate: { label: "Message Sent", description: "" } },
  actionTypes: { sendMessage: { label: "Send Message", description: "" } },
  actionTypeFields: {},
  maxActionsPerRule: 5,
  eventTypeVariables: {},
  templateVariables: {},
};

vi.mock("../../../../src/client/shared/hooks/useConstants", () => ({
  useConstants: () => ({ data: constants }),
}));

const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();
vi.mock("../../../../src/client/features/automation/hooks/useRules", () => ({
  useCreateRule: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateRule: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));

vi.mock("../../../../src/client/features/automation/hooks/useRuleDraft", () => ({
  useRuleDraft: () => ({
    saveDraft: vi.fn(),
    loadDraft: () => null,
    clearDraft: vi.fn(),
  }),
}));

// --- jsdom polyfills @xyflow/react needs to mount for real ---
//
// This suite mounts the real <ReactFlow> tree rather than mocking
// "@xyflow/react", because the bug this file guards against lives inside the
// library's own SelectionListener (it fires onSelectionChange whenever a
// node's `selected` flag changes, regardless of why it changed). A mocked
// ReactFlow can't reproduce that — it would make the "panel stays closed"
// assertion pass unconditionally, whether or not WorkflowEditor's guard is
// present, and a test that can't fail is worse than no test.
//
// Mounting for real needs two jsdom stand-ins the library expects from a
// browser: a ResizeObserver (the pane's size-tracking effect constructs one
// unconditionally on mount), and non-zero container dimensions (without them
// ReactFlow logs its "needs a width and a height" warning on every render).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error -- test-only stand-in for a browser API jsdom lacks
global.ResizeObserver = ResizeObserverStub;
Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", { configurable: true, value: 1000 });
Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", { configurable: true, value: 800 });

beforeEach(() => {
  createMutateAsync.mockClear();
  updateMutateAsync.mockClear();
  toastCapture.undoHandlers.length = 0;
});

/** The `.react-flow__node` wrapper for an action, by its 1-based display index. */
async function findActionNode(displayIndex: number): Promise<HTMLElement> {
  // Matching on the interpolated index rather than picking by DOM order: React
  // Flow is free to reorder node elements (z-index on selection), so position
  // in the document is not a reliable identity.
  const inner = await screen.findByLabelText(
    new RegExp(`nodes\\.ariaAction:\\{"index":${displayIndex},`),
  );
  const wrapper = inner.closest<HTMLElement>(".react-flow__node");
  if (!wrapper) throw new Error(`action node ${displayIndex} has no .react-flow__node wrapper`);
  return wrapper;
}

/** Right-click a node and choose one of its context-menu items. */
async function chooseFromNodeMenu(node: HTMLElement, labelKey: string): Promise<void> {
  fireEvent.contextMenu(node, { clientX: 120, clientY: 80 });
  const item = await screen.findByRole("menuitem", { name: new RegExp(labelKey) });
  fireEvent.click(item);
}

/** The open detail panel's heading, e.g. `panel.action:{"index":1}`. */
function panelHeading(): string {
  const dialog = screen.getByRole("dialog");
  const labelledBy = dialog.getAttribute("aria-labelledby");
  const heading = labelledBy ? document.getElementById(labelledBy) : null;
  if (!heading) throw new Error("detail panel has no accessible heading");
  return heading.textContent ?? "";
}

const threeActions: RuleDraft = {
  name: "Test Rule",
  eventType: "messageCreate",
  actions: [
    { type: "sendMessage", message: "first" },
    { type: "sendMessage", message: "second" },
    { type: "sendMessage", message: "third" },
  ],
  conditions: {},
  priority: 0,
  enabled: true,
};

function renderEditor(draft?: RuleDraft, onClose: () => void = () => {}) {
  // A real QueryClient, not a mock: if the regression under test reappears
  // and NodeDetailPanel does mount, its ActionPanel calls useChannels/useRoles
  // (real react-query hooks) — without a provider that crashes with "No
  // QueryClient set" instead of failing the actual assertion below. The
  // queries themselves are irrelevant here and never need to resolve.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkflowEditor draft={draft} onClose={onClose} />
    </QueryClientProvider>,
  );
}

describe("WorkflowEditor — right-click vs. selection", () => {
  it("right-clicking a node opens the context menu and leaves NodeDetailPanel closed", async () => {
    renderEditor();

    const node = await screen.findByLabelText(/nodes\.ariaAction/);
    fireEvent.contextMenu(node, { clientX: 120, clientY: 80 });

    // The menu opened.
    expect(await screen.findByRole("menu")).toBeInTheDocument();

    // NodeDetailPanel (role="dialog") did not slide open underneath it. If
    // WorkflowEditor's guard in handleSelectionChange were removed, React
    // Flow's own SelectionListener would fire from the node's `selected: true`
    // (driven by the context-menu ring) and this would find a dialog.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("WorkflowEditor — undo after a node delete", () => {
  it("keeps rendering when undo restores fewer actions than the selection", async () => {
    // Brand-new rule: `actions` starts as a single unconfigured entry.
    renderEditor();

    // 1. Delete the only action. `actions.length > 1` is false, so this resets
    //    rather than removes — and snapshots `[{ type: "" }]`.
    await chooseFromNodeMenu(await findActionNode(1), "panel.removeAction");
    expect(toastCapture.undoHandlers).toHaveLength(1);

    // 2. `a` adds a second action.
    fireEvent.keyDown(window, { key: "a" });

    // 3. Open the detail panel on it — the selection is now index 1.
    fireEvent.click(await findActionNode(2));
    expect(panelHeading()).toContain('panel.action:{"index":2}');

    // 4. Undo. `restore` swaps `actions` back to length 1, so a selection left
    //    at index 1 renders `actions[1]` === undefined and ActionPanel throws
    //    on `action.type`. The editor is a full-screen portal with no error
    //    boundary above it, so that throw white-screens the unsaved rule.
    act(() => {
      toastCapture.undoHandlers[0]();
    });

    expect(screen.getByLabelText("editor.ruleNamePlaceholder")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("WorkflowEditor — pending positions from a context-menu duplicate", () => {
  it("places the duplicate of a NON-last action at its +40/+60 offset despite the id collision", async () => {
    // Duplicating action-0 in a three-action rule hands the copy id
    // "action-1" — an id an existing node already holds. The sync effect's
    // posMap therefore has an entry for it, and before the fix that entry
    // won: the pending +40/+60 cursor offset was dropped unapplied (and then
    // deleted by the cleanup), so the copy landed on its neighbour's spot.
    renderEditor(threeActions);

    // action-0 sits at (420, 60); the old action-1 at (420, 190).
    await chooseFromNodeMenu(await findActionNode(1), "ruleList.duplicate");

    // The copy renders as display index 2 (id "action-1") and must sit at
    // the recorded pending position, source + (40, 60) — not at (420, 190).
    const copy = await findActionNode(2);
    await waitFor(() =>
      expect(copy.style.transform).toContain("translate(460px,120px)"),
    );
  });
});

describe("WorkflowEditor — a context-menu move and the open panel", () => {
  it("leaves the selection alone when some other action moves", async () => {
    renderEditor(threeActions);

    fireEvent.click(await findActionNode(1));
    expect(panelHeading()).toContain('panel.action:{"index":1}');

    await chooseFromNodeMenu(await findActionNode(3), "panel.moveUp");

    // The third action swapped with the second; the first — the one the user
    // opened — never moved, so the panel must still be editing it.
    expect(panelHeading()).toContain('panel.action:{"index":1}');
  });

  it("follows the user's action when the moved one swaps with it", async () => {
    renderEditor(threeActions);

    fireEvent.click(await findActionNode(2));
    expect(panelHeading()).toContain('panel.action:{"index":2}');

    await chooseFromNodeMenu(await findActionNode(3), "panel.moveUp");

    // The moved action took index 1, pushing the open one down to index 2.
    // The panel follows the record the user opened, not the one that moved.
    expect(panelHeading()).toContain('panel.action:{"index":3}');
  });

  it("does not follow a move that never happened", async () => {
    renderEditor(threeActions);

    fireEvent.click(await findActionNode(1));
    // Ctrl+↑ on the first action: the swap is out of range and is refused, so
    // a selection that followed it would point at actions[-1] and throw.
    fireEvent.keyDown(window, { key: "ArrowUp", ctrlKey: true });

    expect(panelHeading()).toContain('panel.action:{"index":1}');
  });
});

describe("WorkflowEditor — the highlight ring while the menu is open", () => {
  it("moves the ring to the right-clicked node even when a panel is open elsewhere", async () => {
    const user = userEvent.setup();
    renderEditor(threeActions);

    // Open the panel on the first action: it owns the ring.
    fireEvent.click(await findActionNode(1));
    expect(panelHeading()).toContain('panel.action:{"index":1}');
    await waitFor(() => expect(findRing(1)).toBe(true));

    // Right-click the third action. Its menu's verbs act on IT, so the ring
    // must follow the menu target — before the fix `selectedNodeId ??
    // contextMenuNodeId` let the panel selection win and node 3 never
    // highlighted.
    fireEvent.contextMenu(await findActionNode(3), { clientX: 120, clientY: 80 });
    await screen.findByRole("menu");
    await waitFor(() => expect(findRing(3)).toBe(true));
    expect(findRing(1)).toBe(false);

    // The panel selection takes the ring back once the menu closes, and the
    // panel itself never moved off the node the user opened.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(findRing(1)).toBe(true));
    expect(findRing(3)).toBe(false);
    expect(panelHeading()).toContain('panel.action:{"index":1}');
  });

  /** Whether the action node at the 1-based display index carries the ring. */
  function findRing(displayIndex: number): boolean {
    const inner = screen.getByLabelText(
      new RegExp(`nodes\\.ariaAction:\\{"index":${displayIndex},`),
    );
    const wrapper = inner.closest<HTMLElement>(".react-flow__node");
    if (!wrapper) throw new Error(`action node ${displayIndex} has no wrapper`);
    return wrapper.classList.contains("selected");
  }
});

describe("WorkflowEditor — the detail panel after the menu closes", () => {
  // The suite's first test covers the panel while the menu is *open*. These
  // cover after it closes, which is where the guard actually failed: React
  // Flow's SelectionListener re-delivers the current selection whenever
  // `onSelectionChange` changes identity, so a callback that depended on
  // `contextMenuNodeId` re-fired unguarded on close, against a `selected`
  // flag that was still stale.

  it("stays closed after Escape dismisses the menu", async () => {
    const user = userEvent.setup();
    renderEditor(threeActions);

    fireEvent.contextMenu(await findActionNode(1), { clientX: 120, clientY: 80 });
    await screen.findByRole("menu");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays closed after an ordinary menu item runs", async () => {
    renderEditor(threeActions);

    // Duplicate is representative of the verbs that act on the graph without
    // any claim on the panel. Configure is the one item that *should* open it,
    // and is covered separately below.
    await chooseFromNodeMenu(await findActionNode(1), "ruleList.duplicate");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("still opens when the menu's Configure item asks for it", async () => {
    renderEditor(threeActions);

    await chooseFromNodeMenu(await findActionNode(1), "contextMenu.configure");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(panelHeading()).toContain('panel.action:{"index":1}');
  });

  it("still opens when a node is activated from the keyboard", async () => {
    // The guard must not suppress a genuine selection change. Mouse clicks
    // reach the panel through onNodeClick and would pass regardless, so this
    // drives the path that goes through the selection listener itself:
    // React Flow selects a focused node on Enter.
    renderEditor(threeActions);

    const node = await findActionNode(2);
    node.focus();
    fireEvent.keyDown(node, { key: "Enter" });

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(panelHeading()).toContain('panel.action:{"index":2}');
  });
});

describe("WorkflowEditor — hotkeys while the context menu is open", () => {
  // Radix's dismissable layer preventDefault()s the keys it handles but does
  // not stop their propagation, so they still reach the editor's window
  // keydown listener. The hotkey layer must stand down for as long as the
  // menu is open — a keyboard user pressing Escape over the menu would
  // otherwise close the whole editor and lose unsaved edits (drafts only
  // reload for new rules).

  it("Escape closes only the menu, never the editor — and works again after", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderEditor(threeActions, onClose);

    const node = await findActionNode(1);
    node.focus();
    fireEvent.keyDown(window, { key: "F10", shiftKey: true });
    await screen.findByRole("menu");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();

    // Once the menu is gone the layer resumes: the next Escape (nothing
    // selected, no panel) is the editor's own close binding again.
    await waitFor(() => expect(document.activeElement).toBe(node));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a bare \"a\" is Radix typeahead, not the add-action hotkey", async () => {
    renderEditor(threeActions);

    fireEvent.contextMenu(await findActionNode(1), { clientX: 120, clientY: 80 });
    await screen.findByRole("menu");

    fireEvent.keyDown(window, { key: "a" });

    // Still exactly three action nodes — nothing was added behind the menu.
    expect(screen.getAllByLabelText(/nodes\.ariaAction:/)).toHaveLength(3);
  });

  it("a second Shift+F10 while open leaves the single menu in place", async () => {
    renderEditor(threeActions);

    const node = await findActionNode(1);
    node.focus();
    fireEvent.keyDown(window, { key: "F10", shiftKey: true });
    await screen.findByRole("menu");

    // Were this to re-fire openFromKeyboard, captureOrigin would re-capture
    // whatever Radix has focused — a menu item that unmounts on close —
    // silently losing focus restoration to the node.
    fireEvent.keyDown(window, { key: "F10", shiftKey: true });
    expect(screen.getAllByRole("menu")).toHaveLength(1);
  });
});

describe("WorkflowEditor — context menu focus restoration", () => {
  it("returns focus to the node after Escape closes a keyboard-opened menu", async () => {
    const user = userEvent.setup();
    renderEditor(threeActions);

    const node = await findActionNode(1);
    node.focus();
    expect(document.activeElement).toBe(node);

    fireEvent.keyDown(window, { key: "F10", shiftKey: true });
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    // Radix pulled focus into the menu, so the assertion below is about a real
    // restoration rather than focus that simply never left.
    expect(document.activeElement).not.toBe(node);

    await user.keyboard("{Escape}");

    // Radix's DropdownMenu returns focus to its trigger, which here is the 0×0
    // aria-hidden anchor span — it cannot hold focus, so without our
    // onCloseAutoFocus this lands on <body> and the keyboard user loses their
    // place. FocusScope dispatches the restoration from a setTimeout(0), hence
    // waitFor rather than a bare assertion.
    await waitFor(() => expect(document.activeElement).toBe(node));

    // And the dismissal stayed a dismissal: NodeDetailPanel must not slide
    // open uninvited on the keyboard path either — the mouse path is covered
    // above ("stays closed after Escape dismisses the menu"). Asserted after
    // the focus restoration has settled so a late-arriving panel can't sneak
    // past the check.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("WorkflowEditor — Ctrl+S does not bypass validation", () => {
  it("does not submit an entry-less step graph", () => {
    // Name and event type are both filled in, and the one step is fully
    // configured — every check inside handleSubmit *before* the
    // validation.valid guard (atLeastOneAction, RuleFormSchema.safeParse,
    // which treats entryStepId as optional) would let this payload through.
    // Only the noEntryStep validation issue makes it invalid, so this
    // isolates the guard under review rather than tripping over an earlier,
    // unrelated early return — a draft with a blank name would "pass" this
    // test even without the guard, for the wrong reason.
    renderEditor({
      name: "Test Rule",
      eventType: "messageCreate",
      actions: [],
      steps: [{ id: "step_0", type: "action", action: { type: "sendMessage", message: "hi" }, next: null }],
      conditions: {},
      priority: 0,
      enabled: true,
    });

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    expect(createMutateAsync).not.toHaveBeenCalled();
    expect(updateMutateAsync).not.toHaveBeenCalled();
  });
});


/**
 * The autosave effect wrote a draft for EVERY editor session, including one
 * opened on an existing rule — but `loadDraft` is only consulted for new
 * rules. So editing a rule and closing lost the edits outright, while the
 * unread draft sat in localStorage until it expired.
 */
describe("WorkflowEditor — closing with unsaved changes", () => {
  it("asks before discarding edits", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderEditor(threeActions, onClose);

    const nameField = await screen.findByLabelText(/editor\.ruleNamePlaceholder/);
    await user.type(nameField, "X");

    await user.click(screen.getByRole("button", { name: /editor\.backToRules/ }));

    // A confirmation stands between the click and the close. ConfirmDialog is
    // a Radix Dialog (role="dialog"), same as NodeDetailPanel, so assert on
    // its title rather than the role.
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByText("editor.discardChangesTitle")).toBeInTheDocument();
  });

  it("closes once discarding is confirmed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderEditor(threeActions, onClose);

    const nameField = await screen.findByLabelText(/editor\.ruleNamePlaceholder/);
    await user.type(nameField, "X");
    await user.click(screen.getByRole("button", { name: /editor\.backToRules/ }));
    await user.click(await screen.findByRole("button", { name: /editor\.discardChanges/ }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("closes straight away when nothing has been touched", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderEditor(threeActions, onClose);

    await screen.findByLabelText(/editor\.ruleNamePlaceholder/);
    await user.click(screen.getByRole("button", { name: /editor\.backToRules/ }));

    expect(screen.queryByText("editor.discardChangesTitle")).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
