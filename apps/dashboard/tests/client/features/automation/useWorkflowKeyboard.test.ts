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

/**
 * Escape was explicitly allowed through from form controls, and Escape with
 * no node selected closes the whole editor. So typing a rule name and
 * pressing Escape out of habit to revert the field tore down the full-screen
 * editor — and for an existing rule that discarded every unsaved edit, since
 * the per-rule draft is never read back.
 */
describe("useWorkflowKeyboard — Escape inside a form control", () => {
  function withFocusedInput(tag: "input" | "textarea" | "select") {
    const el = document.createElement(tag);
    document.body.appendChild(el);
    el.focus();
    return el;
  }

  it("blurs the field instead of closing the editor", () => {
    const opts = setup();
    const input = withFocusedInput("input");

    press("Escape", {}, input);

    expect(opts.onClose).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(input);
  });

  it("does not deselect the open node either", () => {
    const opts = setup({ selectedNode: { type: "action", index: 0 } });
    const input = withFocusedInput("input");

    press("Escape", {}, input);

    expect(opts.onDeselectNode).not.toHaveBeenCalled();
    expect(opts.onClose).not.toHaveBeenCalled();
  });

  it("applies to textareas and selects too", () => {
    const opts = setup();
    for (const tag of ["textarea", "select"] as const) {
      press("Escape", {}, withFocusedInput(tag));
    }
    expect(opts.onClose).not.toHaveBeenCalled();
  });

  it("still closes the editor when Escape comes from the canvas", () => {
    const opts = setup();

    press("Escape");

    expect(opts.onClose).toHaveBeenCalledTimes(1);
  });

  it("still deselects an open node when Escape comes from the canvas", () => {
    const opts = setup({ selectedNode: { type: "action", index: 0 } });

    press("Escape");

    expect(opts.onDeselectNode).toHaveBeenCalledTimes(1);
    expect(opts.onClose).not.toHaveBeenCalled();
  });

  it("keeps Ctrl+S working from inside a field", () => {
    const opts = setup();
    const input = withFocusedInput("input");

    press("s", { ctrlKey: true }, input);

    expect(opts.onSubmit).toHaveBeenCalledTimes(1);
  });
});
