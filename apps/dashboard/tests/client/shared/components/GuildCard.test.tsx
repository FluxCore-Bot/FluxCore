// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuildCard } from "../../../../src/client/shared/components/GuildCard";
import type { Guild } from "../../../../src/client/shared/lib/schemas";

// Passthrough translator that interpolates {{name}}, so we can assert the guild
// name is woven into the invite link's accessible label.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o && o.name ? `${k}:${o.name}` : k,
  }),
}));

// Render <Link> as a plain anchor — GuildCard is unit-tested without a router.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params: Record<string, string>;
    children: React.ReactNode;
  }) => (
    <a
      href={Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`$${k}`, v),
        to,
      )}
      {...rest}
    >
      {children}
    </a>
  ),
}));

const INVITE =
  "https://discord.com/oauth2/authorize?client_id=abc&permissions=8&scope=bot%20applications.commands";

function makeGuild(over: Partial<Guild> = {}): Guild {
  return { id: "123", name: "Test Guild", icon: null, botPresent: true, ...over };
}

describe("GuildCard", () => {
  it("links an installed guild to its dashboard overview", () => {
    render(<GuildCard guild={makeGuild()} inviteUrl={INVITE} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/guild/123/overview");
    expect(screen.getByText("Test Guild")).toBeInTheDocument();
    expect(screen.queryByText("badge.botNotAdded")).not.toBeInTheDocument();
  });

  it("marks a guild the bot is not in and links it to a preselected invite", () => {
    render(
      <GuildCard guild={makeGuild({ botPresent: false })} inviteUrl={INVITE} />,
    );

    expect(screen.getByText("badge.botNotAdded")).toBeInTheDocument();

    const link = screen.getByRole("link");
    const href = link.getAttribute("href")!;
    expect(href).toContain(INVITE);
    expect(href).toContain("guild_id=123");
    expect(href).toContain("disable_guild_select=true");
    // Never routes into the dashboard — that would 403 with botNotInGuild.
    expect(href).not.toContain("/guild/123/overview");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAccessibleName("addBotTo:Test Guild");
  });

  it("renders no link when the invite URL has not loaded yet", () => {
    render(<GuildCard guild={makeGuild({ botPresent: false })} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("badge.botNotAdded")).toBeInTheDocument();
    expect(screen.getByText("Test Guild")).toBeInTheDocument();
  });
});
