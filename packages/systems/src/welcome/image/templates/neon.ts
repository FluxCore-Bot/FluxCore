import type { TemplateLayout } from "../types.js";

/** Gaming/cyberpunk — neon accents, corner markers, bold positioning */
export const neonTemplate: TemplateLayout = {
  name: "neon",
  displayName: "Neon",
  description: "Cyberpunk-inspired with neon accents and glow effects. Built for gaming servers.",
  canvas: { width: 1024, height: 450 },
  avatar: {
    x: 512,
    y: 155,
    size: 120,
  },
  title: {
    x: 512,
    y: 300,
    align: "center",
    maxWidth: 800,
    defaultSize: 40,
  },
  subtitle: {
    x: 512,
    y: 350,
    align: "center",
    maxWidth: 700,
    defaultSize: 18,
  },
  decorations: [
    {
      type: "border",
      props: {
        inset: 20,
        width: 2,
        colorSource: "accent",
        opacity: 0.5,
      },
    },
    {
      type: "corner-accents",
      props: {
        inset: 15,
        length: 40,
        width: 3,
        colorSource: "accent",
        opacity: 0.8,
      },
    },
    {
      type: "glow",
      props: {
        x: 512,
        y: 155,
        radius: 80,
        colorSource: "accent",
        opacity: 0.15,
      },
    },
  ],
};
