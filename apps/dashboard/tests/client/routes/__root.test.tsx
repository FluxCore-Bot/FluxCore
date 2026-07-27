// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "../../../src/client/shared/lib/schemas";

// jsdom lacks ResizeObserver (used by Radix Popover/Tooltip positioning); stub
// it so mounting the always-rendered Popover-based LanguageSwitcher does not
// throw when the nav renders for an authenticated user. The no-arg methods
// satisfy the real signatures structurally, so no cast is needed.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }
});

// RootLayout consumes only `.data` from useAuth, so the mock returns just that
// slice — impersonating the full UseQueryResult union would need a cast.
const auth = vi.hoisted((): { data: User | undefined } => ({ data: undefined }));

vi.mock("../../../src/client/shared/hooks/useAuth", () => ({
  useAuth: () => ({ data: auth.data }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

// __root renders <Outlet/>, <Link/>, reads route params, and navigates on
// command activation - none of which need a real router for this guard test.
vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="outlet" />,
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
}));

vi.mock("../../../src/client/shared/hooks/useGuilds", () => ({
  useGuilds: () => ({ data: [] }),
  useRefreshGuilds: () => ({ mutate: vi.fn() }),
  useRefreshGuild: () => ({ mutate: vi.fn() }),
}));
vi.mock("../../../src/client/shared/hooks/useBotInfo", () => ({
  useBotInfo: () => ({ data: undefined }),
}));
vi.mock("../../../src/client/features/permissions/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => false }),
}));

import { RootLayout } from "../../../src/client/routes/__root";

function renderAs(user: User | undefined) {
  auth.data = user;
  return render(<RootLayout />);
}

/**
 * The palette trigger and its dialog are only meant to exist for logged-in
 * users - both `<CommandPaletteTrigger />` and `<AppCommandPalette />` sit
 * inside `{user && ...}` guards in __root.tsx, while the `<CommandPaletteProvider>`
 * that owns the open/closed state (and the window Ctrl+K listener) wraps
 * everything unconditionally. A regression that drops either guard, or that
 * splits the provider so the trigger and the dialog no longer share one
 * instance, would not be caught by any other existing test - CommandPalette.test.tsx
 * and CommandPaletteTrigger.test.tsx each render their subject in isolation,
 * already wrapped in a single shared provider they control themselves.
 */
describe("RootLayout - command palette guard", () => {
  beforeEach(() => {
    auth.data = undefined;
  });

  it("unauthenticated: hides the trigger and Ctrl+K opens nothing", async () => {
    const user = userEvent.setup();
    renderAs(undefined);

    expect(
      screen.queryByRole("button", { name: "palette.open" }),
    ).not.toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("authenticated: shows a labelled trigger and Ctrl+K opens the palette", async () => {
    const user = userEvent.setup();
    renderAs({ userId: "1", username: "someone", avatar: null });

    const trigger = screen.getByRole("button", { name: "palette.open" });
    expect(trigger).toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("authenticated: clicking the trigger opens the same palette instance", async () => {
    const user = userEvent.setup();
    renderAs({ userId: "1", username: "someone", avatar: null });

    await user.click(screen.getByRole("button", { name: "palette.open" }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
