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

  it("keeps the worked example in the accessibility tree", () => {
    render(
      <HubFlow example>
        <HubFlowStep n={1} label="Example" last />
      </HubFlow>,
    );
    // `inert` would strip the entire example from the accessibility tree while
    // guarding nothing: the example has no focusable node to keep out of the
    // tab order. Screen-reader users would hear the caption ("Example — this
    // is how a voice hub works:") followed by silence.
    expect(screen.getByRole("list")).not.toHaveAttribute("inert");
    expect(screen.getByText("Example")).toBeInTheDocument();
    // The example is still flagged, for example-scoped styling.
    expect(screen.getByRole("list")).toHaveAttribute("data-example", "true");
  });

  it("does not flag an ordinary flow as an example", () => {
    render(
      <HubFlow>
        <HubFlowStep n={1} label="Real" last />
      </HubFlow>,
    );
    expect(screen.getByRole("list")).not.toHaveAttribute("data-example");
  });
});
