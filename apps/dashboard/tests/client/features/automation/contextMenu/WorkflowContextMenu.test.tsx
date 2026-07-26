// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowContextMenu } from "../../../../../src/client/features/automation/workflow/contextMenu/WorkflowContextMenu";
import type { ContextMenuSection } from "../../../../../src/client/features/automation/workflow/contextMenu/types";

// `vi.mock` factories are hoisted above these imports, so the mutable "current
// direction" has to live in a `vi.hoisted` cell rather than a plain module
// variable — that lets individual tests flip it (ltr/rtl) between renders.
const mockDirection = vi.hoisted(() => ({ current: "ltr" as "ltr" | "rtl" }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.label ? `${k}:${o.label}` : k),
    i18n: { dir: () => mockDirection.current },
  }),
}));

// Radix's popper and menu need these; jsdom ships none of them.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.scrollIntoView ??= () => {};
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
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
  const sections = over.sections ?? makeSections();
  render(
    <WorkflowContextMenu
      open
      x={120}
      y={80}
      ariaLabel="contextMenu.menuLabel:Send message"
      sections={sections}
      onClose={onClose}
      {...over}
    />,
  );
  return { onClose, sections };
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
