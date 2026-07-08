import { describe, it, expect } from "vitest";
import { insertToken, getActiveQuery } from "../../../../../src/client/shared/ui/variable-field/caret";

describe("insertToken", () => {
  it("inserts at a collapsed caret", () => {
    expect(insertToken("Hi ", 3, 3, "{user}")).toEqual({ value: "Hi {user}", cursor: 9 });
  });
  it("replaces a selection", () => {
    expect(insertToken("Hi XXX!", 3, 6, "{user}")).toEqual({ value: "Hi {user}!", cursor: 9 });
  });
  it("replaces an open query when start passed as selStart", () => {
    // caller replaces "{us" (indices 3..6) with the full token
    expect(insertToken("Hi {us", 3, 6, "{user}")).toEqual({ value: "Hi {user}", cursor: 9 });
  });
});

describe("getActiveQuery", () => {
  it("detects an open query at the caret", () => {
    expect(getActiveQuery("Hi {us", 6)).toEqual({ query: "us", start: 3 });
  });
  it("detects an empty query right after {", () => {
    expect(getActiveQuery("Hi {", 4)).toEqual({ query: "", start: 3 });
  });
  it("returns null when the brace is already closed before the caret", () => {
    expect(getActiveQuery("Hi {user} x", 11)).toBeNull();
  });
  it("returns null when there is no open brace", () => {
    expect(getActiveQuery("plain text", 5)).toBeNull();
  });
  it("returns null when a space breaks the run", () => {
    expect(getActiveQuery("{us er", 6)).toBeNull();
  });
});
