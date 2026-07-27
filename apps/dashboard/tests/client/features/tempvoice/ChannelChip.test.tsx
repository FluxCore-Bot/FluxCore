// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChannelChip } from "../../../../src/client/features/tempvoice/components/ChannelChip";

describe("ChannelChip", () => {
  it("renders the channel name", () => {
    render(<ChannelChip kind="voice" name="Join to Create" />);
    expect(screen.getByText("Join to Create")).toBeInTheDocument();
  });

  it("hides its icon from assistive tech", () => {
    const { container } = render(<ChannelChip kind="category" name="Voice Channels" />);
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});
