// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecentCommands } from "../../../../src/client/shared/command-palette/useRecentCommands";
import type { Command } from "../../../../src/client/shared/command-palette/types";

function cmd(id: string): Command {
  return { id, group: "pages", title: id, icon: "dashboard", to: `/${id}` };
}

const all = [cmd("a"), cmd("b"), cmd("c"), cmd("d"), cmd("e"), cmd("f")];

describe("useRecentCommands", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty", () => {
    const { result } = renderHook(() => useRecentCommands(all, "u1"));
    expect(result.current.recent).toEqual([]);
  });

  it("remembers a selection, most recent first", () => {
    const { result } = renderHook(() => useRecentCommands(all, "u1"));
    act(() => result.current.remember(cmd("a")));
    act(() => result.current.remember(cmd("b")));
    expect(result.current.recent.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("re-selecting moves an entry to the front without duplicating it", () => {
    const { result } = renderHook(() => useRecentCommands(all, "u1"));
    act(() => result.current.remember(cmd("a")));
    act(() => result.current.remember(cmd("b")));
    act(() => result.current.remember(cmd("a")));
    expect(result.current.recent.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("keeps at most five", () => {
    const { result } = renderHook(() => useRecentCommands(all, "u1"));
    for (const c of all) act(() => result.current.remember(c));
    expect(result.current.recent).toHaveLength(5);
    expect(result.current.recent.map((c) => c.id)).toEqual(["f", "e", "d", "c", "b"]);
  });

  it("re-labels entries into the 'recent' group so they render separately", () => {
    const { result } = renderHook(() => useRecentCommands(all, "u1"));
    act(() => result.current.remember(cmd("a")));
    expect(result.current.recent[0].group).toBe("recent");
  });

  it("survives a remount via localStorage", () => {
    const first = renderHook(() => useRecentCommands(all, "u1"));
    act(() => first.result.current.remember(cmd("a")));
    first.unmount();

    const second = renderHook(() => useRecentCommands(all, "u1"));
    expect(second.result.current.recent.map((c) => c.id)).toEqual(["a"]);
  });

  it("keeps each user's recents separate on a shared browser", () => {
    const first = renderHook(() => useRecentCommands(all, "u1"));
    act(() => first.result.current.remember(cmd("a")));
    first.unmount();

    const second = renderHook(() => useRecentCommands(all, "u2"));
    expect(second.result.current.recent).toEqual([]);
  });

  it("drops ids that no longer exist, so a removed page cannot linger", () => {
    localStorage.setItem("fluxcore.palette.recent.u1", JSON.stringify(["gone", "a"]));
    const { result } = renderHook(() => useRecentCommands(all, "u1"));
    expect(result.current.recent.map((c) => c.id)).toEqual(["a"]);
  });

  it("ignores corrupt storage rather than throwing", () => {
    localStorage.setItem("fluxcore.palette.recent.u1", "{not json");
    const { result } = renderHook(() => useRecentCommands(all, "u1"));
    expect(result.current.recent).toEqual([]);
  });

  it("ignores stored values that are not an array of strings", () => {
    localStorage.setItem("fluxcore.palette.recent.u1", JSON.stringify({ a: 1 }));
    const { result } = renderHook(() => useRecentCommands(all, "u1"));
    expect(result.current.recent).toEqual([]);
  });

  /**
   * Selecting the re-grouped copy must record the underlying command, not a
   * "recent"-grouped one. Storing the copy would be harmless today because the
   * copy keeps its original `id`, but it would silently break the moment the
   * copy's id is namespaced by group.
   */
  it("remembers a 'recent' copy under the same id as the original", () => {
    const { result } = renderHook(() => useRecentCommands(all, "u1"));
    act(() => result.current.remember(cmd("a")));
    act(() => result.current.remember(result.current.recent[0]));
    expect(result.current.recent.map((c) => c.id)).toEqual(["a"]);
  });
});
