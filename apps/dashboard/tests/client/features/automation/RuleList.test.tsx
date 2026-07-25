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
