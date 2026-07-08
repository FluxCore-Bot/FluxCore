import { tokenize } from "./tokens";

export function resolveTemplatePreview(template: string, values: Map<string, string>): string {
  const known = new Set(values.keys());
  return tokenize(template, known)
    .map((seg) => (seg.type === "var" && seg.known ? values.get(seg.value)! : seg.value))
    .join("");
}
