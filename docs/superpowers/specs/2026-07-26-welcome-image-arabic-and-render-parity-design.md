# Welcome/Farewell Images: Arabic Rendering, Client/Server Parity, Plain Send Mode

**Date:** 2026-07-26
**Branch:** `worktree-fix-welcome-image-arabic-and-font-parity`
**Status:** Approved

## Problem

Three user-reported problems, two of which share a single root cause.

### 1. Arabic renders as boxes

Arabic text in welcome/farewell images renders as hex-codepoint tofu boxes.

**Root cause (verified, not inferred):** `node:22-alpine` has no `/usr/share/fonts` directory at
all. Confirmed by running `ls /usr/share/fonts` inside both `node:22-alpine` and the built
`fluxcore-bot:latest` image — the path does not exist, and the Dockerfile only installs
`libc6-compat`. The only glyphs Skia can reach are the eight TTFs registered by
`registerFonts()`, all of which are Latin-only. Every non-Latin script and every emoji is
therefore unrenderable in production.

A probe rendering `مرحبا بك في السيرفر` through `Inter-SemiBold.ttf` produced boxes containing
hex codepoints, exactly matching the reported symptom.

### 2. Fonts differ between client preview and server output

This is the **same bug wearing a different hat**. The browser silently falls back to an OS
Arabic font, so the preview looks correct while the bot posts boxes. Four additional drift
sources compound it:

| | Client | Server |
|---|---|---|
| Font source | Google Fonts CDN (variable axis, latest release) | Pinned static TTFs on disk |
| Family names | `"Space Grotesk"`, `"Playfair Display"`, `"Bebas Neue"` | `SpaceGrotesk`, `PlayfairDisplay`, `BebasNeue` |
| `ctx.font` | `36px "Inter", sans-serif` — fallback chain, no weight | `36px Inter` — no fallback, no weight |
| Templates | `client/features/welcome/image/templates.ts` (137 lines) | `systems/welcome/image/templates/` (297 lines) |

The template duplication was flagged during the PR #51 review and merged unfixed: the two copies
matched at review time with nothing enforcing it, so any server template edit silently makes the
preview lie.

Separately, `loadPreviewFonts()` appends `<link>` elements and waits on `document.fonts.ready`.
That does not force the font file to download — with `display=swap` the browser fetches lazily on
first use — so the *first* client preview renders in the system fallback regardless of script.

### 3. Bidi and truncation are broken independently of fonts

`drawText` truncates with `displayText.slice(0, -1)` and appends `"..."`:

- `slice(0, -1)` operates on UTF-16 code units, so it splits surrogate pairs, ZWJ emoji
  sequences, and Arabic combining marks (harakat).
- Appending an ellipsis to RTL text under `direction="ltr"` places it on the visually wrong side.
  Measured: for Arabic, ellipsis ink landed at avg x=201 with text centre at x=197 (right side —
  wrong); under `direction="rtl"` it landed at x=170 (left side — correct). Latin was unaffected
  in both cases.

### 4. Images are boxed inside embeds

Welcome/farewell images are attached to an embed via `embed.setImage("attachment://welcome.png")`,
which renders them narrower and visually boxed rather than as a native full-width image.

## Verified Constraints

Everything below was measured against `@napi-rs/canvas@0.1.97` on this repo, not assumed.

- **Comma-separated font fallback in `ctx.font` works.** Per-codepoint family selection is
  correct. This is mandatory, not optional: an Arabic-only font makes *Latin* text tofu, so mixed
  Arabic/Latin strings require a chain.
- **Arabic shaping works** — contextual joining forms render correctly once glyphs are present.
  Shaping was never the problem.
- **Color emoji works.** `NotoColorEmoji.ttf` (CBDT, 10 MB) and `Noto-COLRv1.ttf` (4.8 MB) both
  register and render in full color, visually identical. COLRv1 is half the size, vector, and
  natively supported by browsers, so the same file serves both sides.
- **`ctx.direction` fixes the ellipsis side**, as measured above.
- **`Intl.Segmenter` is available in the bot container** (`full-icu` confirmed), so grapheme-safe
  truncation is usable server-side.
- **`@fastify/static` is already a dependency** and already registered for `/uploads`.

## Design

### 1. Shared render core

One drawing implementation in `@fluxcore/systems`, driven by both canvas backends through a
structural `Ctx2D` interface. `SKRSContext2D` and `CanvasRenderingContext2D` already satisfy it
for the subset used; image loading is the only genuine difference and is injected.

```text
packages/systems/src/welcome/image/
  core/
    types.ts        Ctx2D, ImageLike, LoadImage, GradientLike
    draw.ts         background, overlay, decorations, avatar, text  (ONE copy)
    text.ts         font chain, base direction, grapheme-safe fit
  fonts/
    manifest.ts     ONE font list: file, family, weight, category, arabic pair
    index.ts        server registration, driven by manifest
    files/          8 Latin + 4 Arabic + 1 emoji + OFL licences
  templates/        ONE template source
  renderer.ts       server entry: napi canvas -> core/draw

apps/dashboard/src/client/features/welcome/image/
  renderer.ts       client entry: DOM canvas -> core/draw
  fonts.ts          FontFace loader against /fonts/welcome/
  templates.ts      DELETED — imports from @fluxcore/systems
```

