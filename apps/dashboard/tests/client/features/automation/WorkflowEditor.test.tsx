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

function renderEditor(draft?: RuleDraft) {
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
      <WorkflowEditor draft={draft} onClose={() => {}} />
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

    // NB: closing the menu also opens NodeDetailPanel — a separate, pre-existing
    // defect, reproduced on this branch's HEAD before any of these fixes and on
    // both the mouse and keyboard paths. This test deliberately says nothing
    // about the panel: the assertion below is about focus alone and holds
    // either way. Do not read the panel's presence here as intended behaviour.
    //
    // Radix's DropdownMenu returns focus to its trigger, which here is the 0×0
    // aria-hidden anchor span — it cannot hold focus, so without our
    // onCloseAutoFocus this lands on <body> and the keyboard user loses their
    // place. FocusScope dispatches the restoration from a setTimeout(0), hence
    // waitFor rather than a bare assertion.
    await waitFor(() => expect(document.activeElement).toBe(node));
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
