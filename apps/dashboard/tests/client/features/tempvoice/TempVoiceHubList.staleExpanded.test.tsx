// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k),
  }),
}));
vi.mock("@tanstack/react-router", () => ({ useParams: () => ({ guildId: "g1" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Shape shared by the seeded rows. A type-only declaration is erased at
// runtime, so referencing it inside `vi.hoisted`'s callback carries none of the
// TDZ hazard a real value import would (same reasoning as the sibling
// focusFallback file).
type SeedConfig = {
  id: number;
  hubChannelId: string;
  categoryId: string | null;
  nameTemplate: string;
};

// A mutable configs list standing in for the react-query cache. The test drops
// a row from it mid-flight to reproduce what a background refetch does after
// another admin — or this admin in a second tab — deletes the hub currently
// open in the editor.
// The annotation goes on a local, not on the literal via `as` — a cast is what
// hid a dead keyGenerator on this project once already, and the no-`as` rule
// governs test files too.
const state = vi.hoisted(() => {
  const configs: SeedConfig[] = [
    { id: 1, hubChannelId: "hub1", categoryId: null, nameTemplate: "{user}'s Channel" },
    { id: 2, hubChannelId: "hub2", categoryId: null, nameTemplate: "{user}'s Channel" },
  ];
  return { configs };
});

vi.mock("../../../../src/client/features/tempvoice/hooks/useTempVoice", () => ({
  useTempVoiceConfigs: () => ({ data: state.configs, isLoading: false }),
  useCreateTempVoice: () => ({ mutateAsync: vi.fn(async () => {}), isPending: false }),
  useUpdateTempVoice: () => ({ mutateAsync: vi.fn(async () => {}), isPending: false }),
  useDeleteTempVoice: () => ({ mutateAsync: vi.fn(async () => {}), isPending: false }),
}));
vi.mock("../../../../src/client/shared/hooks/useChannels", () => ({
  useChannels: () => ({
    data: [
      { id: "hub1", name: "Join to Create", type: 2 },
      { id: "hub2", name: "Gaming Lobby", type: 2 },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("../../../../src/client/shared/hooks/useRoles", () => ({
  useRoles: () => ({ data: [], isLoading: false, isError: false }),
}));

// usePreviewContext → useAuth/useGuilds are react-query hooks and throw without
// a QueryClientProvider.
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

describe("TempVoiceHubList — expanded id reconciled against the fetched configs", () => {
  it("restores the Add button when the expanded hub disappears from a refetch", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TempVoiceHubList />);

    // Expand hub 1. Add is correctly suppressed while a card is open.
    // Guarded rather than indexed-and-asserted: `!` is a cast in all but name.
    const [firstEdit] = screen.getAllByRole("button", { name: /list.edit/ });
    if (!firstEdit) throw new Error("expected an Edit button for each seeded hub");
    await user.click(firstEdit);
    expect(screen.queryByRole("button", { name: /list.add/ })).not.toBeInTheDocument();

    // Hub 1 vanishes from the server's answer while `expanded` still holds 1.
    state.configs = state.configs.filter((c) => c.id !== 1);
    rerender(<TempVoiceHubList />);

    // No card is expanded any more — hub 1 isn't rendered at all — so the state
    // the Add button was hidden for no longer exists. A guard reading the raw
    // id would keep it hidden indefinitely, leaving no way to add a hub short
    // of reloading the page.
    expect(screen.queryByRole("button", { name: /editor.save/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /list.add/ })).toBeInTheDocument();
  });
});