`Ctx2D` covers exactly what the renderer uses: `fillStyle`, `strokeStyle`, `lineWidth`,
`lineCap`, `font`, `textAlign`, `textBaseline`, `direction`, `fillRect`, `strokeRect`,
`beginPath`, `arc`, `rect`, `roundRect`, `clip`, `save`, `restore`, `moveTo`, `lineTo`, `stroke`,
`fill`, `createLinearGradient`, `createRadialGradient`, `measureText`, `fillText`, `drawImage`.

Deleting the client `templates.ts` closes the drift risk structurally — there is no second copy
to fall out of sync.

### 2. Font system

A single manifest is the source of truth for server registration *and* client `FontFace` loading,
with one canonical family string per font used identically on both sides.

```ts
export interface LatinFont {
  name: string;        // stable id stored in DB config, e.g. "PlayfairDisplay"
  displayName: string; // dashboard label
  category: FontCategory;
  family: string;      // canonical ctx.font family — SAME on client and server
  file: string;
  weight: number;
  arabic: ArabicFontKey;
}
```

Pairings, chosen so each Latin face keeps its character in Arabic:

| Latin font | Category | Arabic companion |
|---|---|---|
| Inter, Outfit, SpaceGrotesk, JetBrainsMono | sans / mono | Noto Sans Arabic |
| Poppins | rounded | Tajawal |
| PlayfairDisplay | serif | Amiri |
| Orbitron, BebasNeue | display | Noto Kufi Arabic |

All are OFL-licensed; licence files are vendored alongside them. Total added weight is roughly
6 MB, dominated by the 4.8 MB emoji font; the four Arabic faces are ~200-400 KB each.

The dashboard serves the **exact bytes the bot renders with** via `@fastify/static` at
`/fonts/welcome/`, with `Cache-Control: public, max-age=31536000, immutable`. The client loads
them with the `FontFace` API:

```ts
const face = new FontFace(family, `url(/fonts/welcome/${file})`, { weight: String(weight) });
await face.load();
document.fonts.add(face);
```

Google Fonts is removed from the preview path entirely. Because `FontFace.load()` resolves only
once the bytes are parsed, this also fixes the "first preview renders in fallback font" bug as a
side effect. Only the fonts the current settings need are loaded (title font, subtitle font, and
their Arabic pairs). The emoji font is loaded lazily, only when the text to be rendered actually
matches `\p{Extended_Pictographic}`.

Serving requires a `getFontsDir()` export from systems so the dashboard can resolve the directory
at runtime under both `tsx` (src) and `dist` layouts — the existing resolution logic in
`fonts/index.ts` is extracted and reused rather than duplicated.

### 3. Text pipeline

`core/text.ts` exposes three functions used identically by both renderers:

- **`buildFontSpec(fontName, sizePx)`** →
  `700 40px "Orbitron", "NotoKufiArabic", "NotoColorEmoji"`.
  Weight is included so both engines resolve the same face.
- **`baseDirection(text)`** → `"rtl" | "ltr"`, from the first strong character per UBA P2/P3.
- **`fitText(ctx, text, maxWidth)`** → walks `Intl.Segmenter` graphemes with a binary search and
  appends `…` (U+2026, one character) instead of three periods.

`drawText` sets `ctx.direction = baseDirection(text)` **before both `measureText` and `fillText`**
— measurement must happen under the same direction as drawing or truncation width is wrong.

**Alignment stays visual.** A template with `align: "left"` keeps drawing at the left for Arabic.
The six templates position text against decorations (corner accents, gradient bars, avatar
offsets) laid out visually; auto-flipping would push Arabic text out from under its own
decoration. The accepted trade-off is that an Arabic-first server using Horizon or Elegant gets
text hugging the edge opposite to reading-order convention.

### 4. Plain (non-embed) send mode

`WelcomeConfig` gains, for welcome and farewell independently:

```prisma
welcomeMessageStyle   String @default("plain")  // "plain" | "embed"
welcomeContent        String @default("")
farewellMessageStyle  String @default("plain")
farewellContent       String @default("")
```

Send logic:

- `style === "plain"` → `channel.send({ content, files })`. No embed; the image renders
  full-width and native. `{user}` already resolves to `<@id>` in `WELCOME_VARIABLES`, so pings
  work. If `content` is empty, the image is sent alone.
- `style === "embed"` → the current path, unchanged.
- `sendMode` (`"with" | "before" | "only"`) applies to embed style only.

**Defaults.** There is no application-level default config object — `upsertWelcomeConfig` creates
rows with `create: { guildId, ...dbData }`, so whatever the column default is applies to new
guilds too. Getting "existing stay embed, new get plain" therefore has to happen in the migration,
in two steps:

