// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k),
  }),
}));

vi.mock("../../../../src/client/shared/hooks/useChannels", () => ({
  useChannels: () => ({
    data: [
      { id: "hub1", name: "Join to Create", type: 2 },
      { id: "hub2", name: "Gaming Lobby", type: 2 },
      { id: "cat1", name: "Voice Channels", type: 4 },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("../../../../src/client/shared/hooks/useRoles", () => ({
  useRoles: () => ({ data: [], isLoading: false, isError: false }),
}));

// HubCard → usePreviewContext → useAuth/useGuilds are react-query hooks and
// throw without a QueryClientProvider. Mock them rather than wrapping, so the
// real VariableEditor and real preview resolver stay under test.
vi.mock("../../../../src/client/shared/hooks/useAuth", () => ({
  useAuth: () => ({ data: { userId: "u1", username: "Ahmad", avatar: null } }),
}));
vi.mock("../../../../src/client/shared/hooks/useGuilds", () => ({
  useGuilds: () => ({
    data: [{ id: "g1", name: "Test Guild", icon: null, botPresent: true }],
  }),
}));

import { HubCard } from "../../../../src/client/features/tempvoice/components/HubCard";

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

// Deliberately distinct from HubCard's own DEFAULT_TEMPLATE ("{user}'s Channel")
// so the "seeds from config" test can't pass merely because the seeded value
// happens to match the unseeded default. With the "Ahmad" username mock above,
// this resolves to "Ahmad's Lounge".
const config = { id: 1, hubChannelId: "hub1", categoryId: "cat1", nameTemplate: "{user}'s Lounge" };

function props(over: Partial<ComponentProps<typeof HubCard>> = {}) {
  const names: Record<string, string> = {
    hub1: "Join to Create",
    hub2: "Gaming Lobby",
    cat1: "Voice Channels",
  };
  return {
    config,
    mode: "summary" as const,
    guildId: "g1",
    resolveChannelName: (id: string) => names[id] ?? id,
    excludeHubIds: [],
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCancel: vi.fn(),
    onSubmit: vi.fn(async () => {}),
    busy: false,
    ...over,
  };
}

describe("HubCard summary mode", () => {
  it("names the hub channel and summarises the outcome", () => {
    render(<HubCard {...props()} />);
    expect(screen.getByText("Join to Create")).toBeInTheDocument();
    expect(screen.getByText("Voice Channels")).toBeInTheDocument();
  });

  it("falls back to the same-category wording when the hub has no category", () => {
    render(<HubCard {...props({ config: { ...config, categoryId: null } })} />);
    expect(screen.getByText(/summary.sameCategory/)).toBeInTheDocument();
    expect(screen.queryByText("Voice Channels")).not.toBeInTheDocument();
  });

  it("calls onEdit when Edit is pressed", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<HubCard {...p} />);
    await user.click(screen.getByRole("button", { name: /list.edit/ }));
    expect(p.onEdit).toHaveBeenCalledOnce();
  });
});

describe("HubCard editor mode", () => {
  it("seeds the controls from the config", () => {
    render(<HubCard {...props({ mode: "editor" })} />);
    expect(screen.getByDisplayValue("{user}'s Lounge")).toBeInTheDocument();
    // categoryId — the picker's trigger shows the resolved, selected option label.
    expect(screen.getByText("📁 Voice Channels")).toBeInTheDocument();
    // The step-2 live preview — resolved from the seeded template, not left blank.
    expect(screen.getByText("Ahmad's Lounge")).toBeInTheDocument();
  });

  it("excludes hub channels claimed by other configs while keeping its own selection visible", async () => {
    const user = userEvent.setup();
    render(<HubCard {...props({ mode: "editor", excludeHubIds: ["hub2"] })} />);
    // The card's own current value is always shown on the trigger...
    expect(screen.getByText("🔊 Join to Create")).toBeInTheDocument();
    // ...but a channel claimed by another hub is missing from the option list.
    await user.click(screen.getByRole("button", { name: "flow.step1" }));
    expect(screen.queryByText("🔊 Gaming Lobby")).not.toBeInTheDocument();
  });

  it("blocks submit, reports an error, and focuses the offending control", async () => {
    const user = userEvent.setup();
    const p = props({ mode: "editor", config: null });
    render(<HubCard {...p} />);
    await user.click(screen.getByRole("button", { name: /editor.save/ }));
    expect(p.onSubmit).not.toHaveBeenCalled();
    const errorText = screen.getByText(/errors.hubRequired/);
    // The trigger is a labelable <button> explicitly associated with step 1's
    // <label htmlFor>, so its accessible name comes from that label ("flow.step1"),
    // not its own placeholder text — that's how ARIA name computation resolves it.
    const trigger = screen.getByRole("button", { name: "flow.step1" });
    expect(document.activeElement).toBe(trigger);
    // Assistive tech needs more than focus landing on the button: it must be
    // described by, and marked invalid because of, the error text.
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", errorText.id);
  });

  it("surfaces a submit failure inside the card and stays open", async () => {
    const user = userEvent.setup();
    const p = props({
      mode: "editor",
      onSubmit: vi.fn(async () => {
        throw new Error("This channel is already a temp voice hub");
      }),
    });
    render(<HubCard {...p} />);
    await user.click(screen.getByRole("button", { name: /editor.save/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This channel is already a temp voice hub",
    );
    expect(screen.getByRole("button", { name: /editor.save/ })).toBeInTheDocument();
  });
});

describe("HubCard mode transitions", () => {
  // The Task 6 orchestrator toggles `mode` on one long-lived card instance
  // (collapse() only clears which hub id is expanded — it never unmounts the
  // card), so these tests simulate that with `rerender`, not a fresh `render`.

  it("keeps the summary reading the saved config after the editor's own draft changes", async () => {
    const user = userEvent.setup();
    const p = props({ mode: "editor" });
    const { rerender } = render(<HubCard {...p} />);

    const nameField = screen.getByDisplayValue("{user}'s Lounge");
    await user.clear(nameField);
    await user.type(nameField, "Totally Different Name");

    // Cancel: the parent flips `mode` back without ever calling onSubmit.
    rerender(<HubCard {...p} mode="summary" />);

    expect(screen.getByText("Ahmad's Lounge")).toBeInTheDocument();
    expect(screen.queryByText("Totally Different Name")).not.toBeInTheDocument();
  });

  it("resets the draft and clears a stale submit error when the card re-enters editor mode", async () => {
    const user = userEvent.setup();
    const p = props({
      mode: "editor",
      onSubmit: vi.fn(async () => {
        throw new Error("This channel is already a temp voice hub");
      }),
    });
    const { rerender } = render(<HubCard {...p} />);

    await user.click(screen.getByRole("button", { name: /editor.save/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    const nameField = screen.getByDisplayValue("{user}'s Lounge");
    await user.clear(nameField);
    await user.type(nameField, "Abandoned Draft");

    rerender(<HubCard {...p} mode="summary" />);
    rerender(<HubCard {...p} mode="editor" />);

    expect(screen.getByDisplayValue("{user}'s Lounge")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Abandoned Draft")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears a stale field error when the card re-enters editor mode", async () => {
    // config stays null throughout: the hub picker has no "clear" affordance
    // (no `allowNone`), so a field error is only reachable from an empty,
    // unsaved draft — this pins the reset mechanism itself, even though a
    // config-with-value card wouldn't reach a field error via real interaction.
    const user = userEvent.setup();
    const p = props({ mode: "editor", config: null });
    const { rerender } = render(<HubCard {...p} />);

    await user.click(screen.getByRole("button", { name: /editor.save/ }));
    expect(screen.getByText(/errors.hubRequired/)).toBeInTheDocument();

    rerender(<HubCard {...p} mode="summary" />);
    rerender(<HubCard {...p} mode="editor" />);

    expect(screen.queryByText(/errors.hubRequired/)).not.toBeInTheDocument();
  });
});
