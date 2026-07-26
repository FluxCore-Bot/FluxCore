# Welcome Image Arabic Rendering & Client/Server Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Arabic and emoji render correctly in welcome/farewell images, eliminate every source of drift between the browser preview and the bot's output, and send the image as a plain attachment instead of boxed in an embed.

**Architecture:** One drawing implementation lives in `@fluxcore/systems` behind a structural `Ctx2D` interface that both `@napi-rs/canvas` and the browser's `CanvasRenderingContext2D` satisfy. The dashboard serves the exact same TTF bytes the bot registers, so both sides resolve identical glyphs, metrics, and truncation. The client's duplicated template file is deleted.

**Tech Stack:** TypeScript (strict), `@napi-rs/canvas` 0.1.97 (Skia), browser Canvas2D + `FontFace` API, Fastify 5 + `@fastify/static`, Prisma 7 + PostgreSQL 18, React 19, Vitest, Turborepo, pnpm monorepo, Docker.

## Global Constraints

- **All pnpm/test/build commands MUST run inside Docker.** Host `node_modules` are root-owned.
- **Never read or write `.env` files.** Use `.env.example` for reference.
- **Strict TypeScript — no `any`.** The existing `settings as never` cast at `WelcomeImageEditor.tsx:121` must be removed, not preserved.
- **Static font instances only — never variable fonts.** Verified: `@napi-rs/canvas@0.1.97` ignores the `wght` axis (identical measured widths at 400 and 700), while browsers honour it. Shipping a variable font silently reintroduces client/server divergence.
- **Canonical font family strings are identical on client and server.** `family === name` for every font, no spaces (`SpaceGrotesk`, not `Space Grotesk`).
- **`core/` must never import `@napi-rs/canvas` or any Node builtin.** It is bundled into the browser by Vite. Importing the systems `welcome/image` barrel from client code pulls in the native renderer and breaks the build — always import granular subpaths.
- **New i18n keys must be translated in all 48 locales up front.** English placeholders block merge. Edit `apps/dashboard/src/locales/<lang>/welcome.json` (source), not `dist/`.
- **Every feature needs tests.** No task is complete without them.

**Test command template** (substitute the package and file):

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/systems test -- tests/unit/welcome/image/text.test.ts
```

**Rebuild systems before running dashboard or bot tests directly.** `turbo run test` declares `dependsOn: ["^build"]`, but the single-file command above calls the package script and skips that. Dashboard and bot tests import `@fluxcore/systems/...`, which resolves to `packages/systems/dist/` — stale `dist` means you are testing the old code:

```bash
docker compose --profile bot run --rm --no-deps bot \
  pnpm turbo run build --filter=@fluxcore/systems
```

**If a rebuild appears to do nothing, delete the tsbuildinfo too.** `composite: true` makes `tsc` trust a stale `*.tsbuildinfo` and emit no files, so `rm -rf dist` alone leaves the build broken. `pnpm clean` has the same trap:

```bash
docker compose --profile bot run --rm --no-deps bot \
  sh -c 'rm -rf packages/systems/dist packages/systems/*.tsbuildinfo'
```

**Typecheck:** `pnpm typecheck` — run before every commit.

**ESM tests have no `__dirname`.** Use `import.meta.dirname` in test files that touch the filesystem.

---

## File Structure

**Create:**

| Path | Responsibility |
|---|---|
| `packages/systems/src/welcome/image/fonts/manifest.ts` | Single source of truth: Latin fonts, Arabic pairings, emoji font. No Node imports. |
| `packages/systems/src/welcome/image/core/types.ts` | `Ctx2D`, `GradientLike`, `RenderBackend`. Pure types. |
| `packages/systems/src/welcome/image/core/text.ts` | `buildFontSpec`, `baseDirection`, `fitText`, `hexToRgba`, `replaceImageVariables`. |
| `packages/systems/src/welcome/image/core/draw.ts` | `drawCard` — all drawing, backend-agnostic. |
| `packages/systems/src/welcome/image/fonts/files/*.ttf` | 4 Arabic + 1 emoji font (vendored). |
| `packages/systems/src/welcome/image/fonts/files/LICENSES.md` | OFL attribution. |
| `apps/dashboard/src/client/features/welcome/image/fonts.ts` | `FontFace` loader against `/fonts/welcome/`. |
| `apps/dashboard/src/client/features/welcome/image/useLatestOnly.ts` | Out-of-order async guard for the preview render. |
| `packages/systems/src/welcome/send.ts` | Decides what messages to post — shared by join and leave events. |

**Modify:**

| Path | Change |
|---|---|
| `packages/systems/src/welcome/image/fonts/index.ts` | Drive registration from manifest; export `getFontsDir`. |
| `packages/systems/src/welcome/image/constants.ts` | Derive `AVAILABLE_FONTS` from manifest. |
| `packages/systems/src/welcome/image/renderer.ts` | Thin: create canvas → `drawCard` → PNG buffer. |
| `packages/systems/src/welcome/image/index.ts` | Export new modules. |
| `packages/systems/package.json` | Add granular `exports` entries. |
| `packages/systems/src/welcome/types.ts` | Add `messageStyle` / `content` fields. |
| `packages/systems/src/welcome/config.ts` | Plumb new fields through `rowToConfig` + `upsertWelcomeConfig`. |
| `packages/systems/src/welcome/builder.ts` | Export `replaceWelcomeVariables`. |
| `packages/database/prisma/schema.prisma` | 4 new columns. |
| `apps/dashboard/src/server/index.ts` | Serve `/fonts/welcome/`. |
| `apps/dashboard/src/server/features/welcome/routes.ts` | Accept + validate new fields. |
| `apps/dashboard/src/client/features/welcome/image/renderer.ts` | Rewrite as thin wrapper. |
| `apps/dashboard/src/client/features/welcome/components/WelcomeImageEditor.tsx` | RAF generation guard; remove `as never`. |
| `apps/bot/src/events/guildMemberAdd.ts` | Plain send mode. |
| `apps/bot/src/events/guildMemberRemove.ts` | Plain send mode. |

**Delete:** `apps/dashboard/src/client/features/welcome/image/templates.ts`

---

## Task 1: Font Manifest and Vendored Fonts

**Files:**

- Create: `packages/systems/src/welcome/image/fonts/manifest.ts`
- Create: `packages/systems/src/welcome/image/fonts/files/{NotoSansArabic-Bold,Tajawal-Bold,Amiri-Bold,NotoKufiArabic-Bold,Noto-COLRv1}.ttf`
- Create: `packages/systems/src/welcome/image/fonts/files/LICENSES.md`
- Modify: `packages/systems/src/welcome/image/fonts/index.ts`
- Modify: `packages/systems/src/welcome/image/constants.ts:50-107`
- Test: `packages/systems/tests/unit/welcome/image/fonts.test.ts`

**Interfaces:**

- Consumes: nothing (first task).
- Produces: `LATIN_FONTS: LatinFont[]`, `ARABIC_FONTS: Record<ArabicFontKey, ArabicFont>`, `EMOJI_FONT`, `getLatinFont(name: string): LatinFont`, `getFontsDir(): string`, `registerFonts(): void`.

- [ ] **Step 1: Download the five font files**

Run from the repo root. All are OFL-licensed. The two Noto Arabic faces come from *release archives* — the repo tree contains no binaries, and `google/fonts` publishes only variable builds which Skia cannot weight-select.

```bash
FONTS=packages/systems/src/welcome/image/fonts/files
curl -sSL -o "$FONTS/Tajawal-Bold.ttf" \
  "https://github.com/google/fonts/raw/main/ofl/tajawal/Tajawal-Bold.ttf"
curl -sSL -o "$FONTS/Amiri-Bold.ttf" \
  "https://github.com/google/fonts/raw/main/ofl/amiri/Amiri-Bold.ttf"
curl -sSL -o "$FONTS/Noto-COLRv1.ttf" \
  "https://github.com/googlefonts/noto-emoji/raw/main/fonts/Noto-COLRv1.ttf"

TMP=$(mktemp -d)
curl -sSL -o "$TMP/nsa.zip" \
  "https://github.com/notofonts/arabic/releases/download/NotoSansArabic-v2.013/NotoSansArabic-v2.013.zip"
curl -sSL -o "$TMP/nka.zip" \
  "https://github.com/notofonts/arabic/releases/download/NotoKufiArabic-v2.110/NotoKufiArabic-v2.110.zip"
unzip -o -j "$TMP/nsa.zip" "NotoSansArabic/hinted/ttf/NotoSansArabic-Bold.ttf" -d "$FONTS"
unzip -o -j "$TMP/nka.zip" "NotoKufiArabic/hinted/ttf/NotoKufiArabic-Bold.ttf" -d "$FONTS"
rm -rf "$TMP"

ls -la "$FONTS"
```

Expected sizes: `Tajawal-Bold.ttf` ~59 KB, `Amiri-Bold.ttf` ~404 KB, `NotoSansArabic-Bold.ttf` ~255 KB, `NotoKufiArabic-Bold.ttf` ~244 KB, `Noto-COLRv1.ttf` ~4.8 MB.

- [ ] **Step 2: Write `LICENSES.md`**

```markdown
# Bundled Font Licences

All fonts in this directory are licensed under the SIL Open Font License 1.1
(<https://scripts.sil.org/OFL>).

| Font | Source |
|---|---|
| Inter, Space Grotesk, JetBrains Mono, Poppins, Playfair Display, Outfit, Orbitron, Bebas Neue | Google Fonts |
| Noto Sans Arabic, Noto Kufi Arabic | notofonts/arabic release archives |
| Tajawal, Amiri | Google Fonts |
| Noto Color Emoji (COLRv1) | googlefonts/noto-emoji |

Static instances are vendored deliberately: @napi-rs/canvas ignores the variable
`wght` axis while browsers honour it, which would desynchronise the dashboard
preview from the bot's output.
```

- [ ] **Step 3: Write the failing test**

Create `packages/systems/tests/unit/welcome/image/fonts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  LATIN_FONTS,
  ARABIC_FONTS,
  EMOJI_FONT,
  getLatinFont,
} from "../../../../src/welcome/image/fonts/manifest.js";
import { getFontsDir, registerFonts } from "../../../../src/welcome/image/fonts/index.js";

describe("font manifest", () => {
  it("ships every declared Latin font file", () => {
    const dir = getFontsDir();
    for (const font of LATIN_FONTS) {
      expect(existsSync(join(dir, font.file)), `missing ${font.file}`).toBe(true);
    }
  });

  it("ships every declared Arabic and emoji font file", () => {
    const dir = getFontsDir();
    for (const font of Object.values(ARABIC_FONTS)) {
      expect(existsSync(join(dir, font.file)), `missing ${font.file}`).toBe(true);
    }
    expect(existsSync(join(dir, EMOJI_FONT.file))).toBe(true);
  });

  it("gives every Latin font a resolvable Arabic companion", () => {
    for (const font of LATIN_FONTS) {
      expect(ARABIC_FONTS[font.arabic], `${font.name} -> ${font.arabic}`).toBeDefined();
    }
  });

  it("uses space-free family names identical to the font id", () => {
    for (const font of LATIN_FONTS) {
      expect(font.family).toBe(font.name);
      expect(font.family).not.toMatch(/\s/);
    }
  });

  it("falls back to Inter for an unknown font name", () => {
    expect(getLatinFont("NopeNotAFont").name).toBe("Inter");
  });

  it("registers every family with the canvas engine", async () => {
    const { GlobalFonts } = await import("@napi-rs/canvas");
    registerFonts();
    const families = new Set(GlobalFonts.families.map((f) => f.family));
    for (const font of LATIN_FONTS) expect(families.has(font.family)).toBe(true);
    for (const font of Object.values(ARABIC_FONTS)) expect(families.has(font.family)).toBe(true);
    expect(families.has(EMOJI_FONT.family)).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/systems test -- tests/unit/welcome/image/fonts.test.ts
```

Expected: FAIL — `Cannot find module '.../fonts/manifest.js'`.

- [ ] **Step 5: Write `fonts/manifest.ts`**

No Node imports — this file is bundled into the browser.

```typescript
export type FontCategory = "sans-serif" | "serif" | "display" | "monospace" | "rounded";

export type ArabicFontKey = "NotoSansArabic" | "Tajawal" | "Amiri" | "NotoKufiArabic";

export interface ArabicFont {
  family: string;
  file: string;
  weight: number;
}

export interface LatinFont {
  /** Stable id persisted in guild config JSON. */
  name: string;
  /** Label shown in the dashboard font picker. */
  displayName: string;
  category: FontCategory;
  /** Canvas family string — identical on client and server. */
  family: string;
  file: string;
  weight: number;
  arabic: ArabicFontKey;
}

