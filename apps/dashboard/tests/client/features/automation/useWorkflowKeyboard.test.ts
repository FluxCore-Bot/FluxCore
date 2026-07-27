// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWorkflowKeyboard } from "../../../../src/client/features/automation/workflow/useWorkflowKeyboard";

function setup(over: Partial<Parameters<typeof useWorkflowKeyboard>[0]> = {}) {
  const opts = {
    selectedNode: null,
    isStepMode: false,
    actionsLength: 1,
    contextMenuOpen: false,
    onClose: vi.fn(),
    onDeselectNode: vi.fn(),
    onSubmit: vi.fn(),
    onFitView: vi.fn(),
    onAddAction: vi.fn(),
    onActionRemove: vi.fn(),
    onActionReset: vi.fn(),
    onActionMove: vi.fn(),
    onStepRemove: vi.fn(),
    onOpenContextMenu: vi.fn(),
    ...over,
  };
  renderHook(() => useWorkflowKeyboard(opts));
  return opts;
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, ...init });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("useWorkflowKeyboard context menu binding", () => {
  it("opens the menu on the dedicated ContextMenu key", () => {
    const opts = setup();
    press("ContextMenu");
    expect(opts.onOpenContextMenu).toHaveBeenCalledTimes(1);
  });

  it("opens the menu on Shift+F10", () => {
    const opts = setup();
    press("F10", { shiftKey: true });
    expect(opts.onOpenContextMenu).toHaveBeenCalledTimes(1);
  });

  it("ignores a bare F10", () => {
    const opts = setup();
    press("F10");
    expect(opts.onOpenContextMenu).not.toHaveBeenCalled();
  });

  it("stays inert while focus is in a text input", () => {
    const opts = setup();
    const input = document.createElement("input");
    document.body.appendChild(input);
    press("ContextMenu", {}, input);
    expect(opts.onOpenContextMenu).not.toHaveBeenCalled();
  });

  it("still handles the pre-existing bindings", () => {
    const opts = setup();
    press("Escape");
    expect(opts.onClose).toHaveBeenCalled();
    press("a");
    expect(opts.onAddAction).toHaveBeenCalled();
  });
});

describe("useWorkflowKeyboard while the context menu is open", () => {
  // Radix's dismissable layer preventDefault()s Escape but does NOT stop its
  // propagation, so every one of these events really does reach the window
  // listener — the hotkey layer must stand down rather than act on them.

  it("Escape dismisses only the menu — it must not close the editor", () => {
    const opts = setup({ contextMenuOpen: true });
    press("Escape");
    expect(opts.onClose).not.toHaveBeenCalled();
    expect(opts.onDeselectNode).not.toHaveBeenCalled();
  });

  it("a bare \"a\" belongs to Radix's typeahead, not the add-action hotkey", () => {
    const opts = setup({ contextMenuOpen: true });
    press("a");
    expect(opts.onAddAction).not.toHaveBeenCalled();
  });

  it("a second Shift+F10 stays inert, keeping the original focus origin", () => {
    const opts = setup({ contextMenuOpen: true });
    press("F10", { shiftKey: true });
    press("ContextMenu");
    expect(opts.onOpenContextMenu).not.toHaveBeenCalled();
  });

  it("ignores keys an overlay has already handled and cancelled", () => {
    const opts = setup();
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(opts.onClose).not.toHaveBeenCalled();
  });
});
