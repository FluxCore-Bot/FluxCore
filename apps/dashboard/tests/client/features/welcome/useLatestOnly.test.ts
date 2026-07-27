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

  it("invalidate() strands every outstanding token without claiming one", () => {
    const { result } = renderHook(() => useLatestOnly());
    const token = result.current.begin();

    result.current.invalidate();

    expect(result.current.isCurrent(token)).toBe(false);
    // The guard still works afterwards: a fresh begin() is current again.
    const next = result.current.begin();
    expect(result.current.isCurrent(next)).toBe(true);
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

// The dashboard's server-side preview path (WelcomeImageEditor's "server" mode)
// has the identical race as the client RAF path, just gated by a 400ms
// debounce instead of RAF timing: the debounce only prevents a second request
// from being *issued* within its window, it does nothing once two requests
// are genuinely in flight (slow network, slow canvas render on the server).
// It uses its own `useLatestOnly()` instance — separate from the client
// path's — so these tests cover both that independence and the same
// commit/discard contract, modeled with URL-revocation semantics matching
// the real onSuccess/onError handlers.
describe("useLatestOnly (server-preview usage pattern)", () => {
  it("does not cross-invalidate a sibling instance — client and server renders must use independent guards", () => {
    const { result: clientGuard } = renderHook(() => useLatestOnly());
    const { result: serverGuard } = renderHook(() => useLatestOnly());

    const clientToken = clientGuard.current.begin();
    const serverToken = serverGuard.current.begin();

    // Beginning a server render must not invalidate the outstanding client
    // token, and vice versa — sharing a single instance between the two
    // effects would make one render silently discard the other's in-flight
    // result.
    expect(clientGuard.current.isCurrent(clientToken)).toBe(true);
    expect(serverGuard.current.isCurrent(serverToken)).toBe(true);
  });

  it("discards a stale mutation response without revoking or overwriting the live url", async () => {
    const { result } = renderHook(() => useLatestOnly());
    const revoked: string[] = [];
    let live: string | null = null;

    // Mirrors WelcomeImageEditor's onSuccess handler for the server preview:
    // supersede -> revoke our own url and stop; otherwise -> revoke whatever
    // was live, then commit ours.
    function commit(url: string, token: number) {
      if (!result.current.isCurrent(token)) {
        revoked.push(url);
        return;
      }
      if (live) revoked.push(live);
      live = url;
    }

    async function serverPreview(url: string, delayMs: number) {
      const token = result.current.begin();
      await sleep(delayMs);
      commit(url, token);
    }

    // "old" is issued first but its response (network + server canvas render)
    // is slower — ordinary usage under variable latency, not a contrived case.
    await Promise.all([
      serverPreview("blob:old", 40),
      serverPreview("blob:new", 5),
    ]);

    expect(live).toBe("blob:new");
    expect(revoked).toContain("blob:old"); // its own stale response, revoked
    expect(revoked).not.toContain("blob:new"); // the live url is never revoked
  });

  it("cross-invalidating on a mode switch drops the other mode's in-flight render", async () => {
    // WelcomeImageEditor keeps one guard per preview mode. The guards are
    // independent, so a server response that resolves AFTER the user switched
    // to client mode still passes its own guard — each mode's effect must
    // therefore invalidate() the OTHER guard when it takes over.
    const { result: clientGuard } = renderHook(() => useLatestOnly());
    const { result: serverGuard } = renderHook(() => useLatestOnly());
    let live: string | null = null;
    const dropped: string[] = [];

    async function render(guard: typeof clientGuard, url: string, delayMs: number) {
      const token = guard.current.begin();
      await sleep(delayMs);
      if (!guard.current.isCurrent(token)) {
        dropped.push(url);
        return;
      }
      live = url;
    }

    // A slow server preview is in flight when the user switches to client
    // mode; the client effect invalidates the server guard, then renders.
    const slowServer = render(serverGuard, "blob:server-stale", 40);
    serverGuard.current.invalidate();
    await render(clientGuard, "blob:client-fresh", 5);
    await slowServer;

    expect(live).toBe("blob:client-fresh");
    expect(dropped).toEqual(["blob:server-stale"]);
  });
});
