// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { buildActionTypeOptions } from "../../../../src/client/features/automation/lib/action-options";

const actionTypes = {
  sendMessage: { label: "Send Message", description: "Send a message to a channel" },
  mysteryAction: { label: "Mystery", description: "Unknown action" },
};

describe("buildActionTypeOptions", () => {
  it("maps value, label, and description into keywords", () => {
    const opts = buildActionTypeOptions(actionTypes);
    expect(opts).toHaveLength(2);
    expect(opts[0]).toMatchObject({
      value: "sendMessage",
      label: "Send Message",
      keywords: "Send a message to a channel",
    });
  });

  it("uses ACTION_ICONS for known types and falls back to 'bolt' for unknown", () => {
    const opts = buildActionTypeOptions(actionTypes);
    const send = opts.find((o) => o.value === "sendMessage")!;
    const mystery = opts.find((o) => o.value === "mysteryAction")!;
    expect(isValidElement(send.icon)).toBe(true);
    expect((send.icon as ReactElement<{ name: string }>).props.name).toBe("chat");
    expect((mystery.icon as ReactElement<{ name: string }>).props.name).toBe("bolt");
  });
});
