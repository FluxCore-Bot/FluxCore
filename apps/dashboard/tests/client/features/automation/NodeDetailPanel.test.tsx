// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NodeDetailPanel } from "../../../../src/client/features/automation/workflow/NodeDetailPanel";
import type { Constants, RuleStep } from "../../../../src/client/shared/lib/schemas";

// Stable passthrough translator — see the note in WorkflowEditor.test.tsx for
// why identity stability matters in this tree.
function translate(key: string, opts?: Record<string, unknown>): string {
  return opts ? `${key}:${JSON.stringify(opts)}` : key;
}
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate, i18n: { dir: () => "ltr" } }),
}));

vi.mock("../../../../src/client/shared/hooks/useChannels", () => ({
  useChannels: () => ({ data: [{ id: "c1", name: "general", type: 0 }] }),
}));
vi.mock("../../../../src/client/shared/hooks/useRoles", () => ({
  useRoles: () => ({ data: [{ id: "r1", name: "Members" }] }),
}));

// usePreviewContext reads these two react-query hooks. `{user}` carries a
// realKey, so the preview resolves it from buildRealData rather than the
// descriptor's sample — with no session that yields "@User".
vi.mock("../../../../src/client/shared/hooks/useAuth", () => ({
  useAuth: () => ({ data: undefined }),
}));
vi.mock("../../../../src/client/shared/hooks/useGuilds", () => ({
  useGuilds: () => ({ data: [] }),
}));

// Radix ScrollArea measures with ResizeObserver, absent in jsdom.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/**
 * memberJoin carries no message tokens; messageCreated does. The gap between
 * the two is what every assertion below turns on.
 */
const constants: Constants = {
  eventTypes: {
    memberJoin: { label: "Member Join", description: "" },
    messageCreated: { label: "Message Sent", description: "" },
  },
  actionTypes: { sendMessage: { label: "Send Message", description: "" } },
  maxActionsPerRule: 5,
  actionTypeFields: {
    sendMessage: [
      { key: "channelId", label: "Channel", type: "channel", required: true },
      { key: "message", label: "Message", type: "textarea", required: true },
    ],
  },
  eventTypeVariables: {
    memberJoin: ["{user}", "{guild}"],
    messageCreated: ["{user}", "{guild}", "{message.content}"],
  },
  templateVariables: {
    "{user}": "User mention",
    "{guild}": "Server name",
    "{message.content}": "Message content",
    "{ban.reason}": "Ban reason",
  },
};

const noop = () => {};

async function openVariablesTab() {
  await userEvent.click(await screen.findByRole("tab", { name: /panel\.variables/ }));
}

describe("NodeDetailPanel — action variables are scoped to the trigger", () => {
  it("lists only the trigger's variables in a linear action's Variables tab", async () => {
    render(
      <NodeDetailPanel
        type="action"
        index={0}
        action={{ type: "sendMessage" }}
        constants={constants}
        guildId="g1"
        eventType="memberJoin"
        totalActions={1}
        onActionChange={noop}
        onActionRemove={noop}
        onActionMove={noop}
        canRemove={false}
        onClose={noop}
      />,
    );

    await openVariablesTab();

    expect(screen.getByText("{user}")).toBeInTheDocument();
    expect(screen.getByText("{guild}")).toBeInTheDocument();
    // memberJoin has no message and no ban context — offering these tokens
    // tells the user to write a template the bot will render as "Unknown".
    expect(screen.queryByText("{message.content}")).not.toBeInTheDocument();
    expect(screen.queryByText("{ban.reason}")).not.toBeInTheDocument();
  });

  it("widens the list when the trigger provides more", async () => {
    render(
      <NodeDetailPanel
        type="action"
        index={0}
        action={{ type: "sendMessage" }}
        constants={constants}
        guildId="g1"
        eventType="messageCreated"
        totalActions={1}
        onActionChange={noop}
        onActionRemove={noop}
        onActionMove={noop}
        canRemove={false}
        onClose={noop}
      />,
    );

    await openVariablesTab();

    expect(screen.getByText("{message.content}")).toBeInTheDocument();
    expect(screen.queryByText("{ban.reason}")).not.toBeInTheDocument();
  });
});

describe("NodeDetailPanel — step-mode actions keep variables and preview", () => {
  const steps: RuleStep[] = [
    {
      id: "step_0",
      type: "action",
      action: { type: "sendMessage", channelId: "c1", message: "hi {user}" },
      next: null,
    },
  ];

  function renderStep() {
    return render(
      <NodeDetailPanel
        type="step"
        stepId="step_0"
        steps={steps}
        constants={constants}
        guildId="g1"
        eventType="memberJoin"
        onStepChange={noop}
        onStepRemove={noop}
        onClose={noop}
      />,
    );
  }

  // Adding a single condition or delay converts the whole rule to step mode.
  // Before this, that silently stripped the variable reference and the message
  // preview from every action in the rule.
  it("offers a Variables tab scoped to the trigger", async () => {
    renderStep();

    await openVariablesTab();

    expect(screen.getByText("{user}")).toBeInTheDocument();
    expect(screen.queryByText("{message.content}")).not.toBeInTheDocument();
  });

  it("renders the Discord message preview for a sendMessage step", () => {
    renderStep();

    expect(screen.getByText("hi @User")).toBeInTheDocument();
  });
});
