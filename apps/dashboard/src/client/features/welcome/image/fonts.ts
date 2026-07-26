import {
  ARABIC_FONTS,
  EMOJI_FONT,
  getLatinFont,
} from "@fluxcore/systems/welcome/image/fonts/manifest";

const FONT_BASE = "/fonts/welcome";

/** Faces already loaded (or in flight), keyed by family+weight. */
const inFlight = new Map<string, Promise<void>>();

/**
 * Extended_Pictographic alone misses two whole emoji classes that don't carry
 * that Unicode property: regional-indicator flag pairs (e.g. "🇸🇦", each half
 * is \p{Regional_Indicator}, U+1F1E6-U+1F1FF) and keycap sequences (e.g.
 * "1️⃣", "#️⃣" — digit/hash + optional VS16 + U+20E3 COMBINING ENCLOSING
 * KEYCAP). Both need NotoColorEmoji just as much as "🎉" does, and missing
 * them means a flag in a welcome line renders correctly in the bot's PNG
 * (which registers the emoji font unconditionally) but as tofu in this
 * preview — exactly the client/server drift this plan exists to remove.
 */
const HAS_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;

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
