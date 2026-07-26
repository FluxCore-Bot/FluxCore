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
