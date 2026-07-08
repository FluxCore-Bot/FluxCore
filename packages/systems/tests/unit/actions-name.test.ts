import { describe, it, expect } from "vitest";
import {
  isValidRuleName,
  RULE_NAME_REGEX,
} from "../../src/actions/constants.js";

describe("isValidRuleName", () => {
  it("accepts plain ASCII letters", () => {
    expect(isValidRuleName("welcome")).toBe(true);
  });
  it("accepts digits, spaces, underscores, hyphens", () => {
    expect(isValidRuleName("rule_1 - test")).toBe(true);
  });
  it("rejects empty string", () => {
    expect(isValidRuleName("")).toBe(false);
  });
  it("rejects > 50 chars", () => {
    expect(isValidRuleName("a".repeat(51))).toBe(false);
  });
  it("rejects @everyone", () => {
    expect(isValidRuleName("@everyone")).toBe(false);
  });
  it("rejects markdown backticks", () => {
    expect(isValidRuleName("`code`")).toBe(false);
  });
  it("rejects mention syntax", () => {
    expect(isValidRuleName("<@123>")).toBe(false);
  });
  it("rejects zero-width characters", () => {
    expect(isValidRuleName("hi\u200Bthere")).toBe(false);
  });
  it("RULE_NAME_REGEX matches the documented pattern", () => {
    expect(RULE_NAME_REGEX.source).toBe("^[a-zA-Z0-9 _-]{1,50}$");
  });
});
