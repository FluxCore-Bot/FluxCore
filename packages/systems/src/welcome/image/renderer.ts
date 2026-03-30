import { createCanvas, loadImage, type SKRSContext2D, type Canvas } from "@napi-rs/canvas";
import { registerFonts, getFontFamily } from "./fonts/index.js";
import { getTemplate } from "./templates/index.js";
import { PRESET_GRADIENTS, type PresetBackground } from "./constants.js";
import type {
  RenderInput,
  TemplateLayout,
  TemplateDecoration,
  WelcomeImageSettings,
  StorageAdapter,
} from "./types.js";

// ── Variable Replacement ──

function replaceImageVariables(
  text: string,
  member: RenderInput["member"],
  guild: RenderInput["guild"],
): string {
  return text
    .replaceAll("{user}", member.username)
    .replaceAll("{user.name}", member.username)
    .replaceAll("{user.displayname}", member.displayName)
    .replaceAll("{server}", guild.name)
    .replaceAll("{membercount}", guild.memberCount.toLocaleString());
}

// ── Color Utilities ──

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveColor(colorSource: string, settings: WelcomeImageSettings): string {
  if (colorSource === "accent") return settings.accentColor;
  if (colorSource === "title") return settings.title.color;
  if (colorSource === "subtitle") return settings.subtitle.color;
  return colorSource;
}

// ── Background Rendering ──

