// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
});

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
