import type { TemplateLayout } from "../types.js";

/** Refined and minimal — thin borders, lots of whitespace, sophisticated feel */
export const elegantTemplate: TemplateLayout = {
  name: "elegant",
  displayName: "Elegant",
  description: "Refined layout with thin borders and subtle dividers. Premium and sophisticated.",
  canvas: { width: 1024, height: 400 },
  avatar: {
    x: 512,
    y: 130,
    size: 96,
  },
  title: {
    x: 512,
    y: 240,
    align: "center",
    maxWidth: 700,
    defaultSize: 32,
  },
  subtitle: {
    x: 512,
    y: 280,
    align: "center",
    maxWidth: 600,
    defaultSize: 16,
  },
  decorations: [
    {
      type: "border",
      props: {
        inset: 30,
        width: 1,
        colorSource: "accent",
        opacity: 0.25,
      },
    },
    {
      type: "line",
      props: {
        x1: 412,
        y1: 205,
        x2: 612,
        y2: 205,
        width: 1,
        colorSource: "accent",
        opacity: 0.3,
      },
    },
    {
      type: "line",
      props: {
        x1: 362,
        y1: 310,
        x2: 662,
        y2: 310,
        width: 1,
        colorSource: "accent",
        opacity: 0.2,
      },
    },
  ],
};
