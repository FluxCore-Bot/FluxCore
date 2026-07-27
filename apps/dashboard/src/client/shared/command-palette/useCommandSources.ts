import { score } from "./ranking";
import {
  capFor, GROUP_ORDER,
  type Command, type CommandGroup, type CommandGroupKey,
} from "./types";

export function buildGroups(commands: Command[], query: string): CommandGroup[] {
  const scored = new Map<CommandGroupKey, Array<{ cmd: Command; s: number }>>();

  for (const cmd of commands) {
    const s = score(query, { title: cmd.title, keywords: cmd.keywords });
    if (s === null) continue;
    const bucket = scored.get(cmd.group) ?? [];
    bucket.push({ cmd, s });
    scored.set(cmd.group, bucket);
  }

  const groups: CommandGroup[] = [];
  for (const key of GROUP_ORDER) {
    const bucket = scored.get(key);
    if (!bucket || bucket.length === 0) continue;

    // Recents arrive most-recent-first and must stay that way — ranking them
    // would alphabetize the group whenever scores tie, i.e. on every empty
    // query, which is exactly when recents matter.
    if (key !== "recent") {
      bucket.sort((a, b) =>
        b.s - a.s || a.cmd.title.localeCompare(b.cmd.title),
      );
    }

    groups.push({
      key,
      total: bucket.length,
      commands: bucket.slice(0, capFor(key)).map((e) => e.cmd),
    });
  }

  return groups;
}

/** Flatten in render order so arrow keys walk the list the eye sees. */
export function flatten(groups: CommandGroup[]): Command[] {
  return groups.flatMap((g) => g.commands);
}