export const ARABIC_FONTS: Record<ArabicFontKey, ArabicFont> = {
  NotoSansArabic: { family: "NotoSansArabic", file: "NotoSansArabic-Bold.ttf", weight: 700 },
  Tajawal: { family: "Tajawal", file: "Tajawal-Bold.ttf", weight: 700 },
  Amiri: { family: "Amiri", file: "Amiri-Bold.ttf", weight: 700 },
  NotoKufiArabic: { family: "NotoKufiArabic", file: "NotoKufiArabic-Bold.ttf", weight: 700 },
};

export const EMOJI_FONT: ArabicFont = {
  family: "NotoColorEmoji",
  file: "Noto-COLRv1.ttf",
  weight: 400,
};

export const LATIN_FONTS: LatinFont[] = [
  { name: "Inter", displayName: "Inter", category: "sans-serif", family: "Inter", file: "Inter-SemiBold.ttf", weight: 600, arabic: "NotoSansArabic" },
  { name: "SpaceGrotesk", displayName: "Space Grotesk", category: "sans-serif", family: "SpaceGrotesk", file: "SpaceGrotesk-Bold.ttf", weight: 700, arabic: "NotoSansArabic" },
  { name: "JetBrainsMono", displayName: "JetBrains Mono", category: "monospace", family: "JetBrainsMono", file: "JetBrainsMono-Bold.ttf", weight: 700, arabic: "NotoSansArabic" },
  { name: "Poppins", displayName: "Poppins", category: "rounded", family: "Poppins", file: "Poppins-SemiBold.ttf", weight: 600, arabic: "Tajawal" },
  { name: "PlayfairDisplay", displayName: "Playfair Display", category: "serif", family: "PlayfairDisplay", file: "PlayfairDisplay-Bold.ttf", weight: 700, arabic: "Amiri" },
  { name: "Outfit", displayName: "Outfit", category: "sans-serif", family: "Outfit", file: "Outfit-SemiBold.ttf", weight: 600, arabic: "NotoSansArabic" },
  { name: "Orbitron", displayName: "Orbitron", category: "display", family: "Orbitron", file: "Orbitron-Bold.ttf", weight: 700, arabic: "NotoKufiArabic" },
  { name: "BebasNeue", displayName: "Bebas Neue", category: "display", family: "BebasNeue", file: "BebasNeue-Regular.ttf", weight: 400, arabic: "NotoKufiArabic" },
];

const BY_NAME = new Map(LATIN_FONTS.map((f) => [f.name, f]));

/** Resolve a stored font id. Falls back to Inter for unknown names. */
export function getLatinFont(name: string): LatinFont {
  return BY_NAME.get(name) ?? LATIN_FONTS[0]!;
}
```

- [ ] **Step 6: Rewrite `fonts/index.ts` to use the manifest**

```typescript
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GlobalFonts } from "@napi-rs/canvas";
import { LATIN_FONTS, ARABIC_FONTS, EMOJI_FONT } from "./manifest.js";
import { AVAILABLE_FONTS } from "../constants.js";
import type { FontDefinition } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let fontsRegistered = false;

/**
 * Resolve the fonts/files directory.
 * In dev (tsx): src/welcome/image/fonts/ → files/ is a sibling
 * In dist:     dist/welcome/image/fonts/ → files/ is a sibling (copied by build script)
 *
 * Exported so the dashboard can serve the exact same bytes the bot renders with.
 */
export function getFontsDir(): string {
  const candidate = join(__dirname, "files");
  if (existsSync(candidate)) return candidate;

  const srcCandidate = join(
    __dirname, "..", "..", "..", "..", "src", "welcome", "image", "fonts", "files",
  );
  if (existsSync(srcCandidate)) return srcCandidate;

  return candidate;
}

/** Register every bundled font. Safe to call repeatedly — registers once. */
export function registerFonts(): void {
  if (fontsRegistered) return;

  const dir = getFontsDir();
  const all = [
    ...LATIN_FONTS.map((f) => ({ family: f.family, file: f.file })),
    ...Object.values(ARABIC_FONTS).map((f) => ({ family: f.family, file: f.file })),
    { family: EMOJI_FONT.family, file: EMOJI_FONT.file },
  ];

  for (const font of all) {
    const path = join(dir, font.file);
    if (existsSync(path)) GlobalFonts.registerFromPath(path, font.family);
  }

  fontsRegistered = true;
}

/** All picker-selectable fonts for the dashboard UI. */
export function getAvailableFonts(): FontDefinition[] {
  return [...AVAILABLE_FONTS];
}

/** Whether a stored font id is known. */
export function isValidFont(name: string): boolean {
  return AVAILABLE_FONTS.some((f) => f.name === name);
}
```

Note `getFontFamily` is deliberately gone — `buildFontSpec` (Task 2) replaces it, because a bare family name without the Arabic and emoji fallbacks is exactly the bug being fixed.

- [ ] **Step 7: Derive `AVAILABLE_FONTS` from the manifest**

In `packages/systems/src/welcome/image/constants.ts`, replace the hand-written 8-entry `AVAILABLE_FONTS` array (lines 50-107) with:

```typescript
import { LATIN_FONTS } from "./fonts/manifest.js";

/** Available fonts shipped with the system (derived from the font manifest). */
export const AVAILABLE_FONTS: FontDefinition[] = LATIN_FONTS.map((f) => ({
  name: f.name,
  displayName: f.displayName,
  category: f.category,
  file: f.file,
  weight: f.weight,
}));
```

Keep the existing `import type { WelcomeImageSettings, FontDefinition } from "./types.js";` line and every other export in the file unchanged.

- [ ] **Step 8: Run the test to verify it passes**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/systems test -- tests/unit/welcome/image/fonts.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 9: Typecheck and commit**

```bash
pnpm typecheck
git add packages/systems/src/welcome/image/fonts packages/systems/src/welcome/image/constants.ts \
        packages/systems/tests/unit/welcome/image/fonts.test.ts
git commit -m "feat(welcome): add Arabic and emoji fonts behind a single manifest

node:22-alpine ships no system fonts, so the eight Latin-only TTFs were the
only glyphs Skia could reach — every Arabic name rendered as tofu. Vendor
four Arabic faces paired by category plus a COLRv1 emoji font, and make one
manifest the source of truth for both registration and family naming.

Static instances only: @napi-rs/canvas ignores the variable wght axis while
browsers honour it, which would desync the preview from the bot."
```

---

## Task 2: Text Pipeline (`core/text.ts`)

**Files:**

- Create: `packages/systems/src/welcome/image/core/text.ts`
- Test: `packages/systems/tests/unit/welcome/image/text.test.ts`

**Interfaces:**

- Consumes: `getLatinFont`, `ARABIC_FONTS`, `EMOJI_FONT` from Task 1.
- Produces: `buildFontSpec(fontName: string, sizePx: number): string`, `baseDirection(text: string): "ltr" | "rtl"`, `fitText(ctx: TextMeasurer, text: string, maxWidth: number): string`, `hexToRgba(hex: string, alpha: number): string`, `replaceImageVariables(text, member, guild): string`, `interface TextMeasurer { measureText(t: string): { width: number } }`.

- [ ] **Step 1: Write the failing test**

Create `packages/systems/tests/unit/welcome/image/text.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/systems test -- tests/unit/welcome/image/text.test.ts
```

Expected: FAIL — `Cannot find module '.../core/text.js'`.

- [ ] **Step 3: Write `core/text.ts`**

```typescript
import { getLatinFont, ARABIC_FONTS, EMOJI_FONT } from "../fonts/manifest.js";

/** The single-character ellipsis. Three periods bidi-reorder badly in RTL text. */
const ELLIPSIS = "…";

/**
 * Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic, Arabic Extended-A,
 * plus the Arabic/Hebrew presentation form blocks.
 */
const RTL_STRONG = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

/** Latin, Latin Extended, IPA, Greek, Cyrillic, Armenian. */
const LTR_STRONG = /[A-Za-zÀ-˿Ͱ-֏Ḁ-῿]/;

/** Anything with a `measureText` — both canvas contexts and test doubles. */
export interface TextMeasurer {
  measureText(text: string): { width: number };
}

/**
 * Build the canvas font shorthand for a stored font id.
 *
 * The Arabic companion and emoji font are appended as fallbacks so mixed-script
 * text resolves per-codepoint. Weight is explicit so Skia and the browser pick
 * the same face.
 */
export function buildFontSpec(fontName: string, sizePx: number): string {
  const latin = getLatinFont(fontName);
  const arabic = ARABIC_FONTS[latin.arabic];
  return `${latin.weight} ${sizePx}px "${latin.family}", "${arabic.family}", "${EMOJI_FONT.family}"`;
}

/**
 * Resolve a paragraph's base direction from its first strong character
 * (Unicode Bidi Algorithm rules P2/P3). Neutrals — digits, spaces,
 * punctuation — are skipped.
 */
export function baseDirection(text: string): "ltr" | "rtl" {
  for (const ch of text) {
    if (RTL_STRONG.test(ch)) return "rtl";
    if (LTR_STRONG.test(ch)) return "ltr";
  }
  return "ltr";
}

let graphemeSegmenter: Intl.Segmenter | undefined;

function graphemes(text: string): string[] {
  graphemeSegmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
}

/**
 * Truncate to `maxWidth`, cutting only on grapheme boundaries so surrogate
 * pairs, ZWJ emoji sequences, and Arabic combining marks stay intact.
 *
 * Callers must set `ctx.direction` before calling: measurement has to happen
 * under the same direction as the eventual draw.
 */
export function fitText(ctx: TextMeasurer, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  const parts = graphemes(text);
  let lo = 0;
  let hi = parts.length;

  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(parts.slice(0, mid).join("") + ELLIPSIS).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }

  return parts.slice(0, lo).join("") + ELLIPSIS;
}

