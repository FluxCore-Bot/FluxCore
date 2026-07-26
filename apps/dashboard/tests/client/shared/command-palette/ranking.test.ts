import { describe, it, expect } from "vitest";
import {
  normalize, score, segment,
  SCORE_EXACT, SCORE_TITLE_PREFIX, SCORE_WORD_PREFIX,
  SCORE_TITLE_SUBSTRING, SCORE_KEYWORD,
} from "../../../../src/client/shared/command-palette/ranking";

describe("normalize", () => {
  it("lowercases", () => {
    expect(normalize("Moderation")).toBe("moderation");
  });

  it("strips diacritics so accented labels are reachable from a plain keyboard", () => {
    expect(normalize("Modération")).toBe("moderation");
    expect(normalize("Añadir")).toBe("anadir");
  });

  it("leaves non-Latin scripts intact", () => {
    expect(normalize("مرحبا")).toBe("مرحبا");
  });
});

describe("score", () => {
  it("ranks an exact title match highest", () => {
    expect(score("logs", { title: "Logs" })).toBe(SCORE_EXACT);
  });

  it("ranks a title prefix above a word prefix", () => {
    expect(score("mod", { title: "Moderation" })).toBe(SCORE_TITLE_PREFIX);
    expect(score("pan", { title: "Role Panels" })).toBe(SCORE_WORD_PREFIX);
    expect(SCORE_TITLE_PREFIX).toBeGreaterThan(SCORE_WORD_PREFIX);
  });

  it("ranks a mid-word substring below a word prefix", () => {
    expect(score("ard", { title: "Starboard" })).toBe(SCORE_TITLE_SUBSTRING);
    expect(SCORE_WORD_PREFIX).toBeGreaterThan(SCORE_TITLE_SUBSTRING);
  });

  it("falls back to keywords when the title does not match", () => {
    expect(score("rules", { title: "Automation", keywords: "rules triggers" }))
      .toBe(SCORE_KEYWORD);
  });

  it("returns null when nothing matches", () => {
    expect(score("zzzz", { title: "Automation", keywords: "rules" })).toBeNull();
  });

  it("matches accented titles from unaccented input", () => {
    expect(score("moderation", { title: "Modération" })).toBe(SCORE_EXACT);
  });

  it("treats an empty query as matching everything", () => {
    expect(score("", { title: "Anything" })).toBe(0);
    expect(score("   ", { title: "Anything" })).toBe(0);
  });
});

describe("segment", () => {
  it("splits the title around the match", () => {
    expect(segment("Moderation", "mod")).toEqual([
      { text: "Mod", match: true },
      { text: "eration", match: false },
    ]);
  });

  it("preserves the original casing of the matched run", () => {
    expect(segment("Role Panels", "PAN")).toEqual([
      { text: "Role ", match: false },
      { text: "Pan", match: true },
      { text: "els", match: false },
    ]);
  });

  it("returns a single unmatched segment when there is no match", () => {
    expect(segment("Logs", "zzz")).toEqual([{ text: "Logs", match: false }]);
  });

  it("returns a single unmatched segment for an empty query", () => {
    expect(segment("Logs", "")).toEqual([{ text: "Logs", match: false }]);
  });
});
