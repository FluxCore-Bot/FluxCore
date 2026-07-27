// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

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
const { toastSuccess, configs, deleteMutate } = vi.hoisted(() => ({
  toastSuccess:
    vi.fn<(message: string, options?: { action?: { label: string; onClick: () => void } }) => void>(),
  configs: Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    hubChannelId: `hub${i + 1}`,
    categoryId: "cat1",
    nameTemplate: "{user}'s Channel",
  })),
  deleteMutate: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

vi.mock("../../../../src/client/features/tempvoice/hooks/useTempVoice", () => ({
  useTempVoiceConfigs: () => ({ data: configs, isLoading: false }),
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

describe("TempVoiceHubList at cap", () => {
  it("hides Add once the guild is at the config cap", () => {
    render(<TempVoiceHubList />);
    expect(screen.queryByRole("button", { name: /list.add/ })).not.toBeInTheDocument();
  });
});
