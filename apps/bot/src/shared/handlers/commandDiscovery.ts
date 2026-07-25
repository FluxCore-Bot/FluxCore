import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { getFiles } from "@fluxcore/utils";

/**
 * Collect every command file across `features/<feature>/commands/`.
 *
 * Shared by the runtime command loader and the slash-command deploy script so
 * the two can never disagree about which commands exist — they did for a while,
 * and it silently broke deployment for every module.
 */
export async function collectCommandFiles(featuresDir: string): Promise<string[]> {
  const featureEntries = await readdir(featuresDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of featureEntries) {
    if (!entry.isDirectory()) continue;
    try {
      files.push(...(await getFiles(join(featuresDir, entry.name, "commands"))));
    } catch {
      // Feature has no commands/ directory — skip
    }
  }

  return files;
}
