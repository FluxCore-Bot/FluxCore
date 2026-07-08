import type { Segment } from "./types";

export const TOKEN_REGEX = /\{[\w.]+\}/g;

export function tokenize(value: string, known: Set<string>): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  const re = new RegExp(TOKEN_REGEX.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: value.slice(lastIndex, match.index), known: false });
    }
    segments.push({ type: "var", value: match[0], known: known.has(match[0]) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length) {
    segments.push({ type: "text", value: value.slice(lastIndex), known: false });
  }
  return segments;
}

export function extractTokens(value: string): string[] {
  const re = new RegExp(TOKEN_REGEX.source, "g");
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) out.push(match[0]);
  return out;
}
