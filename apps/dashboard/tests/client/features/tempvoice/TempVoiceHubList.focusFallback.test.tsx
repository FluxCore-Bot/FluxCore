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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// A stateful configs list, mutated by the "create" mock, so this test can
// reproduce the real "submit -> cache invalidation -> one more row" cycle
// without a real QueryClient. Starts one short of the cap (9 — the same
// MAX_TEMPVOICE_CONFIGS_PER_GUILD as the .cap.test.tsx file uses, hardcoded
// rather than imported: `vi.hoisted`'s callback runs before any real import
// in this file resolves, same TDZ hazard as the vi.mock factories) so the
// Add button is available at first; the mutation below fills the last slot.
const state = vi.hoisted(() => ({
  configs: Array.from({ length: 9 }, (_, i) => ({
    id: i + 1,
    hubChannelId: `hub${i + 1}`,
    categoryId: null as string | null,
    nameTemplate: "{user}'s Channel",
  })),
}));

const createMutate = vi.hoisted(() =>
  vi.fn(
    async (data: { hubChannelId: string; categoryId: string | null; nameTemplate: string }) => {
      state.configs = [...state.configs, { id: state.configs.length + 1, ...data }];
    },
  ),
);

vi.mock("../../../../src/client/features/tempvoice/hooks/useTempVoice", () => ({
  useTempVoiceConfigs: () => ({ data: state.configs, isLoading: false }),
  useCreateTempVoice: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateTempVoice: () => ({ mutateAsync: vi.fn(async () => {}), isPending: false }),
  useDeleteTempVoice: () => ({ mutateAsync: vi.fn(async () => {}), isPending: false }),
}));
// The only channel not already claimed by the 9 seeded configs (hub1..hub9),
// so the picker offers exactly one selectable option.
vi.mock("../../../../src/client/shared/hooks/useChannels", () => ({
  useChannels: () => ({
    data: [{ id: "hub10", name: "New Hub", type: 2 }],
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

describe("TempVoiceHubList — focus fallback when the Add control disappears mid-flow", () => {
  it("focuses the section heading after a save that fills the last cap slot removes the Add button", async () => {
    const user = userEvent.setup();
    render(<TempVoiceHubList />);

    await user.click(screen.getByRole("button", { name: /list.add/ }));
    await user.click(screen.getByRole("button", { name: "flow.step1" }));
    await user.click(screen.getByText("🔊 New Hub"));
    await user.click(screen.getByRole("button", { name: /editor.save/ }));

    // The 10th hub just landed — the cap is now reached and the Add
    // affordance never comes back, so collapse()'s primary focus target
    // ("tv-add-hub") no longer exists anywhere in the DOM.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /list.add/ })).not.toBeInTheDocument(),
    );
    // Without a fallback, focus silently drops to <body> here. The section
    // heading is always present, so it's the one target guaranteed to exist
    // regardless of cap state.
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /list.heading/ })).toHaveFocus(),
    );
  });
});
