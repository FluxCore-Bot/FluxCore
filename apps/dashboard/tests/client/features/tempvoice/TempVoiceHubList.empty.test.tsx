// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
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
const { toastSuccess, toastError, deleteMutate } = vi.hoisted(() => ({
  toastSuccess:
    vi.fn<(message: string, options?: { action?: { label: string; onClick: () => void } }) => void>(),
  toastError: vi.fn<(message: string) => void>(),
  deleteMutate: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

vi.mock("../../../../src/client/features/tempvoice/hooks/useTempVoice", () => ({
  useTempVoiceConfigs: () => ({ data: [], isLoading: false }),
  useCreateTempVoice: () => ({ mutateAsync: vi.fn(async () => {}), isPending: false }),
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

describe("TempVoiceHubList empty state", () => {
  it("teaches the mechanic with an inert worked example", () => {
    render(<TempVoiceHubList />);
    expect(screen.getByRole("list")).toHaveAttribute("inert");
    expect(screen.getByText("empty.exampleCaption")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /empty.cta/ })).toBeInTheDocument();
  });

  it("shows only the one CTA, not a redundant header Add button alongside it", () => {
    render(<TempVoiceHubList />);
    // The header "list.add" button and the big empty-state "empty.cta" button
    // both open the same "new" card — showing both when there's nothing
    // configured yet is a redundant, confusing pair of identical affordances.
    expect(screen.queryByRole("button", { name: /list.add/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /empty.cta/ })).toBeInTheDocument();
  });

  it("returns focus to the empty-state CTA after cancelling the card it opened", async () => {
    const user = userEvent.setup();
    render(<TempVoiceHubList />);
    await user.click(screen.getByRole("button", { name: /empty.cta/ }));
    await user.click(screen.getByRole("button", { name: /editor.cancel/ }));
    // The header button and the empty-state CTA share the id "tv-add-hub"
    // (they're mutually exclusive), so collapse()'s focus restoration must
    // land back on the CTA — not silently drop to <body>. Re-querying here
    // (rather than reusing a reference captured before the click) matters:
    // switching in and out of the empty-state branch unmounts and remounts
    // this button, so a captured-early reference would be a stale, detached
    // node that can never receive focus regardless of whether the real
    // restoration mechanism works.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /empty.cta/ })).toHaveFocus(),
    );
  });
});
