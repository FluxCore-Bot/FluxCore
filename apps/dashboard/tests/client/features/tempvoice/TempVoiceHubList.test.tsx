// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k),
  }),
}));
vi.mock("@tanstack/react-router", () => ({ useParams: () => ({ guildId: "g1" }) }));

// Captures the toast payload so the Undo action can be asserted structurally
// rather than by rendering sonner. `vi.mock` factories are hoisted above
// every top-level statement in this file (including the real `import` of
// TempVoiceHubList, which itself imports "sonner" and the hooks module) —
// so any variable a factory closes over must come from `vi.hoisted`, or the
// factory runs while that binding is still in the temporal dead zone.
//
// `deleteMutate`/`createMutate`/`updateMutate` are plain `vi.fn(async () => {})`
// by default (resolve) — individual tests override one call with
// `.mockRejectedValueOnce` to exercise the failure paths, then it reverts to
// resolving. `updateMutate` is captured (rather than declared inline in the
// mock factory, as it was) so the Edit -> Save path can be asserted at all:
// an anonymous vi.fn() nobody holds a reference to can never be checked, and
// swapping handleSubmit's create/update branches would ship green.
const { toastSuccess, toastError, configs, deleteMutate, createMutate, updateMutate } = vi.hoisted(
  () => ({
    toastSuccess:
      vi.fn<
        (message: string, options?: { action?: { label: string; onClick: () => void } }) => void
      >(),
    toastError: vi.fn<(message: string) => void>(),
    configs: [
      { id: 1, hubChannelId: "hub1", categoryId: "cat1", nameTemplate: "{user}'s Channel" },
    ],
    deleteMutate: vi.fn(async () => {}),
    createMutate: vi.fn(async () => {}),
    updateMutate: vi.fn(async () => {}),
  }),
);
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

