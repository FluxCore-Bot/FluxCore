// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// DiscordSelect pulls its options from these hooks; mock them with static data.
vi.mock("../../../../src/client/shared/hooks/useChannels", () => ({
  useChannels: () => ({
    data: [
      { id: "1", name: "general", type: 0 },
      { id: "2", name: "voice-chat", type: 2 },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("../../../../src/client/shared/hooks/useRoles", () => ({
  useRoles: () => ({ data: [], isLoading: false, isError: false }),
}));

import { DiscordSelect } from "../../../../src/client/shared/ui/discord-select";

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

describe("DiscordSelect", () => {
  it("lists only text channels for type='text' and filters by search", async () => {
    const user = userEvent.setup();
    render(<DiscordSelect guildId="g1" type="text" value={null} onValueChange={vi.fn()} />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("# general")).toBeInTheDocument();
    expect(screen.queryByText("🔊 voice-chat")).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Search..."), "gen");
    expect(screen.getByText("# general")).toBeInTheDocument();
  });

  it("emits the channel id on select", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DiscordSelect guildId="g1" type="text" value={null} onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("# general"));
    expect(onValueChange).toHaveBeenCalledWith("1");
  });

  it("omits channels listed in excludeIds", async () => {
    const user = userEvent.setup();
    render(
      <DiscordSelect
        guildId="g1"
        type="voice"
        value={null}
        onValueChange={vi.fn()}
        excludeIds={["2"]}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("🔊 voice-chat")).not.toBeInTheDocument();
  });

  it("never excludes the currently selected value", async () => {
    const user = userEvent.setup();
    render(
      <DiscordSelect
        guildId="g1"
        type="voice"
        value="2"
        onValueChange={vi.fn()}
        excludeIds={["2"]}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(screen.queryAllByText("🔊 voice-chat").length).toBeGreaterThan(0);
  });

  it("applies id to, and forwards ref onto, the trigger button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <DiscordSelect
        id="my-hub-picker"
        ref={ref}
        guildId="g1"
        type="voice"
        value={null}
        onValueChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("id", "my-hub-picker");
    expect(ref.current).toBe(trigger);
  });
});
