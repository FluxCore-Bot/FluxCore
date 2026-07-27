// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HubFlow, HubFlowStep } from "../../../../src/client/features/tempvoice/components/HubFlow";

describe("HubFlow", () => {
  it("renders steps as an ordered list so order is announced", () => {
    render(
      <HubFlow>
        <HubFlowStep n={1} label="First" htmlFor="a">
          <input id="a" />
        </HubFlowStep>
        <HubFlowStep n={2} label="Second" last />
      </HubFlow>,
    );
    expect(screen.getByRole("list").tagName).toBe("OL");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("list")).not.toHaveAttribute("inert");
  });

  it("associates the label with its control when htmlFor is given", () => {
    render(
      <HubFlow>
        <HubFlowStep n={1} label="Hub channel" htmlFor="hub">
          <input id="hub" />
        </HubFlowStep>
      </HubFlow>,
    );
    expect(screen.getByLabelText("Hub channel")).toBeInTheDocument();
  });

  it("renders a step with no control as plain text, not a label", () => {
    render(
      <HubFlow>
        <HubFlowStep n={4} label="Deleted when empty" last />
      </HubFlow>,
    );
    expect(screen.getByText("Deleted when empty").tagName).toBe("P");
  });

  it("marks the example variant inert", () => {
    render(
      <HubFlow example>
        <HubFlowStep n={1} label="Example" last />
      </HubFlow>,
    );
    expect(screen.getByRole("list")).toHaveAttribute("inert");
  });
});
