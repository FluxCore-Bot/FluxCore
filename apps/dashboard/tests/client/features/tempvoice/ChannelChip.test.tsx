// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChannelChip } from "../../../../src/client/features/tempvoice/components/ChannelChip";

describe("ChannelChip", () => {
  it("renders the channel name", () => {
    render(<ChannelChip kind="voice" name="Join to Create" />);
    expect(screen.getByText("Join to Create")).toBeInTheDocument();
  });

  it("dashes the border for the example variant only", () => {
    // The worked example's chips must not be pixel-identical to the chips in
    // a real saved-hub summary, or a sighted admin has no cue that they're
    // looking at an illustration. Dashed stroke, same border token and full
    // opacity, so the teaching copy still meets 4.5:1.
    render(<ChannelChip kind="voice" name="example" variant="example" />);
    render(<ChannelChip kind="voice" name="real" />);
    expect(screen.getByText("example").parentElement).toHaveClass("border-dashed");
    expect(screen.getByText("real").parentElement).not.toHaveClass("border-dashed");
  });

  it("renders a different glyph for voice and category", () => {
    const { container: voice } = render(<ChannelChip kind="voice" name="x" />);
    const { container: category } = render(<ChannelChip kind="category" name="x" />);
    expect(voice.querySelector("svg")?.innerHTML).not.toBe(
      category.querySelector("svg")?.innerHTML,
    );
  });
});