/** Convert `#rgb` or `#rrggbb` to an rgba() string. Unparseable input yields transparent black. */
export function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(0, 0, 0, ${alpha})`;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface VariableMember {
  username: string;
  displayName: string;
}

export interface VariableGuild {
  name: string;
  memberCount: number;
}

/** Substitute `{user}`-style placeholders in image subtitle text. */
export function replaceImageVariables(
  text: string,
  member: VariableMember,
  guild: VariableGuild,
): string {
  return text
    .replaceAll("{user.displayname}", member.displayName)
    .replaceAll("{user.name}", member.username)
    .replaceAll("{user}", member.username)
    .replaceAll("{server}", guild.name)
    .replaceAll("{membercount}", guild.memberCount.toLocaleString());
}
```

Note the replacement order: `{user.displayname}` and `{user.name}` are substituted before `{user}`, otherwise `{user}` matches their prefix and leaves `.displayname` stranded.

- [ ] **Step 4: Run the test to verify it passes**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/systems test -- tests/unit/welcome/image/text.test.ts
```

Expected: PASS, 16 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm typecheck
git add packages/systems/src/welcome/image/core/text.ts \
        packages/systems/tests/unit/welcome/image/text.test.ts
git commit -m "feat(welcome): add bidi-aware, grapheme-safe text pipeline

slice(0, -1) cut UTF-16 code units, splitting surrogate pairs, ZWJ emoji, and
Arabic harakat; appending '...' under direction=ltr put the ellipsis on the
visually wrong side of RTL text. Segment by grapheme, append U+2026, and
resolve base direction from the first strong character.

hexToRgba now expands #rgb shorthand instead of returning NaN channels."
```

---

## Task 3: Shared Draw Core and Server Renderer

**Files:**

- Create: `packages/systems/src/welcome/image/core/types.ts`
- Create: `packages/systems/src/welcome/image/core/draw.ts`
- Modify: `packages/systems/src/welcome/image/renderer.ts` (replace entirely)
- Modify: `packages/systems/src/welcome/image/index.ts`
- Test: `packages/systems/tests/unit/welcome/image/arabic-render.test.ts`

**Interfaces:**

- Consumes: `buildFontSpec`, `baseDirection`, `fitText`, `hexToRgba`, `replaceImageVariables` (Task 2); `registerFonts` (Task 1); `getTemplate` from `../templates/index.js`; `PRESET_GRADIENTS` from `../constants.js`.
- Produces: `Ctx2D<TImage>`, `GradientLike`, `RenderBackend<TImage>` from `core/types.js`; `drawCard<TImage>(ctx: Ctx2D<TImage>, settings: WelcomeImageSettings, member: RenderInput["member"], guild: RenderInput["guild"], backend: RenderBackend<TImage>): Promise<void>` from `core/draw.js` (**five** parameters — the template is resolved internally from `settings.template`); `generateWelcomeImage(options): Promise<Buffer>` unchanged from `renderer.js`.

- [ ] **Step 1: Write the failing test**

Create `packages/systems/tests/unit/welcome/image/arabic-render.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/systems test -- tests/unit/welcome/image/arabic-render.test.ts
```

Expected: FAIL — `buildFontSpec` resolves but the widths match, or the module is missing.

- [ ] **Step 3: Write `core/types.ts`**

```typescript
/** Minimal gradient surface shared by both canvas implementations. */
export interface GradientLike {
  addColorStop(offset: number, color: string): void;
}

/**
 * The subset of CanvasRenderingContext2D the renderer uses. Both
 * `SKRSContext2D` (@napi-rs/canvas) and the browser's
 * `CanvasRenderingContext2D` satisfy this structurally.
 */
export interface Ctx2D<TImage = unknown> {
  fillStyle: string | GradientLike;
  strokeStyle: string | GradientLike;
  lineWidth: number;
  lineCap: "butt" | "round" | "square";
  font: string;
  textAlign: "left" | "center" | "right" | "start" | "end";
  textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom";
  direction: "ltr" | "rtl" | "inherit";

  save(): void;
  restore(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  roundRect(x: number, y: number, w: number, h: number, radii: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  clip(): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): GradientLike;
  createRadialGradient(
    x0: number, y0: number, r0: number, x1: number, y1: number, r1: number,
  ): GradientLike;
  measureText(text: string): { width: number };
  fillText(text: string, x: number, y: number): void;
  drawImage(image: TImage, dx: number, dy: number, dw: number, dh: number): void;
}

/**
 * The genuinely environment-specific parts: how images are obtained and sized.
 * The server reads backgrounds through a StorageAdapter; the browser fetches
 * them over HTTP and reports size via naturalWidth/naturalHeight.
 */
export interface RenderBackend<TImage> {
  /** Load an image from an absolute URL (used for avatars). */
  loadImage(url: string): Promise<TImage>;
  /** Load a stored background by its storage key. Rejects if unavailable. */
  loadBackgroundImage(imageKey: string): Promise<TImage>;
  /** Intrinsic pixel dimensions of a loaded image. */
  measureImage(image: TImage): { width: number; height: number };
}
```

- [ ] **Step 4: Write `core/draw.ts`**

This is the current `renderer.ts` drawing logic, made backend-agnostic. Behaviour changes are limited to three deliberate fixes, all marked below.

```typescript
import { getTemplate } from "../templates/index.js";
import { PRESET_GRADIENTS, type PresetBackground } from "../constants.js";
import {
  buildFontSpec,
  baseDirection,
  fitText,
  hexToRgba,
  replaceImageVariables,
} from "./text.js";
import type { Ctx2D, RenderBackend } from "./types.js";
import type {
  TemplateLayout,
  TemplateDecoration,
  WelcomeImageSettings,
  RenderInput,
} from "../types.js";

function resolveColor(colorSource: string, settings: WelcomeImageSettings): string {
  if (colorSource === "accent") return settings.accentColor;
  if (colorSource === "title") return settings.title.color;
  if (colorSource === "subtitle") return settings.subtitle.color;
  return colorSource;
}

async function drawBackground<T>(
  ctx: Ctx2D<T>,
  width: number,
  height: number,
  settings: WelcomeImageSettings,
  backend: RenderBackend<T>,
): Promise<void> {
  const { background } = settings;

  if (background.type === "image" && background.imageKey) {
    try {
      const img = await backend.loadBackgroundImage(background.imageKey);
      const size = backend.measureImage(img);
      const scale = Math.max(width / size.width, height / size.height);
      const drawWidth = size.width * scale;
      const drawHeight = size.height * scale;
      ctx.drawImage(
        img,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      return;
    } catch {
      // Fall through to gradient/solid fallback.
    }
  }

  if (background.type === "preset" && background.preset) {
    const colors = PRESET_GRADIENTS[background.preset as PresetBackground];
    if (colors) {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(colors[2] ? 0.5 : 1, colors[1]);
      if (colors[2]) gradient.addColorStop(1, colors[2]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      return;
    }
  }

  ctx.fillStyle = background.color;
  ctx.fillRect(0, 0, width, height);
}

function drawOverlay<T>(
  ctx: Ctx2D<T>,
  width: number,
  height: number,
  settings: WelcomeImageSettings,
): void {
  if (!settings.overlay.enabled) return;
  ctx.fillStyle = hexToRgba(settings.overlay.color, settings.overlay.opacity);
  ctx.fillRect(0, 0, width, height);
}

function drawAvatarShape<T>(
  ctx: Ctx2D<T>,
  x: number,
  y: number,
  radius: number,
  shape: "circle" | "rounded" | "square",
): void {
  if (shape === "circle") {
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  } else if (shape === "rounded") {
    ctx.roundRect(x - radius, y - radius, radius * 2, radius * 2, radius * 0.3);
  } else {
    ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
  }
}

async function drawAvatar<T>(
  ctx: Ctx2D<T>,
  layout: TemplateLayout,
  settings: WelcomeImageSettings,
  avatarUrl: string,
  backend: RenderBackend<T>,
): Promise<void> {
  const { x, y, size } = layout.avatar;
  const { avatar } = settings;
  const radius = size / 2;

  if (avatar.glowEnabled) {
    const glowRadius = radius + 20;
    const gradient = ctx.createRadialGradient(x, y, radius, x, y, glowRadius);
    gradient.addColorStop(0, hexToRgba(avatar.glowColor, 0.3));
    gradient.addColorStop(1, hexToRgba(avatar.glowColor, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (avatar.borderWidth > 0) {
    ctx.beginPath();
    drawAvatarShape(ctx, x, y, radius + avatar.borderWidth, avatar.shape);
    ctx.fillStyle = avatar.borderColor;
    ctx.fill();
  }

  ctx.save();
  ctx.beginPath();
  drawAvatarShape(ctx, x, y, radius, avatar.shape);
  ctx.clip();

  try {
    const img = await backend.loadImage(avatarUrl);
    ctx.drawImage(img, x - radius, y - radius, size, size);
  } catch {
    ctx.fillStyle = "#374151";
    ctx.fill();
  }

  ctx.restore();
}

function drawDecorations<T>(
  ctx: Ctx2D<T>,
  width: number,
  height: number,
  decorations: TemplateDecoration[],
  settings: WelcomeImageSettings,
): void {
  for (const dec of decorations) {
    const color = resolveColor(dec.props.colorSource as string, settings);
    const opacity = (dec.props.opacity as number) ?? 1;
    const p = dec.props;

    switch (dec.type) {
      case "line":
        ctx.strokeStyle = hexToRgba(color, opacity);
        ctx.lineWidth = (p.width as number) ?? 1;
        ctx.beginPath();
        ctx.moveTo(p.x1 as number, p.y1 as number);
        ctx.lineTo(p.x2 as number, p.y2 as number);
        ctx.stroke();
        break;

      case "border": {
        const inset = (p.inset as number) ?? 20;
        ctx.strokeStyle = hexToRgba(color, opacity);
        ctx.lineWidth = (p.width as number) ?? 1;
        ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
        break;
      }

      case "corner-accents": {
        const inset = (p.inset as number) ?? 15;
        const len = (p.length as number) ?? 40;
        ctx.strokeStyle = hexToRgba(color, opacity);
        ctx.lineWidth = (p.width as number) ?? 3;
        ctx.lineCap = "round";

        const corners: number[][] = [
          [inset, inset + len, inset, inset, inset + len, inset],
          [width - inset - len, inset, width - inset, inset, width - inset, inset + len],
          [inset, height - inset - len, inset, height - inset, inset + len, height - inset],
          [
            width - inset - len, height - inset,
            width - inset, height - inset,
            width - inset, height - inset - len,
          ],
        ];

        for (const [x1, y1, x2, y2, x3, y3] of corners) {
          ctx.beginPath();
          ctx.moveTo(x1!, y1!);
          ctx.lineTo(x2!, y2!);
          ctx.lineTo(x3!, y3!);
          ctx.stroke();
        }
        ctx.lineCap = "butt";
        break;
      }

      case "gradient-bar": {
        const x = p.x as number;
        const y = p.y as number;
        const w = (p.width as number) ?? 100;
        const h = (p.height as number) ?? 3;
        const gradient = h > w
          ? ctx.createLinearGradient(x, y, x, y + h)
          : ctx.createLinearGradient(x, y, x + w, y);
        gradient.addColorStop(0, hexToRgba(color, 0));
        gradient.addColorStop(0.5, hexToRgba(color, opacity));
        gradient.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, w, h);
        break;
      }

      case "glow": {
        const x = p.x as number;
        const y = p.y as number;
        const radius = (p.radius as number) ?? 80;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, hexToRgba(color, opacity));
        gradient.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case "rect":
        ctx.fillStyle = hexToRgba(color, opacity);
        ctx.fillRect(p.x as number, p.y as number, p.width as number, p.height as number);
        break;
    }
  }
}

function drawText<T>(
  ctx: Ctx2D<T>,
  text: string,
  x: number,
  y: number,
  options: {
    font: string;
    size: number;
    color: string;
    align: "left" | "center" | "right";
    maxWidth: number;
  },
): void {
  ctx.font = buildFontSpec(options.font, options.size);
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align;
  ctx.textBaseline = "middle";

  // Direction must be set BEFORE measuring — measurement has to happen under
  // the same direction as the draw, or truncation width is wrong and the
  // ellipsis lands on the wrong side of RTL text.
  ctx.direction = baseDirection(text);

  // No maxWidth argument to fillText: it condenses glyphs, and Skia's and the
  // browser's condensation algorithms differ. We have already truncated.
  ctx.fillText(fitText(ctx, text, options.maxWidth), x, y);
}

/**
 * Draw a complete welcome/farewell card onto any 2D context.
 *
 * The single drawing implementation shared by the bot (@napi-rs/canvas) and
 * the dashboard live preview (browser canvas).
 */
export async function drawCard<T>(
  ctx: Ctx2D<T>,
  settings: WelcomeImageSettings,
  member: RenderInput["member"],
  guild: RenderInput["guild"],
  backend: RenderBackend<T>,
): Promise<void> {
  const template = getTemplate(settings.template);
  const { width, height } = template.canvas;

  await drawBackground(ctx, width, height, settings, backend);
  drawOverlay(ctx, width, height, settings);
  drawDecorations(ctx, width, height, template.decorations, settings);
  await drawAvatar(ctx, template, settings, member.avatarUrl, backend);

  drawText(ctx, member.displayName, template.title.x, template.title.y, {
    font: settings.title.font,
    size: settings.title.size || template.title.defaultSize,
    color: settings.title.color,
    align: template.title.align,
    maxWidth: template.title.maxWidth,
  });

  const subtitle = replaceImageVariables(settings.subtitle.text, member, guild);
  drawText(ctx, subtitle, template.subtitle.x, template.subtitle.y, {
    font: settings.subtitle.font,
    size: settings.subtitle.size || template.subtitle.defaultSize,
    color: settings.subtitle.color,
    align: template.subtitle.align,
    maxWidth: template.subtitle.maxWidth,
  });
}
```

