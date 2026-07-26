// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "../../../../src/client/shared/command-palette/CommandPalette";
import {
  CommandPaletteProvider,
} from "../../../../src/client/shared/command-palette/useCommandPalette";
import type { Command } from "../../../../src/client/shared/command-palette/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}:${Object.values(o).join(",")}` : k,
  }),
}));

vi.mock("../../../../src/client/shared/components/Icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

const commands: Command[] = [
  { id: "p1", group: "pages", title: "Overview", icon: "dashboard", to: "/a" },
  { id: "p2", group: "pages", title: "Moderation", icon: "shield", to: "/b" },
  { id: "a1", group: "actions", title: "Log out", icon: "logout", href: "/auth/logout" },
  { id: "s1", group: "servers", title: "Etqan", icon: "dns", to: "/c" },
];

function setup(onNavigate = vi.fn()) {
  const user = userEvent.setup();
  render(
    <CommandPaletteProvider>
      <CommandPalette commands={commands} onNavigate={onNavigate} />
    </CommandPaletteProvider>,
  );
  return { user, onNavigate };
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{Control>}k{/Control}");
}

describe("CommandPalette", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing until opened", () => {
    setup();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("exposes a combobox wired to a listbox", async () => {
    const { user } = setup();
    await open(user);
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
  });

  it("keeps DOM focus in the input and tracks the cursor with aria-activedescendant", async () => {
    const { user } = setup();
    await open(user);
    const input = screen.getByRole("combobox");
    expect(input).toHaveFocus();

    const options = screen.getAllByRole("option");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("wraps the cursor at both ends", async () => {
    const { user } = setup();
    await open(user);
    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");

    await user.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", options[options.length - 1].id);

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
  });

  it("jumps to first and last with Home and End", async () => {
    const { user } = setup();
    await open(user);
    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");

    await user.keyboard("{End}");
    expect(input).toHaveAttribute("aria-activedescendant", options[options.length - 1].id);

    await user.keyboard("{Home}");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
  });

  it("groups results under translated headers in a fixed order", async () => {
    const { user } = setup();
    await open(user);
    const headers = screen.getAllByRole("presentation").map((el) => el.textContent);
    expect(headers).toEqual([
      "palette.group.pages",
      "palette.group.actions",
      "palette.group.servers",
    ]);
  });

  it("announces how many rows a capped group is hiding", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`, group: "servers" as const, title: `Server ${i}`,
      icon: "dns", to: "/x",
    }));
    render(
      <CommandPaletteProvider>
        <CommandPalette commands={many} onNavigate={vi.fn()} />
      </CommandPaletteProvider>,
    );
    await open(user);
    // 8 matches, capped at 5 → 3 hidden.
    expect(screen.getByText("palette.more:3")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(5);
  });

  it("shows no overflow hint when nothing is hidden", async () => {
    const { user } = setup();
    await open(user);
    expect(screen.queryByText(/^palette\.more/)).not.toBeInTheDocument();
  });

  it("filters as the user types", async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByRole("combobox"), "mod");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Moderation");
  });

  it("highlights the matched run", async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByRole("combobox"), "mod");
    const mark = within(screen.getByRole("option")).getByText("Mod");
    expect(mark.tagName).toBe("MARK");
  });

  it("resets the cursor to the top when the query changes", async () => {
    const { user } = setup();
    await open(user);
    const input = screen.getByRole("combobox");
    await user.keyboard("{ArrowDown}");
    await user.type(input, "e");
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0].id);
  });

  it("activates the cursor row on Enter", async () => {
    const { user, onNavigate } = setup();
    await open(user);
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    // Render order is alphabetical, not insertion order: an empty query scores
    // every command 0, so buildGroups falls through to localeCompare. The
    // pages group renders Moderation (p2) then Overview (p1), so one ArrowDown
    // from the top lands on p1.
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1", title: "Overview" }),
    );
  });

  it("activates a row on click", async () => {
    const { user, onNavigate } = setup();
    await open(user);
    await user.click(screen.getByText("Etqan"));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
  });

  it("closes after a selection", async () => {
    const { user } = setup();
    await open(user);
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const { user } = setup();
    await open(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("clears the query between openings", async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByRole("combobox"), "mod");
    await user.keyboard("{Escape}");
    await open(user);
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("shows an empty state naming the query", async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByRole("combobox"), "zzzz");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByText("palette.empty:zzzz")).toBeInTheDocument();
  });

  it("announces the result count politely", async () => {
    const { user } = setup();
    await open(user);
    const live = screen.getByRole("status");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveTextContent("palette.resultCount:4");
  });

  it("does not activate anything on Enter with no results", async () => {
    const { user, onNavigate } = setup();
    await open(user);
    await user.type(screen.getByRole("combobox"), "zzzz");
    await user.keyboard("{Enter}");
    expect(onNavigate).not.toHaveBeenCalled();
  });

  /**
   * Recent destinations are re-grouped COPIES that keep the original's `id`, so
   * the same id legitimately appears twice in the flattened list. A row's
   * identity is therefore (group, id), not id alone. Keying option ids or cursor
   * lookups on `id` by itself makes the copy and its original indistinguishable.
   */
  describe("duplicate ids across groups", () => {
    const withRecent: Command[] = [
      { id: "p1", group: "recent", title: "Overview", icon: "dashboard", to: "/a" },
      ...commands,
    ];

    function setupDuped(onNavigate = vi.fn()) {
      const user = userEvent.setup();
      render(
        <CommandPaletteProvider>
          <CommandPalette commands={withRecent} onNavigate={onNavigate} />
        </CommandPaletteProvider>,
      );
      return { user, onNavigate };
    }

    it("gives every row a unique DOM id", async () => {
      const { user } = setupDuped();
      await open(user);
      const ids = screen.getAllByRole("option").map((el) => el.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("marks exactly one row selected when a copy shares an id", async () => {
      const { user } = setupDuped();
      await open(user);
      const selected = screen
        .getAllByRole("option")
        .filter((el) => el.getAttribute("aria-selected") === "true");
      expect(selected).toHaveLength(1);
    });

    it("moves the cursor to the hovered row, not its same-id twin", async () => {
      const { user } = setupDuped();
      await open(user);
      // "Overview" renders twice: once under Recent (first group) and once
      // under Pages. Hovering the second must not select the first.
      const overviews = screen
        .getAllByRole("option")
        .filter((el) => el.textContent?.includes("Overview"));
      expect(overviews).toHaveLength(2);
      const pagesCopy = overviews[1];

      await user.hover(pagesCopy);
      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-activedescendant",
        pagesCopy.id,
      );
      expect(pagesCopy).toHaveAttribute("aria-selected", "true");
      expect(overviews[0]).toHaveAttribute("aria-selected", "false");
    });
  });
});
