// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  GuildSearch,
  filterGuilds,
} from "../../../../src/client/shared/components/GuildSearch";
import type { Guild } from "../../../../src/client/shared/lib/schemas";

// Echoes the interpolation payload verbatim, so tests can assert exactly which
// variables the component passes to i18next.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}:${JSON.stringify(o)}` : k,
  }),
}));

function g(name: string, over: Partial<Guild> = {}): Guild {
  return { id: name, name, icon: null, botPresent: true, ...over };
}

describe("filterGuilds", () => {
  const guilds = [g("Alpha Squad"), g("Bravo Team"), g("charlie club")];

  it("returns everything for an empty or whitespace query", () => {
    expect(filterGuilds(guilds, "")).toEqual(guilds);
    expect(filterGuilds(guilds, "   ")).toEqual(guilds);
  });

  it("matches case-insensitively on a substring of the name", () => {
    expect(filterGuilds(guilds, "brav").map((x) => x.name)).toEqual(["Bravo Team"]);
    expect(filterGuilds(guilds, "CHARLIE").map((x) => x.name)).toEqual(["charlie club"]);
    expect(filterGuilds(guilds, "team").map((x) => x.name)).toEqual(["Bravo Team"]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(filterGuilds(guilds, "  alpha  ").map((x) => x.name)).toEqual(["Alpha Squad"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterGuilds(guilds, "zzz")).toEqual([]);
  });

  it("preserves the server-provided ordering", () => {
    const mixed = [g("Zulu"), g("Alpha"), g("Mike")];
    expect(filterGuilds(mixed, "").map((x) => x.name)).toEqual(["Zulu", "Alpha", "Mike"]);
  });

  it("filters bot-less guilds the same as installed ones", () => {
    const mixed = [g("Alpha", { botPresent: false }), g("Beta")];
    expect(filterGuilds(mixed, "alpha").map((x) => x.name)).toEqual(["Alpha"]);
  });
});

describe("GuildSearch", () => {
  it("reports each keystroke to the caller", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<GuildSearch value="" onChange={onChange} resultCount={3} />);

    await user.type(screen.getByTestId("guild-search"), "ab");

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith("b");
  });

  it("announces the result count in a live region", () => {
    render(<GuildSearch value="al" onChange={() => {}} resultCount={2} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    // Interpolated as `total`, never `count`: passing `count` would make
    // i18next resolve plural suffixes, which all 48 locales would then have to
    // supply correctly (_few/_many/... vary per language).
    expect(status).toHaveTextContent('search.resultCount:{"total":2}');
  });

  it("labels the input for screen readers", () => {
    render(<GuildSearch value="" onChange={() => {}} resultCount={0} />);

    expect(
      screen.getByRole("searchbox", { name: "search.placeholder" }),
    ).toBeInTheDocument();
  });
});