async function drawBackground(
  ctx: SKRSContext2D,
  canvas: Canvas,
  settings: WelcomeImageSettings,
  storage?: StorageAdapter,
): Promise<void> {
  const { background } = settings;
  const { width, height } = canvas;

  if (background.type === "image" && background.imageKey && storage) {
    try {
      const buffer = await storage.get(background.imageKey);
      const img = await loadImage(buffer);
      // Cover-fit the image to canvas
      const scale = Math.max(width / img.width, height / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (width - drawWidth) / 2;
      const offsetY = (height - drawHeight) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      return;
    } catch {
      // Fall through to color fallback
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

  // Solid color fallback
  ctx.fillStyle = background.color;
  ctx.fillRect(0, 0, width, height);
}

// ── Overlay ──

function drawOverlay(
  ctx: SKRSContext2D,
  canvas: Canvas,
  settings: WelcomeImageSettings,
): void {
  if (!settings.overlay.enabled) return;
  ctx.fillStyle = hexToRgba(settings.overlay.color, settings.overlay.opacity);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ── Avatar ──

async function drawAvatar(
  ctx: SKRSContext2D,
  layout: TemplateLayout,
  settings: WelcomeImageSettings,
  avatarUrl: string,
): Promise<void> {
  const { x, y, size } = layout.avatar;
  const { avatar } = settings;
  const radius = size / 2;

  // Glow effect behind avatar
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

  // Border
  if (avatar.borderWidth > 0) {
    ctx.beginPath();
    drawAvatarShape(ctx, x, y, radius + avatar.borderWidth, avatar.shape);
    ctx.fillStyle = avatar.borderColor;
    ctx.fill();
  }

  // Clip and draw avatar image
  ctx.save();
  ctx.beginPath();
  drawAvatarShape(ctx, x, y, radius, avatar.shape);
  ctx.clip();

  try {
    const img = await loadImage(avatarUrl);
    ctx.drawImage(img, x - radius, y - radius, size, size);
  } catch {
    // Fallback: draw a gray circle if avatar can't be loaded
    ctx.fillStyle = "#374151";
    ctx.fill();
  }

  ctx.restore();
}

function drawAvatarShape(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  radius: number,
  shape: "circle" | "rounded" | "square",
): void {
  if (shape === "circle") {
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  } else if (shape === "rounded") {
    const r = radius * 0.3; // corner radius
    ctx.roundRect(x - radius, y - radius, radius * 2, radius * 2, r);
  } else {
    ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
  }
}

// ── Text Rendering ──

function drawText(
  ctx: SKRSContext2D,
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
  const family = getFontFamily(options.font);
  ctx.font = `${options.size}px ${family}`;
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align;
  ctx.textBaseline = "middle";

  // Truncate text if too wide
  let displayText = text;
  const measured = ctx.measureText(displayText);
  if (measured.width > options.maxWidth && displayText.length > 3) {
    while (ctx.measureText(displayText + "...").width > options.maxWidth && displayText.length > 1) {
      displayText = displayText.slice(0, -1);
    }
    displayText += "...";
  }

  ctx.fillText(displayText, x, y, options.maxWidth);
}

// ── Decorations ──

function drawDecorations(
  ctx: SKRSContext2D,
  canvas: Canvas,
  decorations: TemplateDecoration[],
  settings: WelcomeImageSettings,
): void {
  for (const dec of decorations) {
    const color = resolveColor(dec.props.colorSource as string, settings);
    const opacity = (dec.props.opacity as number) ?? 1;

    switch (dec.type) {
      case "line":
        drawLine(ctx, dec.props, color, opacity);
        break;
      case "border":
        drawBorder(ctx, canvas, dec.props, color, opacity);
        break;
      case "corner-accents":
        drawCornerAccents(ctx, canvas, dec.props, color, opacity);
        break;
      case "gradient-bar":
        drawGradientBar(ctx, dec.props, color, opacity);
        break;
      case "glow":
        drawGlow(ctx, dec.props, color, opacity);
        break;
      case "rect":
        drawRect(ctx, dec.props, color, opacity);
        break;
    }
  }
}

function drawLine(
  ctx: SKRSContext2D,
  props: Record<string, number | string>,
  color: string,
  opacity: number,
): void {
  ctx.strokeStyle = hexToRgba(color, opacity);
  ctx.lineWidth = (props.width as number) ?? 1;
  ctx.beginPath();
  ctx.moveTo(props.x1 as number, props.y1 as number);
  ctx.lineTo(props.x2 as number, props.y2 as number);
  ctx.stroke();
}

function drawBorder(
  ctx: SKRSContext2D,
  canvas: Canvas,
  props: Record<string, number | string>,
  color: string,
  opacity: number,
): void {
  const inset = (props.inset as number) ?? 20;
  const width = (props.width as number) ?? 1;
  ctx.strokeStyle = hexToRgba(color, opacity);
  ctx.lineWidth = width;
  ctx.strokeRect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2);
}

function drawCornerAccents(
  ctx: SKRSContext2D,
  canvas: Canvas,
  props: Record<string, number | string>,
  color: string,
  opacity: number,
): void {
  const inset = (props.inset as number) ?? 15;
  const len = (props.length as number) ?? 40;
  const width = (props.width as number) ?? 3;
  ctx.strokeStyle = hexToRgba(color, opacity);
  ctx.lineWidth = width;
  ctx.lineCap = "round";

  const w = canvas.width;
  const h = canvas.height;
  const corners = [
    // Top-left
    [inset, inset + len, inset, inset, inset + len, inset],
    // Top-right
    [w - inset - len, inset, w - inset, inset, w - inset, inset + len],
    // Bottom-left
    [inset, h - inset - len, inset, h - inset, inset + len, h - inset],
    // Bottom-right
    [w - inset - len, h - inset, w - inset, h - inset, w - inset, h - inset - len],
  ];

  for (const [x1, y1, x2, y2, x3, y3] of corners) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  }
}

function drawGradientBar(
  ctx: SKRSContext2D,
  props: Record<string, number | string>,
  color: string,
  opacity: number,
): void {
  const x = props.x as number;
  const y = props.y as number;
  const w = (props.width as number) ?? 100;
  const h = (props.height as number) ?? 3;

  const isVertical = h > w;
  const gradient = isVertical
    ? ctx.createLinearGradient(x, y, x, y + h)
    : ctx.createLinearGradient(x, y, x + w, y);

  gradient.addColorStop(0, hexToRgba(color, 0));
  gradient.addColorStop(0.5, hexToRgba(color, opacity));
  gradient.addColorStop(1, hexToRgba(color, 0));

  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
}

function drawGlow(
  ctx: SKRSContext2D,
  props: Record<string, number | string>,
  color: string,
  opacity: number,
): void {
  const x = props.x as number;
  const y = props.y as number;
  const radius = (props.radius as number) ?? 80;

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, hexToRgba(color, opacity));
  gradient.addColorStop(1, hexToRgba(color, 0));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawRect(
  ctx: SKRSContext2D,
  props: Record<string, number | string>,
  color: string,
  opacity: number,
): void {
  const x = props.x as number;
  const y = props.y as number;
  const w = props.width as number;
  const h = props.height as number;

  ctx.fillStyle = hexToRgba(color, opacity);
  ctx.fillRect(x, y, w, h);
}

// ── Main Renderer ──

export interface GenerateImageOptions extends RenderInput {
  storage?: StorageAdapter;
}

/**
 * Generate a welcome/farewell image as a PNG buffer.
 *
 * This is the main entry point — used by both the bot (on member join/leave)
 * and the dashboard API (for live preview).
 */
export async function generateWelcomeImage(options: GenerateImageOptions): Promise<Buffer> {
  // Ensure fonts are loaded
  registerFonts();

  const { settings, member, guild, storage } = options;
  const template = getTemplate(settings.template);
  const { width, height } = template.canvas;

  // Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 1. Background
  await drawBackground(ctx, canvas, settings, storage);

  // 2. Overlay
  drawOverlay(ctx, canvas, settings);

  // 3. Decorations (behind avatar and text)
  drawDecorations(ctx, canvas, template.decorations, settings);

  // 4. Avatar
  await drawAvatar(ctx, template, settings, member.avatarUrl);

  // 5. Title (username / display name)
  const titleText = member.displayName;
  drawText(ctx, titleText, template.title.x, template.title.y, {
    font: settings.title.font,
    size: settings.title.size || template.title.defaultSize,
    color: settings.title.color,
    align: template.title.align,
    maxWidth: template.title.maxWidth,
  });

  // 6. Subtitle (custom text with variables)
  const subtitleRaw = settings.subtitle.text;
  const subtitleText = replaceImageVariables(subtitleRaw, member, guild);
  drawText(ctx, subtitleText, template.subtitle.x, template.subtitle.y, {
    font: settings.subtitle.font,
    size: settings.subtitle.size || template.subtitle.defaultSize,
    color: settings.subtitle.color,
    align: template.subtitle.align,
    maxWidth: template.subtitle.maxWidth,
  });

  // Encode to PNG
  return canvas.toBuffer("image/png");
}
