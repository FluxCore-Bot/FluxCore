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

/**
 * Same idea, but costed by raw UTF-16 code unit instead of code point. Under
 * `measurer` above, a lone surrogate and its complete pair cost the same (the
 * spread iterator counts either as "one item"), so a code-unit-slicing bug can
 * never be caught landing mid-pair — the width math coincidentally always
 * lands back on a clean boundary. Costing by `.length` makes a lone surrogate
 * strictly cheaper than its pair, which is what actually exposes the bug.
 */
const unitMeasurer = { measureText: (t: string) => ({ width: t.length * 10 }) };

/** Every grapheme-boundary prefix of `text` — the only cut points `fitText` may land on. */
function graphemeBoundaryPrefixes(text: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const prefixes = [""];
  let acc = "";
  for (const { segment } of segmenter.segment(text)) {
    acc += segment;
    prefixes.push(acc);
  }
  return prefixes;
}

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

  // Greek/Cyrillic/Armenian sit directly below the RTL block (U+0370-U+058F vs.
  // RTL's U+0590 start). An RTL range that crept even slightly too wide would
  // swallow these scripts and misreport them as rtl without any test noticing.
  it("treats Greek as ltr", () => {
    expect(baseDirection("Ελληνικά")).toBe("ltr");
  });

  it("treats Cyrillic as ltr", () => {
    expect(baseDirection("Привет")).toBe("ltr");
  });

  it("treats Armenian as ltr", () => {
    expect(baseDirection("Բարև")).toBe("ltr");
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
    // Each emoji is one grapheme but two UTF-16 code units. Under `unitMeasurer`
    // a lone surrogate costs one unit — less than its complete pair — so a
    // code-unit-slicing bug lands mid-pair here and is actually observable;
    // at this width the correct, grapheme-safe answer is exactly one emoji.
    const text = "🎉🎉🎉🎉🎉🎉";
    const out = fitText(unitMeasurer, text, 45);
    expect(out).toBe("🎉…");
    expect([...out].every((ch) => ch.codePointAt(0) !== 0xfffd)).toBe(true);
    // Truncation must land on a grapheme boundary, so no lone surrogates.
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(out)).toBe(false);
    expect(graphemeBoundaryPrefixes(text)).toContain(out.slice(0, -1));
  });

  it("never splits a ZWJ emoji sequence", () => {
    const family = "👨‍👩‍👧‍👦";
    const text = family + family;
    // At width 40 the whole first family (7 codepoints under `measurer`) never
    // fits, so both a correct and a broken implementation trivially collapse
    // to a bare "…" — the assertions below would pass either way. Width 100
    // lets exactly one family through, which is where a code-unit-slicing bug
    // actually dangles a bare ZWJ (or a partial second family) before the
    // ellipsis instead of stopping at the first family's boundary.
    const out = fitText(measurer, text, 100);
    expect(out).toBe(family + "…");
    expect(out.includes("‍…")).toBe(false);
    expect(graphemeBoundaryPrefixes(text)).toContain(out.slice(0, -1));
  });

  it("never splits an Arabic combining mark from its base", () => {
    // Arabic letter + fatha/sukun (e.g. U+064E) is one grapheme. At width 63
    // the third grapheme's base consonant ("ح") fits alone but its mark does
    // not — a code-unit-slicing bug keeps the bare base ("مَرْح…"), while a
    // grapheme-safe cut must stop before it ("مَرْ…"). (At width 50 the two
    // implementations are byte-identical and this test cannot tell them apart.)
    const text = "مَرْحَبَا مَرْحَبَا";
    const out = fitText(measurer, text, 63);
    expect(out).toBe("مَرْ…");
    expect(graphemeBoundaryPrefixes(text)).toContain(out.slice(0, -1));
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

  // {user.name} is one of the five supported placeholders (per the username,
  // not the display name) and was never exercised above — a typo in its
  // literal would go undetected. Included alongside {user} and
  // {user.displayname} in one string so a regression in match specificity
  // between them would also surface here.
  it("substitutes {user.name} distinctly from {user} and {user.displayname}", () => {
    expect(
      replaceImageVariables(
        "{user.name} {user} {user.displayname} {server} {membercount}",
        member,
        guild,
      ),
    ).toBe("ahmed ahmed Ahmed FluxCore 1,234");
  });
});
