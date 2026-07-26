// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLatestOnly } from "../../../../src/client/features/welcome/image/useLatestOnly";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("useLatestOnly", () => {
  it("treats the only outstanding token as current", () => {
    const { result } = renderHook(() => useLatestOnly());
    const token = result.current.begin();
    expect(result.current.isCurrent(token)).toBe(true);
  });

  it("invalidates an older token once a newer one begins", () => {
    const { result } = renderHook(() => useLatestOnly());
    const older = result.current.begin();
    const newer = result.current.begin();

    expect(result.current.isCurrent(older)).toBe(false);
    expect(result.current.isCurrent(newer)).toBe(true);
  });

  it("keeps a stable identity across re-renders so effects do not re-fire", () => {
    const { result, rerender } = renderHook(() => useLatestOnly());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("lets a slow older async render detect that it was superseded", async () => {
    const { result } = renderHook(() => useLatestOnly());
    const committed: string[] = [];
    const discarded: string[] = [];

    async function render(label: string, delayMs: number) {
      const token = result.current.begin();
      await sleep(delayMs);
      if (!result.current.isCurrent(token)) {
        discarded.push(label);
        return;
      }
      committed.push(label);
    }

    // "old" starts first but finishes last — the classic out-of-order case.
    await Promise.all([render("old", 40), render("new", 5)]);

    expect(committed).toEqual(["new"]);
    expect(discarded).toEqual(["old"]);
  });
});
