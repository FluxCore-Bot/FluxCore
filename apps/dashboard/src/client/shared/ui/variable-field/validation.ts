import type { UnknownToken } from "./types";
import { extractTokens } from "./tokens";

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export function detectUnknownTokens(value: string, known: Set<string>): UnknownToken[] {
  const knownList = [...known];
  const seen = new Set<string>();
  const result: UnknownToken[] = [];
  for (const token of extractTokens(value)) {
    if (known.has(token) || seen.has(token)) continue;
    seen.add(token);
    let best: string | null = null;
    let bestDist = Infinity;
    for (const candidate of knownList) {
      const dist = levenshtein(token, candidate);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    result.push({ token, suggestion: bestDist <= 3 ? best : null });
  }
  return result;
}
