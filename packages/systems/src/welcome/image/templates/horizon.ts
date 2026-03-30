import type { TemplateLayout } from "../types.js";

/** Landscape split — avatar on left, text right-aligned with horizontal accent */
export const horizonTemplate: TemplateLayout = {
  name: "horizon",
  displayName: "Horizon",
  description: "Landscape split with avatar on left and text on right. Modern and balanced.",
  canvas: { width: 1024, height: 450 },
  avatar: {
    x: 180,
    y: 225,
    size: 140,
  },
  title: {
    x: 620,
    y: 195,
    align: "left",
    maxWidth: 380,
    defaultSize: 34,
  },
  subtitle: {
    x: 620,
    y: 240,
    align: "left",
    maxWidth: 380,
    defaultSize: 18,
  },
  decorations: [
    {
      type: "gradient-bar",
      props: {
        x: 380,
        y: 140,
        width: 3,
        height: 170,
        colorSource: "accent",
        opacity: 0.6,
      },
    },
    {
      type: "line",
      props: {
        x1: 620,
        y1: 270,
        x2: 950,
        y2: 270,
        width: 1,
        colorSource: "accent",
        opacity: 0.3,
      },
    },
  ],
};
