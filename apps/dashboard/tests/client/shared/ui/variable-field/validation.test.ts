import { describe, it, expect } from "vitest";
import { levenshtein, detectUnknownTokens } from "../../../../../src/client/shared/ui/variable-field/validation";

const known = new Set(["{user}", "{server}", "{membercount}"]);

describe("levenshtein", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });
});

describe("detectUnknownTokens", () => {
  it("returns nothing when all tokens are known", () => {
    expect(detectUnknownTokens("Hi {user} on {server}", known)).toEqual([]);
  });

  it("flags an unknown token and suggests the closest known one", () => {
    expect(detectUnknownTokens("member #{membercont}", known)).toEqual([
      { token: "{membercont}", suggestion: "{membercount}" },
    ]);
  });

  it("gives null suggestion when nothing is close", () => {
    expect(detectUnknownTokens("{zzzzzzzz}", known)).toEqual([
      { token: "{zzzzzzzz}", suggestion: null },
    ]);
  });

  it("de-duplicates repeated unknown tokens", () => {
    expect(detectUnknownTokens("{foo} {foo}", known)).toEqual([
      { token: "{foo}", suggestion: null },
    ]);
  });
});
