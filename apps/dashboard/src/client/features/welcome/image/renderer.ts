import { drawCard } from "@fluxcore/systems/welcome/image/core/draw";
import { replaceImageVariables } from "@fluxcore/systems/welcome/image/core/text";
import { sanitizeDisplayName } from "@fluxcore/systems/welcome/image/sanitize";
import { getTemplate } from "@fluxcore/systems/welcome/image/templates";
import type { RenderBackend } from "@fluxcore/systems/welcome/image/core/types";
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
  const { settings, guild } = input;
  // Match the bot's deliverWelcomeMessage: sanitize before rendering so the
  // preview can't diverge from production on a hostile/malformed name (this
  // is the sole call site for browser preview rendering, so fixing it here
  // covers every caller rather than requiring each one to remember).
  const member = {
    ...input.member,
    username: sanitizeDisplayName(input.member.username, 32),
    displayName: sanitizeDisplayName(input.member.displayName, 80),
  };
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

  await drawCard(ctx, settings, member, guild, browserBackend);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null (tainted canvas?)"))),
      "image/png",
    );
  });

  return { blob, url: URL.createObjectURL(blob) };
}
