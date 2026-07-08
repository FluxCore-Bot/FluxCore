import type { VariableDescriptor } from "./types";

function bareToken(token: string): string {
  return token.replace(/[{}]/g, "").toLowerCase();
}

export function filterByQuery(
  descriptors: VariableDescriptor[],
  query: string,
): VariableDescriptor[] {
  const q = query.toLowerCase();
  if (q === "") return [...descriptors];
  const matches = descriptors
    .map((d, index) => ({ d, index, pos: bareToken(d.token).indexOf(q) }))
    .filter((m) => m.pos !== -1);
  matches.sort((a, b) => (a.pos !== b.pos ? a.pos - b.pos : a.index - b.index));
  return matches.map((m) => m.d);
}