- [ ] **Step 5: Rewrite `renderer.ts` as a thin server wrapper**

Replace the entire file:

```typescript
import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import { registerFonts } from "./fonts/index.js";
import { getTemplate } from "./templates/index.js";
import { drawCard } from "./core/draw.js";
import type { Ctx2D, RenderBackend } from "./core/types.js";
import type { RenderInput, StorageAdapter } from "./types.js";

export interface GenerateImageOptions extends RenderInput {
  storage?: StorageAdapter;
}

function nodeBackend(storage?: StorageAdapter): RenderBackend<Image> {
  return {
    loadImage: (url) => loadImage(url),
    loadBackgroundImage: async (imageKey) => {
      if (!storage) throw new Error("no storage adapter configured");
      return loadImage(await storage.get(imageKey));
    },
    measureImage: (image) => ({ width: image.width, height: image.height }),
  };
}

/**
 * Generate a welcome/farewell image as a PNG buffer.
 *
 * Entry point for the bot (member join/leave) and the dashboard's server-side
 * preview endpoint. Drawing itself lives in core/draw.ts, shared with the
 * browser preview so the two cannot drift.
 */
export async function generateWelcomeImage(options: GenerateImageOptions): Promise<Buffer> {
  registerFonts();

  const { settings, member, guild, storage } = options;
  const { width, height } = getTemplate(settings.template).canvas;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  await drawCard(
    ctx as unknown as Ctx2D<Image>,
    settings,
    member,
    guild,
    nodeBackend(storage),
  );

  return canvas.toBuffer("image/png");
}
```

- [ ] **Step 6: Export the new modules from the barrel**

In `packages/systems/src/welcome/image/index.ts`, add after the existing Fonts block:

```typescript
// Shared render core (browser-safe — no @napi-rs/canvas import)
export { drawCard } from "./core/draw.js";
export type { Ctx2D, GradientLike, RenderBackend } from "./core/types.js";
export {
  buildFontSpec,
  baseDirection,
  fitText,
  hexToRgba,
  replaceImageVariables,
} from "./core/text.js";
export {
  LATIN_FONTS,
  ARABIC_FONTS,
  EMOJI_FONT,
  getLatinFont,
  type LatinFont,
  type ArabicFont,
  type ArabicFontKey,
} from "./fonts/manifest.js";
export { getFontsDir } from "./fonts/index.js";
```

Also remove `getFontFamily` from the `./fonts/index.js` export list if present — it no longer exists.

- [ ] **Step 7: Run the test to verify it passes**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/systems test -- tests/unit/welcome/image/arabic-render.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 8: Run the whole systems suite for regressions**

```bash
docker compose --profile bot run --rm bot pnpm --filter @fluxcore/systems test
```

Expected: PASS. `tests/unit/welcome/image/templates.test.ts` and `types.test.ts` must still pass untouched.

- [ ] **Step 9: Typecheck and commit**

```bash
pnpm typecheck
git add packages/systems/src/welcome/image packages/systems/tests/unit/welcome/image
git commit -m "refactor(welcome): extract one backend-agnostic draw core

Drawing now runs against a structural Ctx2D interface that both
@napi-rs/canvas and the browser context satisfy, so the bot and the dashboard
preview execute the same code instead of two hand-synchronised copies.

Also drops the maxWidth argument to fillText — it condenses glyphs, and Skia's
and the browser's condensation algorithms differ."
```

---

## Task 4: Package Exports and Font Serving

**Files:**

- Modify: `packages/systems/package.json` (`exports` map)
- Modify: `apps/dashboard/src/server/index.ts:135-140`
- Test: `apps/dashboard/tests/server/features/welcome/fontsStatic.test.ts`

**Interfaces:**

- Consumes: `getFontsDir` (Task 3).
- Produces: HTTP route `GET /fonts/welcome/:file` serving the vendored TTFs; importable subpaths `@fluxcore/systems/welcome/image/core/draw`, `.../core/text`, `.../core/types`, `.../fonts/manifest`.

- [ ] **Step 1: Add granular exports entries**

In `packages/systems/package.json`, inside `exports`, immediately after the existing `"./welcome/image/fonts"` entry, add:

```json
    "./welcome/image/fonts/manifest": {
      "types": "./dist/welcome/image/fonts/manifest.d.ts",
      "import": "./dist/welcome/image/fonts/manifest.js"
    },
    "./welcome/image/core/draw": {
      "types": "./dist/welcome/image/core/draw.d.ts",
      "import": "./dist/welcome/image/core/draw.js"
    },
    "./welcome/image/core/text": {
      "types": "./dist/welcome/image/core/text.d.ts",
      "import": "./dist/welcome/image/core/text.js"
    },
    "./welcome/image/core/types": {
      "types": "./dist/welcome/image/core/types.d.ts",
      "import": "./dist/welcome/image/core/types.js"
    },
```

These exist so client code can import the core **without** touching `./welcome/image` (the barrel), which pulls in `renderer.js` and therefore `@napi-rs/canvas` — a native module Vite cannot bundle.

- [ ] **Step 2: Write the failing test**

Create `apps/dashboard/tests/server/features/welcome/fontsStatic.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { getFontsDir } from "@fluxcore/systems/welcome/image";
import { LATIN_FONTS, ARABIC_FONTS, EMOJI_FONT } from "@fluxcore/systems/welcome/image/fonts/manifest";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  app.register(fastifyStatic, {
    root: getFontsDir(),
    prefix: "/fonts/welcome/",
    decorateReply: false,
    immutable: true,
    maxAge: 31_536_000_000,
  });
  await app.ready();
});

afterAll(async () => app.close());

describe("GET /fonts/welcome/:file", () => {
  it("serves every Latin font the manifest declares", async () => {
    for (const font of LATIN_FONTS) {
      const res = await app.inject({ method: "GET", url: `/fonts/welcome/${font.file}` });
      expect(res.statusCode, font.file).toBe(200);
      expect(res.rawPayload.length).toBeGreaterThan(1000);
    }
  });

  it("serves every Arabic font and the emoji font", async () => {
    const files = [...Object.values(ARABIC_FONTS).map((f) => f.file), EMOJI_FONT.file];
    for (const file of files) {
      const res = await app.inject({ method: "GET", url: `/fonts/welcome/${file}` });
      expect(res.statusCode, file).toBe(200);
    }
  });

  it("marks fonts immutably cacheable", async () => {
    const res = await app.inject({ method: "GET", url: `/fonts/welcome/${LATIN_FONTS[0]!.file}` });
    expect(res.headers["cache-control"]).toContain("immutable");
    expect(res.headers["cache-control"]).toContain("max-age=31536000");
  });

  it("404s for a file outside the manifest", async () => {
    const res = await app.inject({ method: "GET", url: "/fonts/welcome/nope.ttf" });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/server/features/welcome/fontsStatic.test.ts
```

Expected: FAIL — `getFontsDir` is not exported / module not found.

- [ ] **Step 4: Register the route in the real server**

In `apps/dashboard/src/server/index.ts`, add the import alongside the other `@fluxcore/systems` imports:

```typescript
import { getFontsDir } from "@fluxcore/systems/welcome/image";
```

Then, immediately after the existing `/uploads/` static registration (currently lines 135-140), add:

```typescript
  // Serve the exact font files the bot renders with, so the browser preview
  // and the generated image resolve identical glyphs and metrics.
  app.register(fastifyStatic, {
    root: getFontsDir(),
    prefix: "/fonts/welcome/",
    decorateReply: false,
    immutable: true,
    maxAge: 31_536_000_000,
  });
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/server/features/welcome/fontsStatic.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm typecheck
git add packages/systems/package.json apps/dashboard/src/server/index.ts \
        apps/dashboard/tests/server/features/welcome/fontsStatic.test.ts
git commit -m "feat(dashboard): serve the bot's font files to the browser preview

The preview previously pulled fonts from the Google Fonts CDN (variable,
latest) while the bot used pinned static TTFs, so the two rendered different
metrics. Serve the vendored files directly, immutably cached."
```

---

## Task 5: Client Renderer Rewrite

**Files:**

- Create: `apps/dashboard/src/client/features/welcome/image/fonts.ts`
- Modify: `apps/dashboard/src/client/features/welcome/image/renderer.ts` (replace entirely)
- Delete: `apps/dashboard/src/client/features/welcome/image/templates.ts`
- Test: `apps/dashboard/tests/client/features/welcome/clientRenderer.test.ts`

**Interfaces:**

- Consumes: `drawCard`, `Ctx2D`, `RenderBackend` (Task 3); `LATIN_FONTS`, `ARABIC_FONTS`, `EMOJI_FONT`, `getLatinFont` (Task 1); `getTemplate` from `@fluxcore/systems/welcome/image/templates`; `/fonts/welcome/` route (Task 4).
- Produces: `ensureFontsFor(fontNames: string[], text: string): Promise<void>`; `renderWelcomeImagePreview(input: RenderInput): Promise<{ blob: Blob; url: string }>`.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/features/welcome/clientRenderer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

// ESM test files have no __dirname.
const CLIENT_IMAGE_DIR = join(
  import.meta.dirname, "..", "..", "..", "..", "src", "client", "features", "welcome", "image",
);

