import { describe, it, expect, beforeAll } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { registerFonts } from "../../../../src/welcome/image/fonts/index.js";
import { buildFontSpec } from "../../../../src/welcome/image/core/text.js";
import { generateWelcomeImage } from "../../../../src/welcome/image/renderer.js";
import { DEFAULT_WELCOME_IMAGE_SETTINGS } from "../../../../src/welcome/image/constants.js";

const ARABIC = "مرحبا بك في السيرفر";

beforeAll(() => registerFonts());

describe("Arabic glyph coverage", () => {
  it("renders Arabic with real glyphs, not notdef boxes", () => {
    const canvas = createCanvas(600, 100);
    const ctx = canvas.getContext("2d");

    // Full chain (Latin + Arabic + emoji).
    ctx.font = buildFontSpec("Inter", 36);
    const withArabic = ctx.measureText(ARABIC).width;

    // Latin only — every Arabic codepoint falls back to notdef.
    ctx.font = '600 36px "Inter"';
    const withoutArabic = ctx.measureText(ARABIC).width;

    // Identical widths would mean the Arabic font is not being consulted,
    // i.e. the fonts stopped shipping and we are back to tofu.
    expect(withArabic).not.toBeCloseTo(withoutArabic, 1);
  });

  it("renders emoji through the fallback chain", () => {
    const canvas = createCanvas(600, 100);
    const ctx = canvas.getContext("2d");

    ctx.font = buildFontSpec("Inter", 36);
    const withEmoji = ctx.measureText("🎉").width;

    ctx.font = '600 36px "Inter"';
    const withoutEmoji = ctx.measureText("🎉").width;

    expect(withEmoji).not.toBeCloseTo(withoutEmoji, 1);
  });
});

describe("generateWelcomeImage", () => {
  // A 1x1 transparent PNG. Unit tests must never hit the network; the avatar
  // is irrelevant to these assertions and a real URL would add a timeout.
  const AVATAR =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  const input = {
    settings: DEFAULT_WELCOME_IMAGE_SETTINGS,
    member: { username: "ahmed", displayName: ARABIC, avatarUrl: AVATAR },
    guild: { name: "سيرفر", memberCount: 1234 },
  };

  it("produces a PNG buffer for Arabic input", async () => {
    const buffer = await generateWelcomeImage(input);
    expect(buffer.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("produces a different image for Arabic than for Latin", async () => {
    const arabic = await generateWelcomeImage(input);
    const latin = await generateWelcomeImage({
      ...input,
      member: { ...input.member, displayName: "Ahmed" },
    });
    expect(arabic.equals(latin)).toBe(false);
  });
});
