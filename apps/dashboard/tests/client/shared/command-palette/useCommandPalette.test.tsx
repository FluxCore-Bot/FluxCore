// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CommandPaletteProvider,
  useCommandPalette,
} from "../../../../src/client/shared/command-palette/useCommandPalette";

function Probe() {
  const { isOpen, open, close } = useCommandPalette();
  return (
    <div>
      <span data-testid="state">{isOpen ? "open" : "closed"}</span>
      <button onClick={open}>open</button>
      <button onClick={close}>close</button>
      <input aria-label="text field" />
    </div>
  );
}

function renderProbe() {
  return render(
    <CommandPaletteProvider>
      <Probe />
    </CommandPaletteProvider>,
  );
}

describe("useCommandPalette", () => {
  it("starts closed", () => {
    renderProbe();
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("opens on Ctrl+K", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });

  it("opens on Meta+K", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });

  it("opens on Ctrl+P", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.keyboard("{Control>}p{/Control}");
    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });

  it("toggles closed when the hotkey fires again", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("prevents the browser default so Ctrl+P does not open print", () => {
    renderProbe();
    const event = new KeyboardEvent("keydown", {
      key: "p", ctrlKey: true, bubbles: true, cancelable: true,
    });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores the hotkey while disabled", async () => {
    const user = userEvent.setup();
    render(
      <CommandPaletteProvider enabled={false}>
        <Probe />
      </CommandPaletteProvider>,
    );
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("leaves Ctrl+P to the browser while disabled", () => {
    render(
      <CommandPaletteProvider enabled={false}>
        <Probe />
      </CommandPaletteProvider>,
    );
    const event = new KeyboardEvent("keydown", {
      key: "p", ctrlKey: true, bubbles: true, cancelable: true,
    });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
  });

  it("still opens while a text field has focus", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByLabelText("text field"));
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });

  it("does not hijack an unmodified keypress in a text field", async () => {
    const user = userEvent.setup();
    renderProbe();
    const field = screen.getByLabelText("text field");
    await user.click(field);
    await user.keyboard("k");
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
    expect(field).toHaveValue("k");
  });

  it("throws a useful error when used outside the provider", () => {
    function Orphan() {
      useCommandPalette();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(/CommandPaletteProvider/);
  });
});
