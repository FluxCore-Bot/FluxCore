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
// react-query hooks and throw without a QueryClientProvider. The empty state
// reaches them too, for the worked example's derived channel name.
//
// The username here is deliberately NOT the "Ahmad" the sibling test files
// use: the worked example's step-2 chip used to be the hardcoded literal
// "Ahmad's Channel", so an assertion against that string would pass whether
// the name is derived from the signed-in admin or still hardcoded.
vi.mock("../../../../src/client/shared/hooks/useAuth", () => ({
  useAuth: () => ({ data: { userId: "u1", username: "Rania", avatar: null } }),
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
  it("teaches the mechanic with a worked example that assistive tech can read", () => {
    render(<TempVoiceHubList />);
    // `inert` would have removed the entire example from the accessibility
    // tree — and the example holds zero focusable nodes, so it guarded nothing.
    // A screen-reader user would get the caption, which ends in a colon, and
    // then nothing at all: the branch's whole teaching payload, missing.
    expect(screen.getByRole("list")).not.toHaveAttribute("inert");
    expect(screen.getByText("empty.exampleCaption")).toBeInTheDocument();
    // All four lifecycle steps are announced, not just the caption.
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("flow.step1")).toBeInTheDocument();
    expect(screen.getByText("flow.step4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /empty.cta/ })).toBeInTheDocument();
  });

  it("marks the example's chips as an illustration rather than saved channels", () => {
    render(<TempVoiceHubList />);
    expect(screen.getByRole("list")).toHaveAttribute("data-example", "true");
    // Steps 1-3 each carry a chip; step 4 has no control. All three must read
    // as dashed illustrations — solid chips are what a real saved hub renders,
    // so identical styling would tell a sighted admin a hub already exists.
    expect(screen.getByRole("list").querySelectorAll(".border-dashed")).toHaveLength(3);
  });

  it("translates the example's channel names and derives the created one", () => {
    render(<TempVoiceHubList />);
    // The `t` mock echoes keys, so seeing the keys proves these went through
    // i18n. As .tsx literals they were English in all 48 locales and the parity
    // test structurally could not see them.
    expect(screen.getByText("empty.exampleHub")).toBeInTheDocument();
    expect(screen.getByText("empty.exampleCategory")).toBeInTheDocument();
    // Step 2's chip is derived from the real default template and the real
    // preview context, not translated and not written down — so it shows the
    // signed-in admin's own name and matches what creating a hub would do.
    expect(screen.getByText("Rania's Channel")).toBeInTheDocument();
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
