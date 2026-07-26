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
