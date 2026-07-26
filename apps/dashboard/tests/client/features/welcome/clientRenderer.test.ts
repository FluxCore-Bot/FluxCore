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
    // fonts.ts keeps a module-scope `inFlight` cache keyed by family+weight.
    // Vitest does not reset the module registry between tests in a file, so
    // without this, the SECOND test to request "Inter"/"NotoSansArabic"
    // would hit the cache populated by an earlier test, `loadFace` would
    // early-return, and the freshly-stubbed `FontFace` below would never be
    // constructed — silently turning later assertions vacuous (an empty
    // array satisfies `.every(...)` and `.not.toContain(...)` alike).
    vi.resetModules();
    vi.stubGlobal(
      "FontFace",
      class {
        constructor(public family: string, public source: string, public desc: unknown) {}
        load() { return Promise.resolve(this); }
      },
    );
    vi.stubGlobal(
      "document",
      {
        fonts: { add: (f: { family: string }) => added.push(f.family) },
      },
    );
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

  it("loads the emoji font for a regional-indicator flag", async () => {
    const { ensureFontsFor } = await import(
      "../../../../src/client/features/welcome/image/fonts"
    );
    // Flags are a pair of Regional_Indicator codepoints, not
    // Extended_Pictographic — this is the class the old pattern missed.
    await ensureFontsFor(["Inter"], "أهلاً 🇸🇦");
    expect(added).toContain("NotoColorEmoji");
  });

  it("loads the emoji font for a keycap sequence", async () => {
    const { ensureFontsFor } = await import(
      "../../../../src/client/features/welcome/image/fonts"
    );
    // Keycaps (digit/hash + optional VS16 + U+20E3) are also not
    // Extended_Pictographic on their own.
    await ensureFontsFor(["Inter"], "Rank 1️⃣");
    expect(added).toContain("NotoColorEmoji");
  });

  it("skips the emoji font for plain text that merely looks keycap-ish", async () => {
    const { ensureFontsFor } = await import(
      "../../../../src/client/features/welcome/image/fonts"
    );
    // A bare "#1" has no U+20E3 (COMBINING ENCLOSING KEYCAP) and no
    // Regional_Indicator codepoint — it must not trigger the 4.8MB font.
    await ensureFontsFor(["Inter"], "Rank #1 in the server");
    expect(added).not.toContain("NotoColorEmoji");
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
    // Guards against the assertion below passing vacuously on an empty
    // array (which is exactly how this test shipped broken — see the
    // vi.resetModules() comment in beforeEach for the full story).
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((s) => s.startsWith("url(/fonts/welcome/"))).toBe(true);
  });
});