describe("client image module", () => {
  it("no longer duplicates the template definitions", () => {
    expect(existsSync(join(CLIENT_IMAGE_DIR, "templates.ts"))).toBe(false);
  });

  it("imports templates from @fluxcore/systems, not a local copy", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(join(CLIENT_IMAGE_DIR, "renderer.ts"), "utf8");
    expect(src).toContain("@fluxcore/systems/welcome/image/templates");
    expect(src).not.toMatch(/from ["']\.\/templates["']/);
  });

  it("never references the Google Fonts CDN", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["renderer.ts", "fonts.ts"]) {
      const src = readFileSync(join(CLIENT_IMAGE_DIR, file), "utf8");
      expect(src, file).not.toContain("fonts.googleapis.com");
      expect(src, file).not.toContain("fonts.gstatic.com");
    }
  });

  it("does not import the systems barrel (which pulls in @napi-rs/canvas)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(join(CLIENT_IMAGE_DIR, "renderer.ts"), "utf8");
    expect(src).not.toMatch(/from ["']@fluxcore\/systems\/welcome\/image["']/);
  });
});

describe("ensureFontsFor", () => {
  const added: string[] = [];

  beforeEach(() => {
    added.length = 0;
    vi.stubGlobal(
      "FontFace",
      class {
        constructor(public family: string, public source: string, public desc: unknown) {}
        load() { return Promise.resolve(this); }
      },
    );
    vi.stubGlobal("document", {
      fonts: { add: (f: { family: string }) => added.push(f.family) },
    });
  });

  it("loads the Latin font and its Arabic companion", async () => {
    const { ensureFontsFor } = await import(
      "../../../../src/client/features/welcome/image/fonts"
    );
    await ensureFontsFor(["PlayfairDisplay"], "Ahmed");
    expect(added).toContain("PlayfairDisplay");
    expect(added).toContain("Amiri");
  });

  it("skips the 4.8MB emoji font when the text has no emoji", async () => {
    const { ensureFontsFor } = await import(
      "../../../../src/client/features/welcome/image/fonts"
    );
    await ensureFontsFor(["Inter"], "Ahmed Al-Rashid");
    expect(added).not.toContain("NotoColorEmoji");
  });

  it("loads the emoji font when the text contains emoji", async () => {
    const { ensureFontsFor } = await import(
      "../../../../src/client/features/welcome/image/fonts"
    );
    await ensureFontsFor(["Inter"], "Ahmed 🎉");
    expect(added).toContain("NotoColorEmoji");
  });

  it("requests fonts from the local /fonts/welcome route", async () => {
    const sources: string[] = [];
    vi.stubGlobal(
      "FontFace",
      class {
        constructor(public family: string, public source: string) { sources.push(source); }
        load() { return Promise.resolve(this); }
      },
    );
    const { ensureFontsFor } = await import(
      "../../../../src/client/features/welcome/image/fonts"
    );
    await ensureFontsFor(["Inter"], "Ahmed");
    expect(sources.every((s) => s.startsWith("url(/fonts/welcome/"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/client/features/welcome/clientRenderer.test.ts
```

Expected: FAIL — `templates.ts` still exists and `fonts.ts` is missing.

- [ ] **Step 3: Write `fonts.ts`**

```typescript
import {
  ARABIC_FONTS,
  EMOJI_FONT,
  getLatinFont,
} from "@fluxcore/systems/welcome/image/fonts/manifest";

const FONT_BASE = "/fonts/welcome";

/** Faces already loaded (or in flight), keyed by family+weight. */
const inFlight = new Map<string, Promise<void>>();

const HAS_EMOJI = /\p{Extended_Pictographic}/u;

function loadFace(family: string, file: string, weight: number): Promise<void> {
  const key = `${family}:${weight}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const job = (async () => {
    const face = new FontFace(family, `url(${FONT_BASE}/${file})`, { weight: String(weight) });
    await face.load();
    document.fonts.add(face);
  })().catch(() => {
    // A font that fails to load should degrade the preview, not break it.
    // Drop the cache entry so a later render can retry.
    inFlight.delete(key);
  });

  inFlight.set(key, job);
  return job;
}

/**
 * Ensure every font needed to draw `text` is parsed and registered.
 *
 * Resolves only once the bytes are available, which is what makes the first
 * preview render in the correct face — the old <link> + document.fonts.ready
 * approach returned before the browser had fetched anything.
 *
 * The emoji font is 4.8MB, so it is fetched only when the text needs it.
 */
export async function ensureFontsFor(fontNames: string[], text: string): Promise<void> {
  const jobs: Promise<void>[] = [];

  for (const name of new Set(fontNames)) {
    const latin = getLatinFont(name);
    jobs.push(loadFace(latin.family, latin.file, latin.weight));
    const arabic = ARABIC_FONTS[latin.arabic];
    jobs.push(loadFace(arabic.family, arabic.file, arabic.weight));
  }

  if (HAS_EMOJI.test(text)) {
    jobs.push(loadFace(EMOJI_FONT.family, EMOJI_FONT.file, EMOJI_FONT.weight));
  }

  await Promise.all(jobs);
}
```

- [ ] **Step 4: Rewrite `renderer.ts`**

Replace the entire 463-line file with:

```typescript
import { drawCard } from "@fluxcore/systems/welcome/image/core/draw";
import { replaceImageVariables } from "@fluxcore/systems/welcome/image/core/text";
import { getTemplate } from "@fluxcore/systems/welcome/image/templates";
import type { Ctx2D, RenderBackend } from "@fluxcore/systems/welcome/image/core/types";
import type { RenderInput } from "@fluxcore/systems/welcome/image/types";
import { ensureFontsFor } from "./fonts";

export interface GenerateResult {
  blob: Blob;
  url: string;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${src}`));
    img.src = src;
  });
}

const browserBackend: RenderBackend<HTMLImageElement> = {
  loadImage: loadImageElement,
  loadBackgroundImage: (imageKey) => loadImageElement(`/uploads/welcome/${imageKey}`),
  measureImage: (img) => ({ width: img.naturalWidth, height: img.naturalHeight }),
};

/**
 * Render the live preview in the browser.
 *
 * Uses the same drawCard implementation, the same templates, and the same font
 * files as the bot, so the preview is not an approximation of the output.
 */
export async function renderWelcomeImagePreview(input: RenderInput): Promise<GenerateResult> {
  const { settings, member, guild } = input;
  const { width, height } = getTemplate(settings.template).canvas;

  const subtitle = replaceImageVariables(settings.subtitle.text, member, guild);
  await ensureFontsFor(
    [settings.title.font, settings.subtitle.font],
    `${member.displayName}${subtitle}`,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");

  await drawCard(
    ctx as unknown as Ctx2D<HTMLImageElement>,
    settings,
    member,
    guild,
    browserBackend,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null (tainted canvas?)"))),
      "image/png",
    );
  });

  return { blob, url: URL.createObjectURL(blob) };
}
```

The `toBlob` callback no longer force-unwraps with `b!` — a tainted canvas from a cross-origin avatar now rejects with a clear message that the caller's `catch` turns into the preview error state, instead of throwing an unhandled `TypeError`.

- [ ] **Step 5: Delete the duplicated templates file**

```bash
git rm apps/dashboard/src/client/features/welcome/image/templates.ts
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/client/features/welcome/clientRenderer.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 7: Typecheck and commit**

```bash
pnpm typecheck
git add apps/dashboard/src/client/features/welcome/image
git commit -m "refactor(dashboard): render the preview with the shared core

The client renderer and its 137-line copy of the template coordinates are
replaced by imports from @fluxcore/systems, so a template edit can no longer
make the preview silently lie. Fonts load via FontFace from /fonts/welcome,
which also fixes the first preview rendering in a fallback face.

toBlob no longer force-unwraps its result, so a tainted canvas surfaces as a
preview error rather than an unhandled throw."
```

---

## Task 6: Fix the Preview Render Race

**Files:**

- Create: `apps/dashboard/src/client/features/welcome/image/useLatestOnly.ts`
- Modify: `apps/dashboard/src/client/features/welcome/components/WelcomeImageEditor.tsx:108-146`
- Test: `apps/dashboard/tests/client/features/welcome/useLatestOnly.test.ts`

**Interfaces:**

- Consumes: `renderWelcomeImagePreview` (Task 5).
- Produces: `useLatestOnly(): { begin(): number; isCurrent(token: number): boolean }`.

**Context:** `cancelAnimationFrame` only cancels a *pending* frame. Once the callback at line 117 begins, its `await` continuation cannot be cancelled, so two overlapping renders both reach line 133. The older one revokes `prevUrlRef.current` — which by then holds the *newer* URL — and then sets a stale `previewUrl`. The result is a broken image.

The guard is extracted into a hook rather than inlined so it can be tested against real shipped code. Testing the full editor would mean mocking six data hooks plus Radix primitives for one assertion; the hook carries all the logic that can actually be wrong.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/features/welcome/useLatestOnly.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLatestOnly } from "../../../../src/client/features/welcome/image/useLatestOnly";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("useLatestOnly", () => {
  it("treats the only outstanding token as current", () => {
    const { result } = renderHook(() => useLatestOnly());
    const token = result.current.begin();
    expect(result.current.isCurrent(token)).toBe(true);
  });

  it("invalidates an older token once a newer one begins", () => {
    const { result } = renderHook(() => useLatestOnly());
    const older = result.current.begin();
    const newer = result.current.begin();

    expect(result.current.isCurrent(older)).toBe(false);
    expect(result.current.isCurrent(newer)).toBe(true);
  });

  it("keeps a stable identity across re-renders so effects do not re-fire", () => {
    const { result, rerender } = renderHook(() => useLatestOnly());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("lets a slow older async render detect that it was superseded", async () => {
    const { result } = renderHook(() => useLatestOnly());
    const committed: string[] = [];
    const discarded: string[] = [];

    async function render(label: string, delayMs: number) {
      const token = result.current.begin();
      await sleep(delayMs);
      if (!result.current.isCurrent(token)) {
        discarded.push(label);
        return;
      }
      committed.push(label);
    }

    // "old" starts first but finishes last — the classic out-of-order case.
    await Promise.all([render("old", 40), render("new", 5)]);

    expect(committed).toEqual(["new"]);
    expect(discarded).toEqual(["old"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/client/features/welcome/useLatestOnly.test.ts
```

Expected: FAIL — `Cannot find module '.../useLatestOnly'`.

- [ ] **Step 3: Write the hook**

Create `apps/dashboard/src/client/features/welcome/image/useLatestOnly.ts`:

```typescript
import { useMemo, useRef } from "react";

export interface LatestOnly {
  /** Claim a token for a newly started async operation. Invalidates all earlier tokens. */
  begin(): number;
  /** Whether `token` is still the most recently claimed one. */
  isCurrent(token: number): boolean;
}

/**
 * Guard against out-of-order async completions.
 *
 * `cancelAnimationFrame` cannot stop a callback that has already awaited, so a
 * slow older render can otherwise finish after a newer one and overwrite it.
 * Each render claims a token and only commits if it is still current.
 */
export function useLatestOnly(): LatestOnly {
  const generation = useRef(0);

  return useMemo(
    () => ({
      begin: () => ++generation.current,
      isCurrent: (token: number) => token === generation.current,
    }),
    [],
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/client/features/welcome/useLatestOnly.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Wire the hook into the component**

In `WelcomeImageEditor.tsx`, add the import:

```typescript
import { useLatestOnly } from "../image/useLatestOnly";
```

Add beside the existing refs (near line 85):

```typescript
  const clientRender = useLatestOnly();
```

Then replace the client-render effect (lines 108-146) with:

```typescript
  // Client-side render — instant, no debounce
  useEffect(() => {
    if (previewMode !== "client") return;

    const token = clientRender.begin();

    setIsPending(true);
    setPreviewError(false);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(async () => {
      try {
        const { renderWelcomeImagePreview } = await import("../image/renderer");
        const result = await renderWelcomeImagePreview({
          settings,
          member: {
            username: user?.username ?? "User",
            displayName: user?.username ?? "User",
            avatarUrl,
          },
          guild: {
            name: "Your Server",
            memberCount: 1234,
          },
        });

        if (!clientRender.isCurrent(token)) {
          // Superseded while we were rendering — drop our own result rather
          // than revoking the newer render's live URL.
          URL.revokeObjectURL(result.url);
          return;
        }

        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = result.url;
        setPreviewUrl(result.url);
        setIsPending(false);
      } catch {
        if (!clientRender.isCurrent(token)) return;
        setIsPending(false);
        setPreviewError(true);
      }
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [settings, previewMode, user, avatarUrl, refreshKey, clientRender]);
```

`clientRender` is `useMemo`-stable, so adding it to the dependency array does not cause extra renders.

Note `settings` is now passed directly — the `settings as never` cast is gone, because the client and systems now share one `WelcomeImageSettings` type.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm typecheck
git add apps/dashboard/src/client/features/welcome \
        apps/dashboard/tests/client/features/welcome/useLatestOnly.test.ts
git commit -m "fix(dashboard): stop stale preview renders clobbering newer ones

cancelAnimationFrame cannot cancel a callback that has already awaited, so an
older render could revoke the newer render's blob URL and display a stale
image. Guard the commit with a generation counter.

Also drops the 'settings as never' cast now that client and systems share one
WelcomeImageSettings type."
```

---

## Task 7: Database Schema and Config Plumbing

**Files:**

- Modify: `packages/database/prisma/schema.prisma:251-268`
- Create: `packages/database/prisma/migrations/<timestamp>_add_welcome_message_style/migration.sql`
- Modify: `packages/systems/src/welcome/types.ts`
- Modify: `packages/systems/src/welcome/config.ts`
- Modify: `packages/systems/src/welcome/builder.ts`
- Test: `packages/systems/tests/unit/welcome/messageStyle.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `WelcomeConfig.welcomeMessageStyle: MessageStyle`, `.welcomeContent: string`, `.farewellMessageStyle: MessageStyle`, `.farewellContent: string` where `type MessageStyle = "plain" | "embed"`; `replaceWelcomeVariables(text: string, member: GuildMember): string` exported from `builder.ts`.

- [ ] **Step 1: Add the columns to the Prisma schema**

In `packages/database/prisma/schema.prisma`, replace the `WelcomeConfig` model body with:

```prisma
model WelcomeConfig {
  guildId               String  @id
  welcomeEnabled        Boolean @default(false)
  welcomeChannelId      String?
  welcomeMessage        String  @default("{}") // JSON embed config
  welcomeMessageStyle   String  @default("plain") // "plain" | "embed"
  welcomeContent        String  @default("") // plain-mode message text
  farewellEnabled       Boolean @default(false)
  farewellChannelId     String?
  farewellMessage       String  @default("{}") // JSON embed config
  farewellMessageStyle  String  @default("plain") // "plain" | "embed"
  farewellContent       String  @default("") // plain-mode message text
  dmEnabled             Boolean @default(false)
  dmMessage             String  @default("{}") // JSON embed config
  autoRoleIds           String  @default("[]") // JSON array of role IDs
  // Welcome image
  welcomeImageEnabled   Boolean @default(false)
  welcomeImageConfig    String  @default("{}") // JSON WelcomeImageSettings
  // Farewell image
  farewellImageEnabled  Boolean @default(false)
  farewellImageConfig   String  @default("{}") // JSON WelcomeImageSettings
}
```

- [ ] **Step 2: Generate the migration without applying it**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/database exec prisma migrate dev \
  --create-only --name add_welcome_message_style
```

- [ ] **Step 3: Rewrite the generated SQL as a two-step migration**

Prisma will have generated `ADD COLUMN ... DEFAULT 'plain'`, which would flip **every existing guild** to plain mode. Replace the file's contents with:

```sql
-- Existing guilds must keep the embed output they have today, while new guilds
-- get the plain format. A single column default cannot express that, because
-- upsertWelcomeConfig creates rows with `create: { guildId, ...dbData }` and
-- never sets these fields explicitly.
--
-- Step 1: add with the OLD value, backfilling every existing row.
ALTER TABLE "WelcomeConfig"
  ADD COLUMN "welcomeMessageStyle" TEXT NOT NULL DEFAULT 'embed',
  ADD COLUMN "welcomeContent" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "farewellMessageStyle" TEXT NOT NULL DEFAULT 'embed',
  ADD COLUMN "farewellContent" TEXT NOT NULL DEFAULT '';

-- Step 2: flip the default so rows created from now on get the new format.
-- This matches @default("plain") in schema.prisma.
ALTER TABLE "WelcomeConfig"
  ALTER COLUMN "welcomeMessageStyle" SET DEFAULT 'plain';
ALTER TABLE "WelcomeConfig"
  ALTER COLUMN "farewellMessageStyle" SET DEFAULT 'plain';
```

- [ ] **Step 4: Apply the migration and regenerate the client**

```bash
pnpm db:migrate
pnpm db:generate
```

- [ ] **Step 5: Write the failing test**

Create `packages/systems/tests/unit/welcome/messageStyle.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn();
const findUnique = vi.fn();

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({ welcomeConfig: { upsert, findUnique } }),
}));

const ROW = {
  guildId: "1",
  welcomeEnabled: true,
  welcomeChannelId: "c1",
  welcomeMessage: "{}",
  welcomeMessageStyle: "plain",
  welcomeContent: "Welcome {user}!",
  farewellEnabled: false,
  farewellChannelId: null,
  farewellMessage: "{}",
  farewellMessageStyle: "embed",
  farewellContent: "",
  dmEnabled: false,
  dmMessage: "{}",
  autoRoleIds: "[]",
  welcomeImageEnabled: false,
  welcomeImageConfig: "{}",
  farewellImageEnabled: false,
  farewellImageConfig: "{}",
};

beforeEach(() => {
  upsert.mockReset();
  findUnique.mockReset();
});

describe("getWelcomeConfig", () => {
  it("surfaces the message style and content fields", async () => {
    findUnique.mockResolvedValue(ROW);
    const { getWelcomeConfig } = await import("../../src/welcome/config.js");
    const config = await getWelcomeConfig("1");

    expect(config?.welcomeMessageStyle).toBe("plain");
    expect(config?.welcomeContent).toBe("Welcome {user}!");
    expect(config?.farewellMessageStyle).toBe("embed");
    expect(config?.farewellContent).toBe("");
  });

  it("defaults an absent style column to plain", async () => {
    const { welcomeMessageStyle, farewellMessageStyle, ...partial } = ROW;
    void welcomeMessageStyle;
    void farewellMessageStyle;
    findUnique.mockResolvedValue(partial);
    const { getWelcomeConfig } = await import("../../src/welcome/config.js");
    const config = await getWelcomeConfig("1");

    expect(config?.welcomeMessageStyle).toBe("plain");
  });
});

describe("upsertWelcomeConfig", () => {
  it("persists the new fields when provided", async () => {
    upsert.mockResolvedValue(ROW);
    const { upsertWelcomeConfig } = await import("../../src/welcome/config.js");
    await upsertWelcomeConfig("1", {
      welcomeMessageStyle: "plain",
      welcomeContent: "Hi {user}",
    });

    const arg = upsert.mock.calls[0]![0];
    expect(arg.update.welcomeMessageStyle).toBe("plain");
    expect(arg.update.welcomeContent).toBe("Hi {user}");
  });

  it("omits fields that were not provided", async () => {
    upsert.mockResolvedValue(ROW);
    const { upsertWelcomeConfig } = await import("../../src/welcome/config.js");
    await upsertWelcomeConfig("1", { welcomeEnabled: true });

    const arg = upsert.mock.calls[0]![0];
    expect(arg.update).not.toHaveProperty("welcomeMessageStyle");
    expect(arg.update).not.toHaveProperty("welcomeContent");
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/systems test -- tests/unit/welcome/messageStyle.test.ts
```

Expected: FAIL — `welcomeMessageStyle` is `undefined`.

- [ ] **Step 7: Extend the types**

In `packages/systems/src/welcome/types.ts`, add above `WelcomeConfig`:

```typescript
/** How a welcome/farewell message is delivered. */
export type MessageStyle = "plain" | "embed";
```

and add these four fields to the `WelcomeConfig` interface:

```typescript
  welcomeMessageStyle: MessageStyle;
  welcomeContent: string;
  farewellMessageStyle: MessageStyle;
  farewellContent: string;
```

- [ ] **Step 8: Plumb the fields through `config.ts`**

In `rowToConfig`, add after the `welcomeMessage` line:

```typescript
    welcomeMessageStyle: ((row.welcomeMessageStyle as string) ?? "plain") as MessageStyle,
    welcomeContent: (row.welcomeContent as string) ?? "",
```

and after the `farewellMessage` line:

```typescript
    farewellMessageStyle: ((row.farewellMessageStyle as string) ?? "plain") as MessageStyle,
    farewellContent: (row.farewellContent as string) ?? "",
```

Update the type import at the top:

```typescript
import type { WelcomeConfig, EmbedConfig, WelcomeImageSettings, MessageStyle } from "./types.js";
```

In `upsertWelcomeConfig`, add after the `welcomeMessage` guard:

```typescript
  if (data.welcomeMessageStyle !== undefined) dbData.welcomeMessageStyle = data.welcomeMessageStyle;
  if (data.welcomeContent !== undefined) dbData.welcomeContent = data.welcomeContent;
```

and after the `farewellMessage` guard:

```typescript
  if (data.farewellMessageStyle !== undefined) dbData.farewellMessageStyle = data.farewellMessageStyle;
  if (data.farewellContent !== undefined) dbData.farewellContent = data.farewellContent;
```

- [ ] **Step 9: Export the variable replacer from `builder.ts`**

In `packages/systems/src/welcome/builder.ts`, change the private helper to an export and give it the public name the bot will import:

```typescript
export function replaceWelcomeVariables(text: string, member: GuildMember): string {
  let result = text;
  for (const [variable, resolver] of Object.entries(WELCOME_VARIABLES)) {
    if (result.includes(variable)) {
      result = result.replaceAll(variable, resolver(member));
    }
  }
  return result;
}
```

Then update the four call sites inside `buildWelcomeEmbed` from `replaceVariables(` to `replaceWelcomeVariables(`.

- [ ] **Step 10: Run the test to verify it passes**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/systems test -- tests/unit/welcome/messageStyle.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 11: Typecheck and commit**

```bash
pnpm typecheck
git add packages/database/prisma packages/systems/src/welcome \
        packages/systems/tests/unit/welcome/messageStyle.test.ts
git commit -m "feat(welcome): add plain/embed message style and content columns

Two-step migration: columns are added defaulting to 'embed' so every existing
guild keeps its current output, then the default flips to 'plain' for rows
created afterwards. A single default cannot express this because
upsertWelcomeConfig creates rows with a bare spread and never sets these
fields explicitly."
```

---

## Task 8: Bot Plain Send Mode

**Files:**

- Create: `packages/systems/src/welcome/send.ts`
- Modify: `packages/systems/package.json` (one `exports` entry)
- Modify: `apps/bot/src/events/guildMemberAdd.ts:158-209`
- Modify: `apps/bot/src/events/guildMemberRemove.ts` (equivalent farewell block)
- Test: `packages/systems/tests/unit/welcome/send.test.ts`

**Interfaces:**

- Consumes: `MessageStyle` (Task 7); `replaceWelcomeVariables` (Task 7).
- Produces: `buildSendPayloads<TEmbed, TFile>(input): Array<SendPayload<TEmbed, TFile>>` from `@fluxcore/systems/welcome/send`.

**Why a shared module:** `guildMemberAdd` and `guildMemberRemove` would otherwise carry two copies of the same branch, and a test that re-implements the branch inside the test file proves nothing about the shipped code. Extracting the decision makes it directly testable and removes the duplication.

- [ ] **Step 1: Write the failing test**

Create `packages/systems/tests/unit/welcome/send.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSendPayloads } from "../../src/welcome/send.js";

const EMBED = { title: "Welcome" };

describe("plain message style", () => {
  it("sends content and files with no embeds key", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "Welcome <@1>!", embed: EMBED, files: ["img"], sendMode: "with",
    });
    expect(msgs).toEqual([{ content: "Welcome <@1>!", files: ["img"] }]);
    expect(msgs[0]).not.toHaveProperty("embeds");
  });

  it("sends the image alone when content is whitespace only", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "   ", embed: EMBED, files: ["img"], sendMode: "with",
    });
    expect(msgs).toEqual([{ files: ["img"] }]);
  });

  it("sends text alone when image generation produced nothing", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "Welcome!", embed: EMBED, files: [], sendMode: "with",
    });
    expect(msgs).toEqual([{ content: "Welcome!" }]);
  });

  it("sends nothing when both content and files are empty", () => {
    expect(buildSendPayloads({
      style: "plain", content: "", embed: EMBED, files: [], sendMode: "with",
    })).toEqual([]);
  });

  it("ignores sendMode entirely", () => {
    for (const sendMode of ["with", "before", "only"] as const) {
      const msgs = buildSendPayloads({
        style: "plain", content: "Hi", embed: EMBED, files: ["img"], sendMode,
      });
      expect(msgs, sendMode).toEqual([{ content: "Hi", files: ["img"] }]);
    }
  });

  it("truncates content to Discord's 2000-character limit", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "x".repeat(2500), embed: EMBED, files: [], sendMode: "with",
    });
    expect(msgs[0]!.content).toHaveLength(2000);
  });
});

describe("embed message style is unchanged", () => {
  it("sends embed and files together for sendMode=with", () => {
    expect(buildSendPayloads({
      style: "embed", content: "", embed: EMBED, files: ["img"], sendMode: "with",
    })).toEqual([{ embeds: [EMBED], files: ["img"] }]);
  });

  it("sends only the image for sendMode=only", () => {
    expect(buildSendPayloads({
      style: "embed", content: "", embed: EMBED, files: ["img"], sendMode: "only",
    })).toEqual([{ files: ["img"] }]);
  });

  it("sends image then embed for sendMode=before", () => {
    expect(buildSendPayloads({
      style: "embed", content: "", embed: EMBED, files: ["img"], sendMode: "before",
    })).toEqual([{ files: ["img"] }, { embeds: [EMBED] }]);
  });

  it("falls back to the embed alone when there is no image", () => {
    for (const sendMode of ["with", "before", "only"] as const) {
      expect(buildSendPayloads({
        style: "embed", content: "", embed: EMBED, files: [], sendMode,
      }), sendMode).toEqual([{ embeds: [EMBED], files: [] }]);
    }
  });

  it("ignores content in embed mode", () => {
    const msgs = buildSendPayloads({
      style: "embed", content: "ignored", embed: EMBED, files: [], sendMode: "with",
    });
    expect(msgs[0]).not.toHaveProperty("content");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/systems test -- tests/unit/welcome/send.test.ts
```

Expected: FAIL — `Cannot find module '../../src/welcome/send.js'`.

- [ ] **Step 3: Write `packages/systems/src/welcome/send.ts`**

Generic over the embed and file types so systems keeps no runtime dependency on discord.js.

```typescript
import type { MessageStyle } from "./types.js";

/** Discord's hard limit on message content length. */
const MAX_CONTENT_LENGTH = 2000;

export interface SendPayload<TEmbed, TFile> {
  content?: string;
  embeds?: TEmbed[];
  files?: TFile[];
}

export interface SendPayloadInput<TEmbed, TFile> {
  style: MessageStyle;
  /** Plain-mode message text, variables already substituted. */
  content: string;
  embed: TEmbed;
  files: TFile[];
  /** Embed-mode only. Ignored when style is "plain". */
  sendMode: "with" | "before" | "only";
}

/**
 * Decide what to post for a welcome/farewell event.
 *
 * Returns one payload per message to send, in order. An empty array means
 * there is nothing worth posting.
 *
 * Plain style posts the image as a native full-width attachment rather than
 * boxed inside an embed, so `sendMode` does not apply to it.
 */
export function buildSendPayloads<TEmbed, TFile>(
  input: SendPayloadInput<TEmbed, TFile>,
): Array<SendPayload<TEmbed, TFile>> {
  const { style, content, embed, files, sendMode } = input;

  if (style === "plain") {
    const payload: SendPayload<TEmbed, TFile> = {};
    const trimmed = content.slice(0, MAX_CONTENT_LENGTH);
    if (trimmed.trim()) payload.content = trimmed;
    if (files.length > 0) payload.files = files;
    return payload.content || payload.files ? [payload] : [];
  }

  if (files.length > 0 && sendMode === "only") return [{ files }];
  if (files.length > 0 && sendMode === "before") return [{ files }, { embeds: [embed] }];
  return [{ embeds: [embed], files }];
}
```

- [ ] **Step 4: Add the exports entry**

In `packages/systems/package.json`, after the `"./welcome/builder"` entry:

```json
    "./welcome/send": {
      "types": "./dist/welcome/send.d.ts",
      "import": "./dist/welcome/send.js"
    },
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/systems test -- tests/unit/welcome/send.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 6: Rewrite the welcome send block**

In `apps/bot/src/events/guildMemberAdd.ts`, update the builder import and add the new one:

```typescript
import { buildWelcomeEmbed, replaceWelcomeVariables } from "@fluxcore/systems/welcome/builder";
import { buildSendPayloads } from "@fluxcore/systems/welcome/send";
```

Then replace the whole `// Welcome channel message` block (lines 158-209) with:

```typescript
    // Welcome channel message
    if (welcomeConfig.welcomeEnabled && welcomeConfig.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(welcomeConfig.welcomeChannelId);
      if (channel?.isTextBased()) {
        const files: AttachmentBuilder[] = [];

        // Generate welcome image if enabled
        if (welcomeConfig.welcomeImageEnabled) {
          try {
            const storage = createStorageAdapter();
            const safeUsername = sanitizeDisplayName(member.user.username, 32);
            const safeDisplayName = sanitizeDisplayName(member.displayName, 80);
            const safeGuildName = sanitizeDisplayName(member.guild.name, 80);
            const imageBuffer = await generateWelcomeImage({
              settings: welcomeConfig.welcomeImageConfig,
              member: {
                username: safeUsername,
                displayName: safeDisplayName,
                avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 256 }),
              },
              guild: {
                name: safeGuildName,
                iconUrl: member.guild.iconURL({ size: 256 }) ?? undefined,
                memberCount: member.guild.memberCount,
              },
              storage,
            });
            files.push(new AttachmentBuilder(imageBuffer, { name: "welcome.png" }));
          } catch (err) {
            logger.error(
              `Failed to generate welcome image in guild ${member.guild.id}`,
              err instanceof Error ? err : new Error(String(err)),
            );
          }
        }

        const embed = buildWelcomeEmbed(welcomeConfig.welcomeMessage, member);
        if (files.length > 0 && welcomeConfig.welcomeMessageStyle === "embed") {
          embed.setImage("attachment://welcome.png");
        }

        const payloads = buildSendPayloads({
          style: welcomeConfig.welcomeMessageStyle,
          content: replaceWelcomeVariables(welcomeConfig.welcomeContent, member),
          embed,
          files,
          sendMode: welcomeConfig.welcomeImageConfig.sendMode ?? "with",
        });

        for (const payload of payloads) {
          await channel.send(payload).catch((err) =>
            logger.error(
              `Failed to send welcome message in guild ${member.guild.id}`,
              err instanceof Error ? err : new Error(String(err)),
            ),
          );
        }
      }
    }
```

- [ ] **Step 7: Apply the identical change to the farewell path**

In `apps/bot/src/events/guildMemberRemove.ts`, make the same transformation to the farewell send block, substituting throughout:

- `welcomeConfig.welcomeMessageStyle` → `welcomeConfig.farewellMessageStyle`
- `welcomeConfig.welcomeContent` → `welcomeConfig.farewellContent`
- `welcomeConfig.welcomeMessage` → `welcomeConfig.farewellMessage`
- `welcomeConfig.welcomeImageEnabled` → `welcomeConfig.farewellImageEnabled`
- `welcomeConfig.welcomeImageConfig` → `welcomeConfig.farewellImageConfig`
- `"welcome.png"` → `"farewell.png"` (and `attachment://farewell.png`)
- log message `welcome` → `farewell`

- [ ] **Step 8: Verify the variable substitution used by plain content**

Add to `packages/systems/tests/unit/welcome.test.ts`:

```typescript
describe("replaceWelcomeVariables", () => {
  it("resolves {user} to a real mention so plain-mode joins ping", async () => {
    const { replaceWelcomeVariables } = await import("../src/welcome/builder.js");
    const member = {
      id: "42",
      user: { tag: "ahmed#0", username: "ahmed", displayAvatarURL: () => "" },
      guild: { name: "FluxCore", id: "9", memberCount: 7, iconURL: () => null },
    };
    expect(replaceWelcomeVariables("Welcome {user} to {server}!", member as never)).toBe(
      "Welcome <@42> to FluxCore!",
    );
  });
});
```

- [ ] **Step 9: Run the bot and systems suites for regressions**

```bash
docker compose --profile bot run --rm bot pnpm --filter @fluxcore/bot test
docker compose --profile bot run --rm bot pnpm --filter @fluxcore/systems test
```

Expected: PASS. `tests/events/welcome-sanitize.test.ts` must still pass.

- [ ] **Step 10: Typecheck and commit**

```bash
pnpm typecheck
git add packages/systems/src/welcome/send.ts packages/systems/package.json \
        packages/systems/tests/unit/welcome apps/bot/src/events
git commit -m "feat(bot): send welcome and farewell images as plain attachments

In plain mode the image posts natively at full width instead of boxed inside
an embed, with optional message text that supports {user} mentions. Embed mode
and its sendMode variants are untouched for guilds that still use them."
```

---

## Task 9: Dashboard API, UI, and i18n

**Files:**

- Modify: `apps/dashboard/src/server/features/welcome/routes.ts:59-142`
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/welcome.tsx`
- Modify: `apps/dashboard/src/locales/<lang>/welcome.json` — **all 48 locales**
- Test: `apps/dashboard/tests/server/features/welcome/messageStyle.test.ts`

**Interfaces:**

- Consumes: `MessageStyle`, `WelcomeConfig` fields (Task 7).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/features/welcome/messageStyle.test.ts`. It must exercise the **real** `registerWelcomeRoutes`, so copy the mock preamble from the sibling `welcome.test.ts` verbatim (lines 1-99: `@fluxcore/config`, `session.js`, `discordApi.js`, `permissions.js`, `@fluxcore/systems/welcome/config`, `@fluxcore/systems/welcome/image`) and add the assertions below. A test that re-implements the route inside the test file proves nothing about what ships.

```typescript
// ... identical mock preamble to welcome.test.ts (lines 1-99) ...

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerWelcomeRoutes } from "../../../../src/server/features/welcome/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerWelcomeRoutes(app);
  await app.ready();
  return app;
}

const AUTH = { cookie: "session=test-session" };

describe("PUT /api/guilds/:guildId/welcome — message style", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    mockUpsertWelcomeConfig.mockClear();
    app = await buildApp();
  });

  it("accepts plain and persists it", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/welcome",
      headers: AUTH,
      payload: { welcomeMessageStyle: "plain", welcomeContent: "Welcome {user}!" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockUpsertWelcomeConfig).toHaveBeenCalledWith(
      "guild-1",
      expect.objectContaining({
        welcomeMessageStyle: "plain",
        welcomeContent: "Welcome {user}!",
      }),
    );
  });

  it("accepts the farewell equivalents", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/welcome",
      headers: AUTH,
      payload: { farewellMessageStyle: "embed", farewellContent: "Bye {user.name}" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockUpsertWelcomeConfig).toHaveBeenCalledWith(
      "guild-1",
      expect.objectContaining({
        farewellMessageStyle: "embed",
        farewellContent: "Bye {user.name}",
      }),
    );
  });

  it("rejects an unknown style with 400 and never writes", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/welcome",
      headers: AUTH,
      payload: { welcomeMessageStyle: "carrier-pigeon" },
    });

    expect(res.statusCode).toBe(400);
    expect(mockUpsertWelcomeConfig).not.toHaveBeenCalled();
  });

  it("rejects content over Discord's 2000-character limit", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/welcome",
      headers: AUTH,
      payload: { welcomeContent: "x".repeat(2001) },
    });

    expect(res.statusCode).toBe(400);
    expect(mockUpsertWelcomeConfig).not.toHaveBeenCalled();
  });

  it("accepts content at exactly 2000 characters", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/welcome",
      headers: AUTH,
      payload: { welcomeContent: "x".repeat(2000) },
    });

    expect(res.statusCode).toBe(200);
  });

  it("rejects an unauthenticated request with 401", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await app.inject({
      method: "PUT",
      url: "/api/guilds/guild-1/welcome",
      payload: { welcomeMessageStyle: "plain" },
    });

    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/dashboard test -- tests/server/features/welcome/messageStyle.test.ts
```

Expected: FAIL — the PUT body schema has `additionalProperties: false`, so `welcomeMessageStyle` is currently stripped or rejected and `mockUpsertWelcomeConfig` is never called with it.

- [ ] **Step 3: Accept and validate the new fields on the real route**

In `apps/dashboard/src/server/features/welcome/routes.ts`, add to the PUT body schema properties (after `welcomeMessage`):

```typescript
              welcomeMessageStyle: { type: "string", enum: ["plain", "embed"] },
              welcomeContent: { type: "string", maxLength: 2000 },
```

and after `farewellMessage`:

```typescript
              farewellMessageStyle: { type: "string", enum: ["plain", "embed"] },
              farewellContent: { type: "string", maxLength: 2000 },
```

Add the same four entries to the 200 response schema properties.

In the handler, after the `welcomeMessage` assignment:

```typescript
      if (body.welcomeMessageStyle !== undefined) update.welcomeMessageStyle = body.welcomeMessageStyle;
      if (body.welcomeContent !== undefined) update.welcomeContent = body.welcomeContent;
```

and after the `farewellMessage` assignment:

```typescript
      if (body.farewellMessageStyle !== undefined) update.farewellMessageStyle = body.farewellMessageStyle;
      if (body.farewellContent !== undefined) update.farewellContent = body.farewellContent;
```

Fastify's JSON-schema validation rejects a bad `enum` value or over-long string with 400 before the handler runs, so no manual checks are needed.

- [ ] **Step 4: Add the UI control**

In `apps/dashboard/src/client/routes/guild/$guildId/welcome.tsx`, add a message-style selector above the existing embed editor for both the welcome and farewell sections. Use the existing shadcn `Select` and the existing `VariableEditor` primitive — do not build a new textarea.

```tsx
<div className="space-y-2">
  <Label htmlFor="welcome-message-style">{t("messageStyle.label")}</Label>
  <Select
    value={config.welcomeMessageStyle}
    onValueChange={(v) => update({ welcomeMessageStyle: v as MessageStyle })}
  >
    <SelectTrigger id="welcome-message-style">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="plain">{t("messageStyle.plain")}</SelectItem>
      <SelectItem value="embed">{t("messageStyle.embed")}</SelectItem>
    </SelectContent>
  </Select>
  <p className="text-sm text-muted-foreground">
    {config.welcomeMessageStyle === "plain"
      ? t("messageStyle.plainHint")
      : t("messageStyle.embedHint")}
  </p>
</div>

{config.welcomeMessageStyle === "plain" ? (
  <div className="space-y-2">
    <Label htmlFor="welcome-content">{t("messageStyle.contentLabel")}</Label>
    <VariableEditor
      id="welcome-content"
      value={config.welcomeContent}
      onChange={(v) => update({ welcomeContent: v })}
      maxLength={2000}
      placeholder={t("messageStyle.contentPlaceholder")}
    />
  </div>
) : (
  /* existing embed editor stays here unchanged */
  null
)}
```

- [ ] **Step 5: Add the i18n keys to all 48 locales**

Add this block to the `welcome` namespace of **every** file in `apps/dashboard/src/locales/*/welcome.json`. English source:

```json
"messageStyle": {
  "label": "Message style",
  "plain": "Plain message",
  "embed": "Embed",
  "plainHint": "The image is posted at full width with optional text above it.",
  "embedHint": "The image is shown inside an embed box.",
  "contentLabel": "Message text",
  "contentPlaceholder": "Welcome {user} to {server}!"
}
```

Translate all seven strings properly for each of the 48 locales — English placeholders will block the merge. Leave `{user}` and `{server}` untranslated in every locale; they are variable tokens, not words. Edit `src/locales`, never `dist/locales`.

Verify key parity across every locale before committing:

```bash
node -e '
const fs=require("fs"),path=require("path");
const base=path.join("apps/dashboard/src/locales");
const en=JSON.parse(fs.readFileSync(path.join(base,"en","welcome.json"),"utf8"));
const want=Object.keys(en.messageStyle??{});
let bad=0;
for(const l of fs.readdirSync(base)){
  const f=path.join(base,l,"welcome.json");
  if(!fs.existsSync(f))continue;
  const j=JSON.parse(fs.readFileSync(f,"utf8"));
  const got=Object.keys(j.messageStyle??{});
  const missing=want.filter(k=>!got.includes(k));
  if(missing.length){console.log(l,"missing:",missing.join(","));bad++;}
}
console.log(bad?`FAIL ${bad} locales`:"OK all locales have messageStyle");
'
```

Expected: `OK all locales have messageStyle`.

- [ ] **Step 6: Run the dashboard suite**

```bash
docker compose --profile bot run --rm bot pnpm --filter @fluxcore/dashboard test
```

Expected: PASS.

- [ ] **Step 7: Full verification**

```bash
pnpm typecheck
pnpm test
```

Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/server/features/welcome/routes.ts \
        apps/dashboard/src/client/routes/guild/\$guildId/welcome.tsx \
        apps/dashboard/src/locales \
        apps/dashboard/tests/server/features/welcome/messageStyle.test.ts
git commit -m "feat(dashboard): expose the plain/embed message style setting

Adds a style selector and a variable-aware content field for welcome and
farewell, validated at the route with Fastify's JSON schema. Keys translated
across all 48 locales."
```

---

## Manual Verification

After Task 9, confirm the two reported bugs are actually gone.

- [ ] **Arabic renders in the real container, not just on the host**

The dev host has system fonts and `@napi-rs/canvas` auto-loads them, so Arabic renders correctly locally whether or not this work succeeded. Only a container check is meaningful:

```bash
docker compose --profile bot run --rm --no-deps bot node -e '
import("@fluxcore/systems/welcome/image").then(async (m) => {
  const buf = await m.generateWelcomeImage({
    settings: m.DEFAULT_WELCOME_IMAGE_SETTINGS,
    member: { username: "ahmed", displayName: "مرحبا بك 🎉",
              avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png" },
    guild: { name: "سيرفر", memberCount: 1234 },
  });
  require("fs").writeFileSync("/tmp/ar.png", buf);
  console.log("wrote", buf.length, "bytes");
});
'
docker compose --profile bot run --rm --no-deps -v "$PWD/out:/out" bot \
  sh -c 'cp /tmp/ar.png /out/ 2>/dev/null || true'
```

Open the PNG. Arabic must appear as joined script and the emoji in color — **not** as boxes with hex digits inside.

- [ ] **Client and server previews agree**

Run `pnpm dev:dashboard`, open a guild's Welcome page, set the title font to Playfair Display and a display name containing Arabic. Toggle the preview between "client" and "server". The glyphs, line breaks, and truncation point must match. Repeat for Orbitron (which pairs with a different Arabic face) to confirm the pairing is wired.

- [ ] **First render uses the right font**

Hard-reload the Welcome page with an empty cache (DevTools → Network → Disable cache). The very first preview must already be in the selected font, not a system fallback.

- [ ] **Plain mode posts a full-width image**

Trigger a join in a test guild with `welcomeMessageStyle = "plain"`. The image must render at full width with the text above it, with no embed border.

---

## Self-Review Notes

Checked against the spec:

- Root cause (no container fonts) → Task 1.
- Client/server font divergence → Tasks 1, 4, 5.
- Template duplication → Task 5 (deletion + guard test).
- Bidi/truncation → Task 2.
- Embed-boxed images → Tasks 7, 8, 9.
- PR #51 carry-overs: `hexToRgba` → Task 2; `toBlob` → Task 5; RAF race → Task 6.
- Spec non-goals (CJK/Cyrillic/Hebrew, text-presentation emoji, pixel-identical AA, `/data/uploads` volume) are intentionally absent from every task.

Issues found during review and fixed inline:

- `drawCard` was listed with a `template` parameter in Task 3's interface block but implemented with five parameters. The interface block now states the real signature explicitly.
- Tasks 6, 8, and 9 each originally tested a copy of the logic written inside the test file, which would have proved nothing about shipped code. Task 8's branch is now a real shared module (`welcome/send.ts`, also removing the duplication between the join and leave handlers), Task 6's guard is a real hook (`useLatestOnly`), and Task 9 now drives the actual `registerWelcomeRoutes`.
- Task 3's render test used a live Discord CDN avatar URL, violating the no-network rule for unit tests; replaced with a data URI.
- The single-file test commands bypass turbo's `^build`, so cross-package imports would silently resolve to a stale `packages/systems/dist`. Documented in Global Constraints along with the `tsbuildinfo` trap.
- `__dirname` is undefined in ESM test files; Task 5's test now uses `import.meta.dirname`.
