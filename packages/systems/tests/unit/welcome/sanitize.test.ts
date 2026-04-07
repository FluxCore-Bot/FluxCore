import { describe, it, expect } from "vitest";
import { sanitizeDisplayName } from "../../../src/welcome/image/sanitize.js";

describe("sanitizeDisplayName", () => {
  it("returns plain ASCII unchanged", () => {
    expect(sanitizeDisplayName("Alice", 32)).toBe("Alice");
  });

  it("strips zero-width spaces and joiners", () => {
    expect(sanitizeDisplayName("a\u200Bb\u200Cc\u200Dd\uFEFFe", 32)).toBe("abcde");
  });

  it("strips RTL/LTR override characters (U+202A..U+202E)", () => {
    expect(sanitizeDisplayName("\u202Eevil\u202D", 32)).toBe("evil");
  });

  it("strips bidi isolate characters (U+2066..U+2069)", () => {
    expect(sanitizeDisplayName("\u2066hidden\u2069", 32)).toBe("hidden");
  });

  it("strips C0/C1 control characters but keeps spaces", () => {
    expect(sanitizeDisplayName("a\u0007 b\u0000c", 32)).toBe("a bc");
  });

  it("truncates to maxLen", () => {
    expect(sanitizeDisplayName("x".repeat(500), 32)).toHaveLength(32);
  });

  it("normalizes to NFC", () => {
    // "é" as NFD (U+0065 U+0301) → NFC ("\u00E9")
    const decomposed = "e\u0301";
    const out = sanitizeDisplayName(decomposed, 32);
    expect(out).toBe("\u00E9");
  });

  it("returns 'Unknown' for empty/whitespace-only input", () => {
    expect(sanitizeDisplayName("", 32)).toBe("Unknown");
    expect(sanitizeDisplayName("   ", 32)).toBe("Unknown");
    expect(sanitizeDisplayName("\u200B\u200C", 32)).toBe("Unknown");
  });

  it("collapses runs of whitespace", () => {
    expect(sanitizeDisplayName("a    b\t\tc", 32)).toBe("a b c");
  });
});
