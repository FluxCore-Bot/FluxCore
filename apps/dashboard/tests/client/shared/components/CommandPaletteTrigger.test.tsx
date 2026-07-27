// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPaletteTrigger } from "../../../../src/client/shared/components/CommandPaletteTrigger";
import {
  CommandPaletteProvider, useCommandPalette,
} from "../../../../src/client/shared/command-palette/useCommandPalette";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../src/client/shared/components/Icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

function State() {
  const { isOpen } = useCommandPalette();
  return <span data-testid="state">{isOpen ? "open" : "closed"}</span>;
}

function setup() {
  const user = userEvent.setup();
  render(
    <CommandPaletteProvider>
      <CommandPaletteTrigger />
      <State />
    </CommandPaletteProvider>,
  );
  return { user };
}

describe("CommandPaletteTrigger", () => {
  it("is a labelled button", () => {
    setup();
    expect(screen.getByRole("button", { name: "palette.open" })).toBeInTheDocument();
  });

  it("opens the palette on click", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "palette.open" }));
    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });

  it("shows the shortcut chip", () => {
    setup();
    expect(screen.getByText(/K$/)).toBeInTheDocument();
  });

  it("meets the 44px minimum hit area", () => {
    setup();
    const button = screen.getByRole("button", { name: "palette.open" });
    expect(button.className).toMatch(/min-h-11/);
  });
});
