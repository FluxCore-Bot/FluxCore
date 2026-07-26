import { useMemo, useRef } from "react";

export interface LatestOnly {
  /** Claim a token for a newly started async operation. Invalidates all earlier tokens. */
  begin(): number;
  /** Whether `token` is still the most recently claimed one. */
  isCurrent(token: number): boolean;
}

/**
 * Guard against out-of-order async completions.
 *
 * `cancelAnimationFrame` cannot stop a callback that has already awaited, so a
 * slow older render can otherwise finish after a newer one and overwrite it.
 * Each render claims a token and only commits if it is still current.
 */
export function useLatestOnly(): LatestOnly {
  const generation = useRef(0);

  return useMemo(
    () => ({
      begin: () => ++generation.current,
      isCurrent: (token: number) => token === generation.current,
    }),
    [],
  );
}
