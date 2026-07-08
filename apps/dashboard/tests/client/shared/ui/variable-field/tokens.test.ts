import { describe, it, expect } from "vitest";
import { tokenize, extractTokens } from "../../../../../src/client/shared/ui/variable-field/tokens";

const known = new Set(["{user}", "{server}"]);

describe("tokenize", () => {
  it("splits text and variable segments", () => {
    const segs = tokenize("Hi {user}!", known);
    expect(segs).toEqual([
      { type: "text", value: "Hi ", known: false },
      { type: "var", value: "{user}", known: true },
      { type: "text", value: "!", known: false },
    ]);
  });

  it("marks unknown variables as not known", () => {
    const segs = tokenize("{nope}", known);
    expect(segs).toEqual([{ type: "var", value: "{nope}", known: false }]);
  });

  it("returns a single text segment when there are no tokens", () => {
    expect(tokenize("plain", known)).toEqual([{ type: "text", value: "plain", known: false }]);
  });
});

describe("extractTokens", () => {
  it("returns every token occurrence", () => {
    expect(extractTokens("{user} and {user} and {server}")).toEqual(["{user}", "{user}", "{server}"]);
  });
  it("returns [] when none", () => {
    expect(extractTokens("none here")).toEqual([]);
  });
});
