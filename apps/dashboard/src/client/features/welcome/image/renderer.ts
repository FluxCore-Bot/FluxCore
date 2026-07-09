import { getTemplate, PRESET_GRADIENTS } from "./templates";

export interface ClientImageSettings {
  template: string;
  background: {
    type: "color" | "image" | "preset";
    color: string;
    imageKey?: string;
    preset?: string;
  };
  overlay: {
    enabled: boolean;
    color: string;
    opacity: number;
  };
  avatar: {
    shape: "circle" | "rounded" | "square";
    borderColor: string;
    borderWidth: number;
    glowEnabled: boolean;
    glowColor: string;
  };
  title: {
    font: string;
    color: string;
    size: number;
  };
  subtitle: {
    font: string;
    color: string;
    size: number;
    text: string;
  };
  accentColor: string;
  sendMode: "with" | "before" | "only";
}

export interface RenderInput {
  settings: ClientImageSettings;
  member: {
    username: string;
    displayName: string;
    avatarUrl: string;
  };
  guild: {
    name: string;
    memberCount: number;
  };
}

type FontCategory = "sans-serif" | "serif" | "monospace" | "display" | "rounded";

const FONT_FAMILIES: Record<string, { family: string; category: FontCategory }> = {
  Inter: { family: "Inter", category: "sans-serif" },
  SpaceGrotesk: { family: "Space Grotesk", category: "sans-serif" },
  JetBrainsMono: { family: "JetBrains Mono", category: "monospace" },
  Poppins: { family: "Poppins", category: "rounded" },
  PlayfairDisplay: { family: "Playfair Display", category: "serif" },
  Outfit: { family: "Outfit", category: "sans-serif" },
  Orbitron: { family: "Orbitron", category: "display" },
  BebasNeue: { family: "Bebas Neue", category: "display" },
};

export function getFontFamily(fontName: string): string {
  return FONT_FAMILIES[fontName]?.family ?? "Inter";
}

const FONT_CSS_URLS: Record<string, string> = {
  Inter: "https://fonts.googleapis.com/css2?family=Inter:wght@600&display=swap",
  "Space Grotesk": "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap",
  "JetBrains Mono": "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700&display=swap",
  Poppins: "https://fonts.googleapis.com/css2?family=Poppins:wght@600&display=swap",
  "Playfair Display": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap",
  Outfit: "https://fonts.googleapis.com/css2?family=Outfit:wght@600&display=swap",
  Orbitron: "https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap",
  "Bebas Neue": "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
};

let fontsLoaded = false;
let fontLoadPromise: Promise<void> | null = null;

export function loadPreviewFonts(): Promise<void> {
  if (fontsLoaded) return Promise.resolve();
  if (fontLoadPromise) return fontLoadPromise;

  const uniqueUrls = new Set(Object.values(FONT_CSS_URLS));
  fontLoadPromise = new Promise<void>((resolve) => {
    let loaded = 0;
    const total = uniqueUrls.size;

    if (total === 0) {
      fontsLoaded = true;
      resolve();
      return;
    }

    for (const url of uniqueUrls) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.onload = () => {
        loaded++;
        if (loaded >= total) {
          document.fonts.ready.then(() => {
            fontsLoaded = true;
            resolve();
          });
        }
      };
      link.onerror = () => {
        loaded++;
        if (loaded >= total) {
          document.fonts.ready.then(() => {
            fontsLoaded = true;
            resolve();
          });
        }
      };
      document.head.appendChild(link);
    }
  });

  return fontLoadPromise;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveColor(colorSource: string, settings: ClientImageSettings): string {
  if (colorSource === "accent") return settings.accentColor;
  if (colorSource === "title") return settings.title.color;
  if (colorSource === "subtitle") return settings.subtitle.color;
  return colorSource;
}

async function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: ClientImageSettings,
): Promise<void> {
  const { background } = settings;

  if (background.type === "image" && background.imageKey) {
    try {
      const imgUrl = `/uploads/welcome/${background.imageKey}`;
      const img = await loadImageElement(imgUrl);
      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const drawWidth = img.naturalWidth * scale;
      const drawHeight = img.naturalHeight * scale;
      const offsetX = (width - drawWidth) / 2;
      const offsetY = (height - drawHeight) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      return;
    } catch {
      // Fall through
    }
  }

  if (background.type === "preset" && background.preset) {
    const colors = PRESET_GRADIENTS[background.preset];
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

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: ClientImageSettings,
): void {
  if (!settings.overlay.enabled) return;
  ctx.fillStyle = hexToRgba(settings.overlay.color, settings.overlay.opacity);
  ctx.fillRect(0, 0, width, height);
}

async function drawAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  settings: ClientImageSettings,
  avatarUrl: string,
): Promise<void> {
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
    const img = await loadImageElement(avatarUrl);
    ctx.drawImage(img, x - radius, y - radius, size, size);
  } catch {
    ctx.fillStyle = "#374151";
    ctx.fill();
  }

  ctx.restore();
}

function drawAvatarShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  shape: "circle" | "rounded" | "square",
): void {
  if (shape === "circle") {
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  } else if (shape === "rounded") {
    const w = radius * 2;
    const r = radius * 0.3;
    ctx.roundRect(x - radius, y - radius, w, w, r);
  } else {
    ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
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
  ctx.font = `${options.size}px "${family}", sans-serif`;
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align;
  ctx.textBaseline = "middle";

  let displayText = text;
  const measured = ctx.measureText(displayText);
  if (measured.width > options.maxWidth && displayText.length > 3) {
    while (
      ctx.measureText(displayText + "...").width > options.maxWidth &&
      displayText.length > 1
    ) {
      displayText = displayText.slice(0, -1);
    }
    displayText += "...";
  }

  ctx.fillText(displayText, x, y, options.maxWidth);
}

function drawDecorations(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  decorations: { type: string; props: Record<string, number | string> }[],
  settings: ClientImageSettings,
): void {
  for (const dec of decorations) {
    const color = resolveColor(dec.props.colorSource as string, settings);
    const opacity = (dec.props.opacity as number) ?? 1;

    switch (dec.type) {
      case "line":
        ctx.strokeStyle = hexToRgba(color, opacity);
        ctx.lineWidth = (dec.props.width as number) ?? 1;
        ctx.beginPath();
        ctx.moveTo(dec.props.x1 as number, dec.props.y1 as number);
        ctx.lineTo(dec.props.x2 as number, dec.props.y2 as number);
        ctx.stroke();
        break;

      case "border": {
        const inset = (dec.props.inset as number) ?? 20;
        ctx.strokeStyle = hexToRgba(color, opacity);
        ctx.lineWidth = (dec.props.width as number) ?? 1;
        ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
        break;
      }

      case "corner-accents": {
        const inset = (dec.props.inset as number) ?? 15;
        const len = (dec.props.length as number) ?? 40;
        const lw = (dec.props.width as number) ?? 3;
        ctx.strokeStyle = hexToRgba(color, opacity);
        ctx.lineWidth = lw;
        ctx.lineCap = "round";

        const corners = [
          [inset, inset + len, inset, inset, inset + len, inset],
          [width - inset - len, inset, width - inset, inset, width - inset, inset + len],
          [inset, height - inset - len, inset, height - inset, inset + len, height - inset],
          [width - inset - len, height - inset, width - inset, height - inset, width - inset, height - inset - len],
        ];

        for (const [x1, y1, x2, y2, x3, y3] of corners) {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.lineTo(x3, y3);
          ctx.stroke();
        }
        ctx.lineCap = "butt";
        break;
      }

      case "gradient-bar": {
        const gx = dec.props.x as number;
        const gy = dec.props.y as number;
        const gw = (dec.props.width as number) ?? 100;
        const gh = (dec.props.height as number) ?? 3;

        const isVertical = gh > gw;
        const gradient = isVertical
          ? ctx.createLinearGradient(gx, gy, gx, gy + gh)
          : ctx.createLinearGradient(gx, gy, gx + gw, gy);

        gradient.addColorStop(0, hexToRgba(color, 0));
        gradient.addColorStop(0.5, hexToRgba(color, opacity));
        gradient.addColorStop(1, hexToRgba(color, 0));

        ctx.fillStyle = gradient;
        ctx.fillRect(gx, gy, gw, gh);
        break;
      }

      case "glow": {
        const glx = dec.props.x as number;
        const gly = dec.props.y as number;
        const gRadius = (dec.props.radius as number) ?? 80;

        const gradient = ctx.createRadialGradient(glx, gly, 0, glx, gly, gRadius);
        gradient.addColorStop(0, hexToRgba(color, opacity));
        gradient.addColorStop(1, hexToRgba(color, 0));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(glx, gly, gRadius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case "rect": {
        const rx = dec.props.x as number;
        const ry = dec.props.y as number;
        const rw = dec.props.width as number;
        const rh = dec.props.height as number;
        ctx.fillStyle = hexToRgba(color, opacity);
        ctx.fillRect(rx, ry, rw, rh);
        break;
      }
    }
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function replaceVariables(text: string, member: RenderInput["member"], guild: RenderInput["guild"]): string {
  return text
    .replaceAll("{user}", member.username)
    .replaceAll("{user.name}", member.username)
    .replaceAll("{user.displayname}", member.displayName)
    .replaceAll("{server}", guild.name)
    .replaceAll("{membercount}", guild.memberCount.toLocaleString());
}

export interface GenerateResult {
  blob: Blob;
  url: string;
}

export async function renderWelcomeImagePreview(input: RenderInput): Promise<GenerateResult> {
  await loadPreviewFonts();

  const { settings, member, guild } = input;
  const template = getTemplate(settings.template);
  const { width, height } = template.canvas;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  await drawBackground(ctx, width, height, settings);

  drawOverlay(ctx, width, height, settings);

  drawDecorations(ctx, width, height, template.decorations, settings);

  await drawAvatar(ctx, template.avatar.x, template.avatar.y, template.avatar.size, settings, member.avatarUrl);

  const titleText = member.displayName;
  drawText(ctx, titleText, template.title.x, template.title.y, {
    font: settings.title.font,
    size: settings.title.size || template.title.defaultSize,
    color: settings.title.color,
    align: template.title.align,
    maxWidth: template.title.maxWidth,
  });

  const subtitleRaw = settings.subtitle.text;
  const subtitleText = replaceVariables(subtitleRaw, member, guild);
  drawText(ctx, subtitleText, template.subtitle.x, template.subtitle.y, {
    font: settings.subtitle.font,
    size: settings.subtitle.size || template.subtitle.defaultSize,
    color: settings.subtitle.color,
    align: template.subtitle.align,
    maxWidth: template.subtitle.maxWidth,
  });

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), "image/png");
  });

  const url = URL.createObjectURL(blob);

  return { blob, url };
}