vi.mock("../../../../src/client/features/tempvoice/hooks/useTempVoice", () => ({
  useTempVoiceConfigs: () => ({ data: configs, isLoading: false }),
  useCreateTempVoice: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateTempVoice: () => ({ mutateAsync: updateMutate, isPending: false }),
  useDeleteTempVoice: () => ({ mutateAsync: deleteMutate, isPending: false }),
}));
vi.mock("../../../../src/client/shared/hooks/useChannels", () => ({
  useChannels: () => ({
    data: [
      { id: "hub1", name: "Join to Create", type: 2 },
      { id: "cat1", name: "Voice Channels", type: 4 },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("../../../../src/client/shared/hooks/useRoles", () => ({
  useRoles: () => ({ data: [], isLoading: false, isError: false }),
}));

// Each HubCard reaches usePreviewContext → useAuth/useGuilds, which are
// react-query hooks and throw without a QueryClientProvider.
vi.mock("../../../../src/client/shared/hooks/useAuth", () => ({
  useAuth: () => ({ data: { userId: "u1", username: "Ahmad", avatar: null } }),
}));
vi.mock("../../../../src/client/shared/hooks/useGuilds", () => ({
  useGuilds: () => ({
    data: [{ id: "g1", name: "Test Guild", icon: null, botPresent: true }],
  }),
}));

import { TempVoiceHubList } from "../../../../src/client/features/tempvoice/components/TempVoiceHubList";

// Radix popover/scroll-area need ResizeObserver, which jsdom lacks.
// Typed against the DOM lib interface so no cast is needed (Global Constraints).
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver ??= ResizeObserverStub;
});

// Call histories on the shared hoisted mocks would otherwise bleed across
// tests (they're the same vi.fn() instances for the whole file) — clear
// counts before each test so "not called with X" and "called once" style
// assertions are meaningful in isolation. This does not remove the base
// `async () => {}` implementations, only queued call records — a test that
// needs a one-shot rejection sets it up itself via `mockRejectedValueOnce`.
beforeEach(() => {
  vi.clearAllMocks();
});

describe("TempVoiceHubList", () => {
  it("lists saved hubs in summary mode", () => {
    render(<TempVoiceHubList />);
    expect(screen.getByText("Join to Create")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editor.save/ })).not.toBeInTheDocument();
  });

  it("expands exactly one card when Edit is pressed", async () => {
    const user = userEvent.setup();
    render(<TempVoiceHubList />);
    await user.click(screen.getByRole("button", { name: /list.edit/ }));
    expect(screen.getByRole("button", { name: /editor.save/ })).toBeInTheDocument();
  });

  it("appends an expanded new card when Add is pressed", async () => {
    const user = userEvent.setup();
    render(<TempVoiceHubList />);
    await user.click(screen.getByRole("button", { name: /list.add/ }));
    expect(screen.getByRole("button", { name: /editor.save/ })).toBeInTheDocument();
  });

  it("moves focus into step 1's picker when an existing card expands", async () => {
    const user = userEvent.setup();
    render(<TempVoiceHubList />);
    await user.click(screen.getByRole("button", { name: /list.edit/ }));
    // Clicking Edit swaps the card from its summary branch to its form branch,
    // unmounting the very button that was just activated — so without an
    // explicit move, focus falls to <body> and a keyboard user's tab position
    // resets to the top of the document. The picker's accessible name comes
    // from step 1's <label htmlFor>, hence "flow.step1".
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "flow.step1" })).toHaveFocus(),
    );
  });

  it("moves focus into step 1's picker when the new-hub card is added", async () => {
    const user = userEvent.setup();
    render(<TempVoiceHubList />);
    await user.click(screen.getByRole("button", { name: /list.add/ }));
    // Same hole from the other direction: the header Add button is suppressed
    // while any card is expanded, so it unmounts on click too. This card is
    // freshly mounted in editor mode rather than transitioned into it, which
    // is a different code path from the test above.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "flow.step1" })).toHaveFocus(),
    );
  });

  it("returns focus to the Edit button after cancelling", async () => {
    const user = userEvent.setup();
    render(<TempVoiceHubList />);
    await user.click(screen.getByRole("button", { name: /list.edit/ }));
    await user.click(screen.getByRole("button", { name: /editor.cancel/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /list.edit/ })).toHaveFocus(),
    );
  });

  it("saves an edited hub through the update mutation, not create", async () => {
    const user = userEvent.setup();
    render(<TempVoiceHubList />);
    await user.click(screen.getByRole("button", { name: /list.edit/ }));

    const nameField = screen.getByDisplayValue("{user}'s Channel");
    await user.clear(nameField);
    // No braces: user-event treats "{" as the start of a key descriptor.
    await user.type(nameField, "Squad Room");
    await user.click(screen.getByRole("button", { name: /editor.save/ }));

    // The argument SHAPE is the contract, not just "some mutation ran":
    // useUpdateTempVoice's mutationFn destructures { configId, data } and puts
    // configId in the PUT path, so a positional or flattened payload would
    // silently PUT to the wrong URL with the wrong body.
    await waitFor(() =>
      expect(updateMutate).toHaveBeenCalledWith({
        configId: 1,
        data: { hubChannelId: "hub1", categoryId: "cat1", nameTemplate: "Squad Room" },
      }),
    );
    // Editing an existing hub must never take the create branch — that would
    // POST a duplicate hub on the same channel instead of amending this one.
    expect(createMutate).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("toast.updated");
    // ...and the card collapses on success, unlike the failure case below.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /editor.save/ })).not.toBeInTheDocument(),
    );
  });

  it("keeps the card expanded, with the draft intact, when the save fails", async () => {
    // The sibling assertion in HubCard.test.tsx renders HubCard directly with
    // mode="editor" hardcoded, so that card is structurally incapable of
    // collapsing and the assertion cannot fail. The real contract lives here:
    // handleSubmit must let the rejection propagate so HubCard's catch runs
    // and collapse() is never reached. Swallowing it — one `.catch(() => {})`
    // on the mutateAsync call — would discard the admin's typing on every
    // failed save, with every existing test still green.
    const user = userEvent.setup();
    updateMutate.mockRejectedValueOnce(new Error("This channel is already a temp voice hub"));
    render(<TempVoiceHubList />);
    await user.click(screen.getByRole("button", { name: /list.edit/ }));

    const nameField = screen.getByDisplayValue("{user}'s Channel");
    await user.clear(nameField);
    await user.type(nameField, "Squad Room");
    await user.click(screen.getByRole("button", { name: /editor.save/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This channel is already a temp voice hub",
    );
    expect(screen.getByRole("button", { name: /editor.save/ })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Squad Room")).toBeInTheDocument();
    // A failed save must not be announced as a successful one.
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("offers Undo after a delete, and Undo recreates the exact deleted hub", async () => {
    const user = userEvent.setup();
    render(<TempVoiceHubList />);
    await user.click(screen.getByRole("button", { name: /list.delete/ }));
    expect(deleteMutate).toHaveBeenCalledWith(1);
    const [, options] = toastSuccess.mock.calls.at(-1) ?? [];
    expect(options?.action?.label).toBe("toast.undo");

    // Invoke the captured handler — the label assertion above only proves the
    // toast offers an Undo button, not that pressing it does anything. This
    // is the deleted row's own data, read straight from the pre-delete
    // snapshot, so a bug that sends the wrong (or empty) payload would show
    // up here even though it can't show up in the label check.
    options?.action?.onClick();
    await waitFor(() =>
      expect(createMutate).toHaveBeenCalledWith({
        hubChannelId: "hub1",
        categoryId: "cat1",
        nameTemplate: "{user}'s Channel",
      }),
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("toast.restored"),
    );
  });

  it("surfaces an error and leaves the row in place when delete fails", async () => {
    const user = userEvent.setup();
    deleteMutate.mockRejectedValueOnce(new Error("Missing permissions"));
    render(<TempVoiceHubList />);
    await user.click(screen.getByRole("button", { name: /list.delete/ }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Missing permissions"),
    );
    // No "removed" success toast, and no Undo was ever offered for a delete
    // that never actually happened.
    expect(toastSuccess).not.toHaveBeenCalled();
    // The row is still there — a failed delete must not vanish from the list.
    expect(screen.getByText("Join to Create")).toBeInTheDocument();
  });

  it("surfaces an error when Undo fails to recreate the hub", async () => {
    const user = userEvent.setup();
    createMutate.mockRejectedValueOnce(new Error("Config limit reached"));
    render(<TempVoiceHubList />);
    await user.click(screen.getByRole("button", { name: /list.delete/ }));
    const [, options] = toastSuccess.mock.calls.at(-1) ?? [];

    options?.action?.onClick();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Config limit reached"));
    // The restore failure must not be reported as a success.
    expect(toastSuccess).not.toHaveBeenCalledWith("toast.restored");
  });
});
