import { describe, it, expect } from "vitest";
import { buildGroups, flatten } from "../../../../src/client/shared/command-palette/useCommandSources";
import type { Command } from "../../../../src/client/shared/command-palette/types";

function cmd(over: Partial<Command> & Pick<Command, "id">): Command {
  return { group: "pages", title: over.id, icon: "dashboard", ...over };
}

describe("buildGroups", () => {
  it("orders groups pages → actions → servers", () => {
    const groups = buildGroups(
      [
        cmd({ id: "s", group: "servers", title: "Server" }),
        cmd({ id: "a", group: "actions", title: "Action" }),
        cmd({ id: "p", group: "pages", title: "Page" }),
      ],
      "",
    );
    expect(groups.map((g) => g.key)).toEqual(["pages", "actions", "servers"]);
  });

  it("omits groups with no matches", () => {
    const groups = buildGroups([cmd({ id: "p", title: "Logs" })], "logs");
    expect(groups.map((g) => g.key)).toEqual(["pages"]);
  });

  it("caps an unbounded group at five rows but reports the true total", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      cmd({ id: `s${i}`, group: "servers", title: `Server ${i}` }),
    );
    const [servers] = buildGroups(many, "server");
    expect(servers.commands).toHaveLength(5);
    expect(servers.total).toBe(9);
  });

  it("does not cap pages — all 18 must be reachable on an empty query", () => {
    const many = Array.from({ length: 18 }, (_, i) =>
      cmd({ id: `p${i}`, title: `Page ${i}` }),
    );
    const [pages] = buildGroups(many, "");
    expect(pages.commands).toHaveLength(18);
    expect(pages.total).toBe(18);
  });

  it("does not cap actions", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      cmd({ id: `a${i}`, group: "actions", title: `Action ${i}` }),
    );
    const [actions] = buildGroups(many, "");
    expect(actions.commands).toHaveLength(8);
  });

  it("sorts by score, then alphabetically within a score", () => {
    const groups = buildGroups(
      [
        cmd({ id: "1", title: "Starboard" }),   // substring
        cmd({ id: "2", title: "Star Panels" }), // title prefix
        cmd({ id: "3", title: "Star" }),        // exact
      ],
      "star",
    );
    expect(groups[0].commands.map((c) => c.title)).toEqual([
      "Star", "Star Panels", "Starboard",
    ]);
  });

  it("keeps the recent group most-recent-first instead of ranking it", () => {
    const groups = buildGroups(
      [
        cmd({ id: "z", group: "recent", title: "Zebra" }),
        cmd({ id: "a", group: "recent", title: "Aardvark" }),
      ],
      "",
    );
    expect(groups[0].commands.map((c) => c.id)).toEqual(["z", "a"]);
  });

  it("drops non-matching commands entirely", () => {
    const groups = buildGroups(
      [cmd({ id: "1", title: "Logs" }), cmd({ id: "2", title: "Tickets" })],
      "logs",
    );
    expect(groups[0].commands.map((c) => c.title)).toEqual(["Logs"]);
  });

  it("returns everything for an empty query", () => {
    const groups = buildGroups(
      [cmd({ id: "1", title: "Logs" }), cmd({ id: "2", title: "Tickets" })],
      "",
    );
    expect(groups[0].total).toBe(2);
  });

  it("returns no groups when nothing matches", () => {
    expect(buildGroups([cmd({ id: "1", title: "Logs" })], "zzz")).toEqual([]);
  });
});

describe("flatten", () => {
  it("produces one ordered list for cursor navigation", () => {
    const groups = buildGroups(
      [
        cmd({ id: "s", group: "servers", title: "Server" }),
        cmd({ id: "p", group: "pages", title: "Page" }),
      ],
      "",
    );
    expect(flatten(groups).map((c) => c.id)).toEqual(["p", "s"]);
  });

  it("is empty for no groups", () => {
    expect(flatten([])).toEqual([]);
  });
});
