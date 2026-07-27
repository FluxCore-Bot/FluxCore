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
