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
