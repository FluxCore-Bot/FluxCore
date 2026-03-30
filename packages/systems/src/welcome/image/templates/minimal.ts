import type { TemplateLayout } from "../types.js";

/** Ultra-clean — small avatar on left, single line of text, mostly background */
export const minimalTemplate: TemplateLayout = {
  name: "minimal",
  displayName: "Minimal",
  description: "Ultra-clean with small avatar and compact text. Lets the background shine.",
  canvas: { width: 1024, height: 350 },
  avatar: {
    x: 120,
    y: 175,
    size: 80,
  },
  title: {
    x: 210,
    y: 155,
    align: "left",
    maxWidth: 700,
    defaultSize: 28,
  },
  subtitle: {
    x: 210,
    y: 195,
    align: "left",
    maxWidth: 700,
    defaultSize: 16,
  },
  decorations: [
    {
      type: "line",
      props: {
        x1: 210,
        y1: 225,
        x2: 900,
        y2: 225,
        width: 1,
        colorSource: "accent",
        opacity: 0.15,
      },
    },
  ],
};
