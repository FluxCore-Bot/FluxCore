import type { TemplateLayout } from "../types.js";

/** Gradient-heavy, dreamy — soft borders, gradient accents, ethereal feel */
export const auroraTemplate: TemplateLayout = {
  name: "aurora",
  displayName: "Aurora",
  description: "Dreamy gradient effects with soft glow. Ethereal and atmospheric.",
  canvas: { width: 1024, height: 450 },
  avatar: {
    x: 512,
    y: 145,
    size: 130,
  },
  title: {
    x: 512,
    y: 295,
    align: "center",
    maxWidth: 800,
    defaultSize: 36,
  },
  subtitle: {
    x: 512,
    y: 340,
    align: "center",
    maxWidth: 700,
    defaultSize: 18,
  },
  decorations: [
    {
      type: "glow",
      props: {
        x: 512,
        y: 145,
        radius: 100,
        colorSource: "accent",
        opacity: 0.12,
      },
    },
    {
      type: "gradient-bar",
      props: {
        x: 262,
        y: 260,
        width: 500,
        height: 3,
        colorSource: "accent",
        opacity: 0.4,
      },
    },
    {
      type: "glow",
      props: {
        x: 512,
        y: 262,
        radius: 250,
        colorSource: "accent",
        opacity: 0.06,
      },
    },
  ],
};
