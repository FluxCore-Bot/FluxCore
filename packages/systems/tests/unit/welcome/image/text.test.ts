import { describe, it, expect } from "vitest";
import {
  buildFontSpec,
  baseDirection,
  fitText,
  hexToRgba,
  replaceImageVariables,
} from "../../../../src/welcome/image/core/text.js";

/** Deterministic stand-in for a canvas: every char is 10px wide. */
const measurer = { measureText: (t: string) => ({ width: [...t].length * 10 }) };

describe("buildFontSpec", () => {
  it("emits weight, Latin family, Arabic pair, then emoji", () => {
    expect(buildFontSpec("Orbitron", 40)).toBe(
      '700 40px "Orbitron", "NotoKufiArabic", "NotoColorEmoji"',
    );
  });

  it("pairs the serif font with Amiri", () => {
    expect(buildFontSpec("PlayfairDisplay", 36)).toContain('"Amiri"');
  });

  it("falls back to Inter for an unknown font", () => {
    expect(buildFontSpec("Nonsense", 20)).toBe(
      '600 20px "Inter", "NotoSansArabic", "NotoColorEmoji"',
    );
  });
});

describe("baseDirection", () => {
  it("returns rtl when the first strong char is Arabic", () => {
    expect(baseDirection("مرحبا Ahmed")).toBe("rtl");
  });

  it("returns ltr when the first strong char is Latin", () => {
    expect(baseDirection("Ahmed مرحبا")).toBe("ltr");
  });

  it("skips digits and punctuation to find the first strong char", () => {
    expect(baseDirection("123 -- مرحبا")).toBe("rtl");
  });

  it("defaults to ltr for empty or neutral-only text", () => {
    expect(baseDirection("")).toBe("ltr");
    expect(baseDirection("123 456")).toBe("ltr");
  });

  it("treats Hebrew as rtl", () => {
    expect(baseDirection("שלום")).toBe("rtl");
  });
});

describe("fitText", () => {
  it("returns the text unchanged when it fits", () => {
    expect(fitText(measurer, "Ahmed", 100)).toBe("Ahmed");
  });

  it("appends a single ellipsis character, never three periods", () => {
    const out = fitText(measurer, "AhmedAlRashid", 60);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("...");
  });

  it("never splits a surrogate pair", () => {
    // Each emoji is one grapheme but two UTF-16 code units.
    const out = fitText(measurer, "🎉🎉🎉🎉🎉🎉", 40);
    expect([...out].every((ch) => ch.codePointAt(0) !== 0xfffd)).toBe(true);
    // Truncation must land on a grapheme boundary, so no lone surrogates.
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(out)).toBe(false);
  });

  it("never splits a ZWJ emoji sequence", () => {
    const family = "👨‍👩‍👧‍👦";
    const out = fitText(measurer, family + family, 40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.includes("‍…")).toBe(false);
  });

  it("never splits an Arabic combining mark from its base", () => {
    // Arabic letter + fatha (U+064E) is one grapheme.
    const out = fitText(measurer, "مَرْحَبَا مَرْحَبَا", 50);
    expect(out.startsWith("َ")).toBe(false);
    expect(/^[ً-ْ]/.test(out)).toBe(false);
  });

  it("returns just an ellipsis when nothing fits", () => {
    expect(fitText(measurer, "Ahmed", 5)).toBe("…");
  });
});

describe("hexToRgba", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgba("#a3a6ff", 0.5)).toBe("rgba(163, 166, 255, 0.5)");
  });

  it("expands 3-digit shorthand instead of producing NaN", () => {
    expect(hexToRgba("#abc", 1)).toBe("rgba(170, 187, 204, 1)");
  });

  it("falls back to transparent black for an unparseable color", () => {
    expect(hexToRgba("rebeccapurple", 0.4)).toBe("rgba(0, 0, 0, 0.4)");
  });
});

describe("replaceImageVariables", () => {
  const member = { username: "ahmed", displayName: "Ahmed", avatarUrl: "" };
  const guild = { name: "FluxCore", memberCount: 1234 };

  it("substitutes every supported variable", () => {
    expect(
      replaceImageVariables("{user} {user.displayname} {server} {membercount}", member, guild),
    ).toBe("ahmed Ahmed FluxCore 1,234");
  });
});
