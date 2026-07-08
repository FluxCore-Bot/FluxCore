// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

function Hello() {
  return <button type="button">click me</button>;
}

describe("jsdom toolchain", () => {
  it("renders a component into the DOM", () => {
    render(<Hello />);
    expect(screen.getByRole("button", { name: "click me" })).toBeTruthy();
  });
});
