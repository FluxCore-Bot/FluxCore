// @vitest-environment jsdom
import { useState } from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowContextMenu } from "../../../../../src/client/features/automation/workflow/contextMenu/WorkflowContextMenu";
import type { ContextMenuSection } from "../../../../../src/client/features/automation/workflow/contextMenu/types";

// `vi.mock` factories are hoisted above these imports, so the mutable "current
// direction" has to live in a `vi.hoisted` cell rather than a plain module
// variable — that lets individual tests flip it (ltr/rtl) between renders.
const mockDirection = vi.hoisted((): { current: "ltr" | "rtl" } => ({ current: "ltr" }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.label ? `${k}:${o.label}` : k),
    i18n: { dir: () => mockDirection.current },
  }),
}));

// Radix's popper and menu need these; jsdom ships none of them. The stub
// class implements the real ResizeObserver interface, so the assignment
// typechecks without any cast; the Element.prototype methods are declared in
// lib.dom and simply missing from jsdom at runtime, so `??=` fills each one
// with a compatible function.
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = ResizeObserverStub;
  }
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
});

function makeSections(onSelect = vi.fn(), disabledSelect = vi.fn()): ContextMenuSection[] {
  return [
    [
      { id: "configure", labelKey: "contextMenu.configure", icon: "tune", onSelect },
      {
        id: "duplicate",
        labelKey: "ruleList.duplicate",
        icon: "content_copy",
        disabled: true,
        onSelect: disabledSelect,
      },
    ],
    [
      {
        id: "delete",
        labelKey: "panel.removeStep",
        icon: "delete",
        shortcut: "Del",
        danger: true,
        onSelect: vi.fn(),
      },
    ],
  ];
}

function setup(over: Partial<React.ComponentProps<typeof WorkflowContextMenu>> = {}) {
  const onClose = vi.fn();
  const onRestoreFocus = vi.fn();
  const sections = over.sections ?? makeSections();
  render(
    <WorkflowContextMenu
      open
      x={120}
      y={80}
      ariaLabel="contextMenu.menuLabel:Send message"
      sections={sections}
      onClose={onClose}
      onRestoreFocus={onRestoreFocus}
      {...over}
    />,
  );
  return { onClose, onRestoreFocus, sections };
}

describe("WorkflowContextMenu", () => {
  afterEach(() => {
    mockDirection.current = "ltr";
  });

  it("renders every item, translated, when open", async () => {
    setup();
    expect(await screen.findByRole("menuitem", { name: /contextMenu.configure/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /ruleList.duplicate/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /panel.removeStep/ })).toBeInTheDocument();
  });

  it("names the menu after its target", async () => {
    setup();
    expect(await screen.findByRole("menu", { name: "contextMenu.menuLabel:Send message" }))
      .toBeInTheDocument();
  });

  it("renders the shortcut hint alongside its item", async () => {
    setup();
    expect(await screen.findByText("Del")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    setup({ open: false });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("fires onSelect and closes when an item is chosen", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { onClose } = setup({ sections: makeSections(onSelect) });
    await user.click(await screen.findByRole("menuitem", { name: /contextMenu.configure/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not fire a disabled item", async () => {
    const user = userEvent.setup();
    const disabledSelect = vi.fn();
    setup({ sections: makeSections(vi.fn(), disabledSelect) });
    await user.click(await screen.findByRole("menuitem", { name: /ruleList.duplicate/ }));
    expect(disabledSelect).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("hands focus restoration to its caller instead of the dead anchor", async () => {
    const user = userEvent.setup();
    const onRestoreFocus = vi.fn();

    // `setup()` holds `open` at true, so Escape would never tear the menu
    // down and the close-auto-focus event would never fire. This harness
    // unmounts the menu on close, exactly as WorkflowEditor does.
    function Harness() {
      const [open, setOpen] = useState(true);
      return open ? (
        <WorkflowContextMenu
          open
          x={120}
          y={80}
          ariaLabel="contextMenu.menuLabel:Send message"
          sections={makeSections()}
          onClose={() => setOpen(false)}
          onRestoreFocus={onRestoreFocus}
        />
      ) : null;
    }
    render(<Harness />);
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");

    // Radix's own close-auto-focus targets the trigger — the 0×0 aria-hidden
    // anchor — so the component must preempt it and delegate. FocusScope
    // dispatches the unmount event from a setTimeout(0).
    await waitFor(() => expect(onRestoreFocus).toHaveBeenCalledTimes(1));
  });

  it("separates sections", async () => {
    setup();
    await screen.findByRole("menu");
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("anchors at the cursor and hides the anchor from assistive tech", () => {
    setup();
    const anchor = screen.getByTestId("workflow-context-menu-anchor");
    expect(anchor).toHaveAttribute("aria-hidden", "true");
    expect(anchor).toHaveStyle({ position: "fixed", left: "120px", top: "80px" });
  });

  it("mounts after an existing body-level overlay, so it paints above it", async () => {
    // The editor portals itself to <body> at z-50 and so does the menu; the menu
    // wins only because it mounts later in document order. Assert that ordering
    // rather than trusting it.
    const editorOverlay = document.createElement("div");
    document.body.appendChild(editorOverlay);
    setup();
    const menu = await screen.findByRole("menu");
    expect(editorOverlay.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it.each(["ltr", "rtl"] as const)(
    "applies the document's %s direction to the rendered menu",
    async (direction) => {
      mockDirection.current = direction;
      setup();
      expect(await screen.findByRole("menu")).toHaveAttribute("dir", direction);
    },
  );
});