```sql
-- 1. Add with default 'embed' — every existing row is backfilled to today's behaviour.
ALTER TABLE "WelcomeConfig"
  ADD COLUMN "welcomeMessageStyle" TEXT NOT NULL DEFAULT 'embed';
-- 2. Flip the default so rows created from now on get plain.
ALTER TABLE "WelcomeConfig"
  ALTER COLUMN "welcomeMessageStyle" SET DEFAULT 'plain';
```

Repeated for `farewellMessageStyle`. The Prisma schema declares `@default("plain")`, matching the
post-migration state. `rowToConfig`, `upsertWelcomeConfig`, and the `WelcomeConfig` type each gain
passthroughs for the four new columns.

DM messages (`dmMessage`) are deliberately out of scope and stay embed-only.

Dashboard gains a Message Style toggle and a content field reusing the existing `VariableEditor`
primitive, with new i18n keys translated across all 48 locales up front.

### 5. In-scope bug fixes

Rewriting these files makes three unfixed PR #51 findings unavoidable to touch. Each gets its own
commit:

- **RAF render race** in `WelcomeImageEditor.tsx` — no generation guard, so an out-of-order older
  render revokes the live blob URL and shows a stale image.
- **`toBlob` force-unwrap** — `resolve(b!)` makes a tainted canvas (cross-origin avatar) throw and
  kill the whole preview instead of degrading.
- **`hexToRgba` assumes `#rrggbb`** — produces `NaN` channels for `#abc` or named colors.

## Testing

Per the mandatory-tests rule in `CLAUDE.md`.

**Unit — `core/text.ts`** (`packages/systems/tests/unit/welcome/image/text.test.ts`)
- `baseDirection`: Arabic-first → `rtl`; Latin-first → `ltr`; digits/punctuation-first falls
  through to the first strong character; empty string → `ltr`.
- `fitText`: never splits a surrogate pair, a ZWJ emoji sequence, or an Arabic combining mark;
  returns input unchanged when it fits; appends exactly one `…`.
- `buildFontSpec`: emits weight, canonical Latin family, correct Arabic pair, emoji family last.

**Unit — font manifest** (`.../fonts.test.ts`)
- Every declared `file` exists on disk.
- Every Latin font's `arabic` key resolves to a declared Arabic font.
- After `registerFonts()`, every manifest family appears in `GlobalFonts.families`.

**Unit — anti-tofu regression** (`.../arabic-render.test.ts`)
- Arabic measured through the full chain differs in width from the same text measured through a
  chain with the Arabic font omitted. This fails loudly if the Arabic fonts ever stop shipping —
  which is precisely the production bug being fixed.

**Unit — bot send path** (`apps/bot/tests/events/`)

- `welcomeMessageStyle: "plain"` sends `{ content, files }` with no `embeds` key.
- `welcomeMessageStyle: "embed"` reproduces current behaviour for all three `sendMode` values.
- Empty plain `welcomeContent` sends files only.
- The same three cases for `farewellMessageStyle` on `guildMemberRemove`.

**Unit — dashboard routes** (`apps/dashboard/tests/server/features/welcome/`)
- Zod rejects an unknown `messageStyle` with 400.
- `content` over Discord's 2000-character limit is rejected with 400.
- Unauthenticated → 401; non-admin → 403.

**Unit — client renderer** (jsdom)
- Templates are imported from `@fluxcore/systems`, and no local `templates.ts` exists.
- The font loader requests `/fonts/welcome/*` and never `fonts.googleapis.com`.

## Non-Goals

- **Cyrillic, CJK, and Hebrew coverage.** Chosen scope is Arabic + emoji; full coverage would add
  roughly 30 MB to the image. These still render as boxes.
- **Text-presentation emoji** (`❤`, `☺`, `✂` without U+FE0F) render monochrome, because the Latin
  font claims those codepoints earlier in the chain. Fixing it requires segmenting runs by
  emoji-presentation; deliberately deferred.
- **Pixel-identical antialiasing.** Glyph selection, metrics, layout, and truncation will match
  exactly between client and server because both use the same font bytes and the same code.
  Skia and browser rasterizers may still differ by a pixel of antialiasing.
- **The `/data/uploads` volume gap.** Uploaded backgrounds are still ephemeral and still
  unreachable from the bot container. Tracked separately; unrelated to font parity.

## Risks

| Risk | Mitigation |
|---|---|
| Docker image grows ~6 MB | Accepted; emoji font is COLRv1 (4.8 MB) rather than CBDT (10 MB) |
| Client downloads 4.8 MB emoji font | Lazy — only when rendered text contains emoji; `immutable` cached |
| `Ctx2D` shim drifts from either real API | Structural interface; both renderers compile against it, so a mismatch is a type error |
| Systems build must copy new font files | Existing `cp -r src/welcome/image/fonts/files dist/...` already globs the directory; covered by the manifest file-existence test |
