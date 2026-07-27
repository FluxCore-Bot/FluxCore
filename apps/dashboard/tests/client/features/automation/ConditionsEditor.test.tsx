// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConditionsEditor } from "../../../../src/client/features/automation/components/ConditionsEditor";

function translate(key: string, opts?: Record<string, unknown>): string {
  return opts ? `${key}:${JSON.stringify(opts)}` : key;
}
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate, i18n: { dir: () => "ltr" } }),
}));

// DiscordMultiSelect fetches guild channels/roles; the group's presence is what
// these tests assert, not its contents.
vi.mock("../../../../src/client/shared/ui/discord-multi-select", () => ({
  DiscordMultiSelect: ({ label, type }: { label: string; type: string }) => (
    <div data-testid={`multiselect-${type}-${label}`}>{label}</div>
  ),
}));

// The member picker queries the new /members endpoint; its own behaviour is
// covered separately. Here only its presence per trigger matters.
vi.mock("../../../../src/client/shared/ui/member-multi-select", () => ({
  MemberMultiSelect: ({ label }: { label: string }) => (
    <div data-testid={`memberselect-${label}`}>{label}</div>
  ),
}));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const noop = () => {};

describe("ConditionsEditor — only offers filters the trigger can satisfy", () => {
  // Filters fail closed (executor.ts matchesConditions), so offering a filter
  // the event context can never answer does not merely do nothing — it
  // silently stops the rule from ever firing.
  it("hides channel filters for a trigger that carries no channel", () => {
    render(
      <ConditionsEditor
        guildId="g1"
        conditions={{}}
        onChange={noop}
        supported={["user", "role"]}
        alwaysExpanded
      />,
    );

    expect(screen.queryByTestId(/multiselect-any-/)).not.toBeInTheDocument();
    // Role filters survive, in both the include and the exclude group.
    expect(screen.getAllByTestId(/multiselect-role-/)).toHaveLength(2);
  });

  it("hides role filters for a trigger with no member in context", () => {
    render(
      <ConditionsEditor
        guildId="g1"
        conditions={{}}
        onChange={noop}
        supported={["user"]}
        alwaysExpanded
      />,
    );

    expect(screen.queryByTestId(/multiselect-role-/)).not.toBeInTheDocument();
  });

  it("hides user filters for a trigger with no acting user", () => {
    render(
      <ConditionsEditor
        guildId="g1"
        conditions={{}}
        onChange={noop}
        supported={["channel"]}
        alwaysExpanded
      />,
    );

    expect(screen.queryByTestId(/memberselect-/)).not.toBeInTheDocument();
  });

  it("offers everything when the trigger supports everything", () => {
    render(
      <ConditionsEditor
        guildId="g1"
        conditions={{}}
        onChange={noop}
        supported={["user", "role", "channel"]}
        alwaysExpanded
      />,
    );

    expect(screen.getAllByTestId(/multiselect-any-/)).toHaveLength(2);
    expect(screen.getAllByTestId(/multiselect-role-/)).toHaveLength(2);
  });

  it("offers everything when no trigger is chosen yet", () => {
    render(
      <ConditionsEditor guildId="g1" conditions={{}} onChange={noop} alwaysExpanded />,
    );

    expect(screen.getAllByTestId(/multiselect-any-/)).toHaveLength(2);
    expect(screen.getAllByTestId(/multiselect-role-/)).toHaveLength(2);
  });
});

describe("ConditionsEditor — flags filters saved against an incompatible trigger", () => {
  // A rule built before the trigger was changed (or before filters failed
  // closed) can carry a filter its trigger can never satisfy. Because the
  // runtime now refuses to fire it, the editor has to say so.
  it("warns when a stored filter cannot be evaluated by the trigger", () => {
    render(
      <ConditionsEditor
        guildId="g1"
        conditions={{ channelIds: ["c1"] }}
        onChange={noop}
        supported={["user", "role"]}
        alwaysExpanded
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("conditions.unsupportedWarning");
  });

  it("offers to clear the filters that cannot apply", async () => {
    const onChange = vi.fn();
    render(
      <ConditionsEditor
        guildId="g1"
        conditions={{ channelIds: ["c1"], userIds: ["u1"] }}
        onChange={onChange}
        supported={["user", "role"]}
        alwaysExpanded
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /conditions\.removeUnsupported/ }));

    // The unusable channel filter goes; the usable user filter stays.
    expect(onChange).toHaveBeenCalledWith({ userIds: ["u1"] });
  });

  it("stays quiet when every stored filter is supported", () => {
    render(
      <ConditionsEditor
        guildId="g1"
        conditions={{ userIds: ["u1"] }}
        onChange={noop}
        supported={["user", "role"]}
        alwaysExpanded
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
