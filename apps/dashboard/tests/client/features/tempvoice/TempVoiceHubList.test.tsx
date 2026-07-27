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
// `deleteMutate`/`createMutate` are plain `vi.fn(async () => {})` by default
// (resolve) — individual tests override one call with `.mockRejectedValueOnce`
// to exercise the failure paths, then it reverts to resolving.
const { toastSuccess, toastError, configs, deleteMutate, createMutate } = vi.hoisted(() => ({
  toastSuccess:
    vi.fn<(message: string, options?: { action?: { label: string; onClick: () => void } }) => void>(),
  toastError: vi.fn<(message: string) => void>(),
  configs: [
    { id: 1, hubChannelId: "hub1", categoryId: "cat1", nameTemplate: "{user}'s Channel" },
  ],
  deleteMutate: vi.fn(async () => {}),
  createMutate: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

vi.mock("../../../../src/client/features/tempvoice/hooks/useTempVoice", () => ({
  useTempVoiceConfigs: () => ({ data: configs, isLoading: false }),
  useCreateTempVoice: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateTempVoice: () => ({ mutateAsync: vi.fn(async () => {}), isPending: false }),
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

  it("returns focus to the Edit button after cancelling", async () => {
    const user = userEvent.setup();
    render(<TempVoiceHubList />);
    await user.click(screen.getByRole("button", { name: /list.edit/ }));
    await user.click(screen.getByRole("button", { name: /editor.cancel/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /list.edit/ })).toHaveFocus(),
    );
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
