// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWorkflowKeyboard } from "../../../../src/client/features/automation/workflow/useWorkflowKeyboard";

function setup(over: Partial<Parameters<typeof useWorkflowKeyboard>[0]> = {}) {
  const opts = {
    selectedNode: null,
    isStepMode: false,
    actionsLength: 1,
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
