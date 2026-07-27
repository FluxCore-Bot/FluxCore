// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChannelChip } from "../../../../src/client/features/tempvoice/components/ChannelChip";

describe("ChannelChip", () => {
  it("renders the channel name", () => {
    render(<ChannelChip kind="voice" name="Join to Create" />);
    expect(screen.getByText("Join to Create")).toBeInTheDocument();
  });

  it("renders a different glyph for voice and category", () => {
    const { container: voice } = render(<ChannelChip kind="voice" name="x" />);
    const { container: category } = render(<ChannelChip kind="category" name="x" />);
    expect(voice.querySelector("svg")?.innerHTML).not.toBe(
      category.querySelector("svg")?.innerHTML,
    );
  });
});
