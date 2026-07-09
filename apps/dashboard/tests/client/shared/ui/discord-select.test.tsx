// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
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

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
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
});
