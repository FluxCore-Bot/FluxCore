// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "../../../../src/client/shared/ui/searchable-select";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const options: SearchableSelectOption[] = [
  { value: "memberJoin", label: "Member Join", keywords: "when a new member joins" },
  { value: "messageDeleted", label: "Message Deleted", keywords: "when a message is deleted" },
  { value: "boostStart", label: "Boost Start", keywords: "when a member starts boosting" },
];

function setup(props: Partial<React.ComponentProps<typeof SearchableSelect>> = {}) {
  const onValueChange = vi.fn();
  render(
    <SearchableSelect
      options={options}
      value={null}
      onValueChange={onValueChange}
      placeholder="Select event"
      searchPlaceholder="Search events"
      noResultsLabel="No events found"
      {...props}
    />,
  );
  return { onValueChange };
}

describe("SearchableSelect", () => {
  it("shows the placeholder when nothing is selected", () => {
    setup();
    expect(screen.getByText("Select event")).toBeInTheDocument();
  });

  it("opens and lists all options on trigger click", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Member Join")).toBeInTheDocument();
    expect(screen.getByText("Message Deleted")).toBeInTheDocument();
    expect(screen.getByText("Boost Start")).toBeInTheDocument();
  });

  it("filters options by label as the user types", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("Search events"), "boost");
    expect(screen.getByText("Boost Start")).toBeInTheDocument();
    expect(screen.queryByText("Member Join")).not.toBeInTheDocument();
  });

  it("filters options by keywords, not just label", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button"));
    // "joins" appears only in Member Join's keywords, not its label.
    await user.type(screen.getByPlaceholderText("Search events"), "joins");
    expect(screen.getByText("Member Join")).toBeInTheDocument();
    expect(screen.queryByText("Boost Start")).not.toBeInTheDocument();
  });

  it("shows the no-results label when nothing matches", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("Search events"), "zzzzz");
    expect(screen.getByText("No events found")).toBeInTheDocument();
  });

  it("calls onValueChange with the value and closes on select", async () => {
    const user = userEvent.setup();
    const { onValueChange } = setup();
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Message Deleted"));
    expect(onValueChange).toHaveBeenCalledWith("messageDeleted");
    expect(screen.queryByPlaceholderText("Search events")).not.toBeInTheDocument();
  });

  it("renders the allowNone row and emits null when picked", async () => {
    const user = userEvent.setup();
    const { onValueChange } = setup({ allowNone: true, noneLabel: "None", value: "memberJoin" });
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("None"));
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it("renders the error label instead of the trigger when error", () => {
    setup({ error: true, errorLabel: "Failed to load" });
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
    expect(screen.queryByText("Select event")).not.toBeInTheDocument();
  });

  it("renders neither trigger text nor options when loading", () => {
    setup({ loading: true });
    expect(screen.queryByText("Select event")).not.toBeInTheDocument();
  });

  it("forwards id and aria-required to the trigger for label association", () => {
    render(
      <SearchableSelect
        options={options}
        value={null}
        onValueChange={vi.fn()}
        placeholder="Select event"
        id="my-field"
        required
      />,
    );
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("id", "my-field");
    expect(trigger).toHaveAttribute("aria-required", "true");
  });
});
