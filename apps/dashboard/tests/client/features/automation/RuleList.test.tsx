// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RuleList } from "../../../../src/client/features/automation/components/RuleList";
import type { ActionRule, Constants } from "../../../../src/client/shared/lib/schemas";

// Passthrough translator that interpolates {{name}} so we can assert the rule
// name is woven into accessible labels.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o && o.name ? `${k}:${o.name}` : k,
  }),
}));

const constants = {
  eventTypes: { memberJoin: { label: "Member Join", description: "" } },
  actionTypes: { sendMessage: { label: "Send Message" } },
} as unknown as Constants;

function makeRule(over: Partial<ActionRule> = {}): ActionRule {
  return {
    id: 1,
    name: "Welcome",
    eventType: "memberJoin",
    enabled: true,
    priority: 0,
    lastFired: null,
    actions: [{ type: "sendMessage" }],
    conditions: {},
    ...over,
  } as unknown as ActionRule;
}

const handlers = {
  onEdit: () => {},
  onDelete: () => {},
  onToggle: () => {},
  onDuplicate: () => {},
};

describe("RuleList accessibility", () => {
  it("labels the enable/disable switch and overflow menu with the rule name", () => {
    render(<RuleList rules={[makeRule()]} constants={constants} {...handlers} />);
    // Enabled rule → switch offers to disable, named for the rule
    expect(
      screen.getByRole("switch", { name: "ruleList.disableRuleNamed:Welcome" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ruleList.moreActions:Welcome" }),
    ).toBeInTheDocument();
  });

  it("exposes the rule name as a real button so keyboard users can open it", () => {
    render(<RuleList rules={[makeRule()]} constants={constants} {...handlers} />);
    expect(screen.getByRole("button", { name: "Welcome" })).toBeInTheDocument();
  });

  it("shows a non-color 'Disabled' indicator for disabled rules", () => {
    render(
      <RuleList
        rules={[makeRule({ enabled: false })]}
        constants={constants}
        {...handlers}
      />,
    );
    expect(screen.getByText("ruleList.disabledBadge")).toBeInTheDocument();
  });

  it("labels the selection checkbox with the rule name when selectable", () => {
    render(
      <RuleList
        rules={[makeRule()]}
        constants={constants}
        {...handlers}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "ruleList.selectRule:Welcome" }),
    ).toBeInTheDocument();
  });
});

/**
 * A saved rule can be dead: an action missing a required field never executes,
 * and the list showed it as perfectly healthy — "Never fired" with no
 * explanation. Rules created before the save-time guard, or through the API
 * and the /actions command, can still be in this state.
 */
describe("RuleList — incomplete rules are flagged", () => {
  const constants = {
    eventTypes: { memberJoin: { label: "Member Join", description: "" } },
    actionTypes: { sendMessage: { label: "Send Message", description: "" } },
    maxActionsPerRule: 5,
    actionTypeFields: {
      sendMessage: [
        { key: "channelId", label: "Channel", type: "channel" as const, required: true },
        { key: "message", label: "Message", type: "textarea" as const, required: true },
      ],
    },
    eventTypeVariables: { memberJoin: [] },
    templateVariables: {},
    eventConditionSupport: { memberJoin: ["user" as const, "role" as const] },
  };

  function ruleWith(actions: unknown[]) {
    return [{
      id: 1, guildId: "g1", name: "R", enabled: true, eventType: "memberJoin",
      actions, conditions: {}, priority: 0, createdBy: "u1", lastFired: null,
    }];
  }

  function renderList(actions: unknown[]) {
    render(
      <RuleList
        rules={ruleWith(actions) as never}
        constants={constants as never}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );
  }

  it("flags a rule whose action is missing a required field", () => {
    renderList([{ type: "sendMessage", message: "hi" }]);
    expect(screen.getByText("ruleList.misconfiguredBadge")).toBeInTheDocument();
  });

  it("flags a rule whose action has no type at all", () => {
    renderList([{ type: "" }]);
    expect(screen.getByText("ruleList.misconfiguredBadge")).toBeInTheDocument();
  });

  it("says nothing about a fully configured rule", () => {
    renderList([{ type: "sendMessage", channelId: "c1", message: "hi" }]);
    expect(screen.queryByText("ruleList.misconfiguredBadge")).not.toBeInTheDocument();
  });
});
