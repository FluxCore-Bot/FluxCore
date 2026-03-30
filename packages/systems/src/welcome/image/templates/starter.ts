import type { TemplateLayout } from "../types.js";

/** Classic centered layout — avatar centered top, text below */
export const starterTemplate: TemplateLayout = {
  name: "starter",
  displayName: "Starter",
  description: "Classic centered layout. Clean and universal — works for any server.",
  canvas: { width: 1024, height: 450 },
  avatar: {
    x: 512,
    y: 150,
    size: 128,
  },
  title: {
    x: 512,
    y: 290,
    align: "center",
    maxWidth: 800,
    defaultSize: 36,
  },
  subtitle: {
    x: 512,
    y: 335,
    align: "center",
    maxWidth: 700,
    defaultSize: 20,
  },
  decorations: [
    {
      type: "line",
      props: {
        x1: 312,
        y1: 258,
        x2: 712,
        y2: 258,
        width: 2,
        colorSource: "accent",
        opacity: 0.4,
      },
    },
  ],
};
