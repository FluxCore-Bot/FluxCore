export function insertToken(
  value: string,
  selStart: number,
  selEnd: number,
  token: string,
): { value: string; cursor: number } {
  const next = value.slice(0, selStart) + token + value.slice(selEnd);
  return { value: next, cursor: selStart + token.length };
}

export function getActiveQuery(
  value: string,
  caret: number,
): { query: string; start: number } | null {
  const before = value.slice(0, caret);
  const open = before.lastIndexOf("{");
  if (open === -1) return null;
  const run = before.slice(open + 1);
  // Valid partial token chars only; a closing brace or any other char breaks it.
  if (!/^[\w.]*$/.test(run)) return null;
  if (run.includes("}")) return null;
  return { query: run, start: open };
}
