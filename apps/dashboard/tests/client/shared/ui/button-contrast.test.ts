import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The primary button paints its label on a *gradient*, so a single
 * foreground/background pair proves nothing: the label has to clear AA against
 * every stop, not just the one someone happened to eyedrop. It previously swept
 * accent -> accent-dim, which passed at 6.08:1 on the light stop and failed at
 * 2.90:1 on the dark one — the top-left of the button was readable and the
 * bottom-right was not, which is exactly the kind of defect a screenshot hides.
 *
 * This reads the real tokens and the real variant string rather than restating
 * them, so reintroducing a too-dark stop (or retargeting the label colour)
 * fails here instead of shipping.
 */

const CLIENT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../../src/client");

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Resolves a Tailwind colour token name (e.g. "accent-dim") to its hex. */
function readTokens(): Map<string, string> {
  const css = readFileSync(join(CLIENT_DIR, "styles.css"), "utf8");
  const tokens = new Map<string, string>();
  for (const [, name, hex] of css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    tokens.set(name!, hex!.toLowerCase());
  }
  return tokens;
}

/** Pulls the `default` variant's class string out of the button's cva config. */
function readDefaultVariantClasses(): string {
  const src = readFileSync(join(CLIENT_DIR, "shared/ui/button.tsx"), "utf8");
  const match = /\n\s*default:\s*\n?\s*"([^"]+)"/.exec(src);
  if (!match) throw new Error("could not locate the button's `default` variant class string");
  return match[1]!;
}

describe("primary button label contrast", () => {
  const tokens = readTokens();
  const classes = readDefaultVariantClasses();

  // `bg-gradient-to-br` declares the gradient's *direction*, and its `to-br`
  // fragment matches a naive /\bto-([\w-]+)/ before the real colour stop does.
  // Left in, the suite reported on a nonexistent `--color-br` and never looked
  // at the stop that was actually failing. Drop the direction utility first.
  const colourClasses = classes.replace(/\bbg-gradient-to-\w+\b/g, "");

  const foreground = /\btext-([\w-]+)\b/.exec(colourClasses)?.[1];
  const stops = [/\bfrom-([\w-]+)\b/, /\bto-([\w-]+)\b/]
    .map((re) => re.exec(colourClasses)?.[1])
    .filter((name): name is string => name !== undefined);

  it("still paints a token-coloured label on a token-coloured gradient", () => {
    // Guards the two extractors above: if the variant is rewritten to use raw
    // hexes, arbitrary values, or a solid fill, the assertions below would
    // silently pass over an empty stop list rather than checking anything.
    expect(foreground).toBeDefined();
    expect(tokens.get(foreground!)).toBeDefined();
    expect(stops).toHaveLength(2);
  });

  it.each(stops)("clears WCAG AA against the %s stop", (stop) => {
    const bg = tokens.get(stop);
    expect(bg, `--color-${stop} is not defined in styles.css`).toBeDefined();
    expect(contrast(tokens.get(foreground!)!, bg!)).toBeGreaterThanOrEqual(4.5);
  });
});
