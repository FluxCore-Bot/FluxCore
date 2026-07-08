export interface TemplateDecoration {
  type: "line" | "rect" | "gradient-bar" | "border" | "corner-accents" | "glow";
  props: Record<string, number | string>;
}

export interface TemplateLayout {
  name: string;
  displayName: string;
  description: string;
  canvas: { width: number; height: number };
  avatar: { x: number; y: number; size: number };
  title: {
    x: number;
    y: number;
    align: "left" | "center" | "right";
    maxWidth: number;
    defaultSize: number;
  };
  subtitle: {
    x: number;
    y: number;
    align: "left" | "center" | "right";
    maxWidth: number;
    defaultSize: number;
  };
  decorations: TemplateDecoration[];
}

const starterTemplate: TemplateLayout = {
  name: "starter",
  displayName: "Starter",
  description: "Classic centered layout. Clean and universal — works for any server.",
  canvas: { width: 1024, height: 450 },
  avatar: { x: 512, y: 150, size: 128 },
  title: { x: 512, y: 290, align: "center", maxWidth: 800, defaultSize: 36 },
  subtitle: { x: 512, y: 335, align: "center", maxWidth: 700, defaultSize: 20 },
  decorations: [
    {
      type: "line",
      props: { x1: 312, y1: 258, x2: 712, y2: 258, width: 2, colorSource: "accent", opacity: 0.4 },
    },
  ],
};

const neonTemplate: TemplateLayout = {
  name: "neon",
  displayName: "Neon",
  description: "Cyberpunk-inspired with neon accents and glow effects. Built for gaming servers.",
  canvas: { width: 1024, height: 450 },
  avatar: { x: 512, y: 155, size: 120 },
  title: { x: 512, y: 300, align: "center", maxWidth: 800, defaultSize: 40 },
  subtitle: { x: 512, y: 350, align: "center", maxWidth: 700, defaultSize: 18 },
  decorations: [
    { type: "border", props: { inset: 20, width: 2, colorSource: "accent", opacity: 0.5 } },
    { type: "corner-accents", props: { inset: 15, length: 40, width: 3, colorSource: "accent", opacity: 0.8 } },
    { type: "glow", props: { x: 512, y: 155, radius: 80, colorSource: "accent", opacity: 0.15 } },
  ],
};

const horizonTemplate: TemplateLayout = {
  name: "horizon",
  displayName: "Horizon",
  description: "Landscape split with avatar on left and text on right. Modern and balanced.",
  canvas: { width: 1024, height: 450 },
  avatar: { x: 180, y: 225, size: 140 },
  title: { x: 620, y: 195, align: "left", maxWidth: 380, defaultSize: 34 },
  subtitle: { x: 620, y: 240, align: "left", maxWidth: 380, defaultSize: 18 },
  decorations: [
    { type: "gradient-bar", props: { x: 380, y: 140, width: 3, height: 170, colorSource: "accent", opacity: 0.6 } },
    { type: "line", props: { x1: 620, y1: 270, x2: 950, y2: 270, width: 1, colorSource: "accent", opacity: 0.3 } },
  ],
};

const elegantTemplate: TemplateLayout = {
  name: "elegant",
  displayName: "Elegant",
  description: "Refined layout with thin borders and subtle dividers. Premium and sophisticated.",
  canvas: { width: 1024, height: 400 },
  avatar: { x: 512, y: 130, size: 96 },
  title: { x: 512, y: 240, align: "center", maxWidth: 700, defaultSize: 32 },
  subtitle: { x: 512, y: 280, align: "center", maxWidth: 600, defaultSize: 16 },
  decorations: [
    { type: "border", props: { inset: 30, width: 1, colorSource: "accent", opacity: 0.25 } },
    { type: "line", props: { x1: 412, y1: 205, x2: 612, y2: 205, width: 1, colorSource: "accent", opacity: 0.3 } },
    { type: "line", props: { x1: 362, y1: 310, x2: 662, y2: 310, width: 1, colorSource: "accent", opacity: 0.2 } },
  ],
};

const minimalTemplate: TemplateLayout = {
  name: "minimal",
  displayName: "Minimal",
  description: "Ultra-clean with small avatar and compact text. Lets the background shine.",
  canvas: { width: 1024, height: 350 },
  avatar: { x: 120, y: 175, size: 80 },
  title: { x: 210, y: 155, align: "left", maxWidth: 700, defaultSize: 28 },
  subtitle: { x: 210, y: 195, align: "left", maxWidth: 700, defaultSize: 16 },
  decorations: [
    { type: "line", props: { x1: 210, y1: 225, x2: 900, y2: 225, width: 1, colorSource: "accent", opacity: 0.15 } },
  ],
};

const auroraTemplate: TemplateLayout = {
  name: "aurora",
  displayName: "Aurora",
  description: "Dreamy gradient effects with soft glow. Ethereal and atmospheric.",
  canvas: { width: 1024, height: 450 },
  avatar: { x: 512, y: 145, size: 130 },
  title: { x: 512, y: 295, align: "center", maxWidth: 800, defaultSize: 36 },
  subtitle: { x: 512, y: 340, align: "center", maxWidth: 700, defaultSize: 18 },
  decorations: [
    { type: "glow", props: { x: 512, y: 145, radius: 100, colorSource: "accent", opacity: 0.12 } },
    { type: "gradient-bar", props: { x: 262, y: 260, width: 500, height: 3, colorSource: "accent", opacity: 0.4 } },
    { type: "glow", props: { x: 512, y: 262, radius: 250, colorSource: "accent", opacity: 0.06 } },
  ],
};

const templates = new Map<string, TemplateLayout>([
  ["starter", starterTemplate],
  ["neon", neonTemplate],
  ["horizon", horizonTemplate],
  ["elegant", elegantTemplate],
  ["minimal", minimalTemplate],
  ["aurora", auroraTemplate],
]);

export function getTemplate(name: string): TemplateLayout {
  return templates.get(name) ?? starterTemplate;
}

export const PRESET_GRADIENTS: Record<string, [string, string, string?]> = {
  midnight: ["#0f0c29", "#302b63", "#24243e"],
  ocean: ["#141e30", "#243b55"],
  sunset: ["#1a0a2e", "#6b2fa0", "#d4418e"],
  forest: ["#0a1a0a", "#1b4332", "#2d6a4f"],
  nebula: ["#16082b", "#4a1a7a", "#1a0a3e"],
  ember: ["#1a0a0a", "#7a1a1a", "#3e1a0a"],
};
