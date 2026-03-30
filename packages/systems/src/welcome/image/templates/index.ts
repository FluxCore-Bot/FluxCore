import type { TemplateLayout } from "../types.js";
import { starterTemplate } from "./starter.js";
import { horizonTemplate } from "./horizon.js";
import { neonTemplate } from "./neon.js";
import { elegantTemplate } from "./elegant.js";
import { minimalTemplate } from "./minimal.js";
import { auroraTemplate } from "./aurora.js";

const templates = new Map<string, TemplateLayout>([
  ["starter", starterTemplate],
  ["horizon", horizonTemplate],
  ["neon", neonTemplate],
  ["elegant", elegantTemplate],
  ["minimal", minimalTemplate],
  ["aurora", auroraTemplate],
]);

/** Get a template by name. Falls back to "starter" if not found. */
export function getTemplate(name: string): TemplateLayout {
  return templates.get(name) ?? starterTemplate;
}

/** Get all available templates for the dashboard UI. */
export function getAllTemplates(): TemplateLayout[] {
  return [...templates.values()];
}

/** Check if a template name is valid. */
export function isValidTemplate(name: string): boolean {
  return templates.has(name);
}

export {
  starterTemplate,
  horizonTemplate,
  neonTemplate,
  elegantTemplate,
  minimalTemplate,
  auroraTemplate,
};
