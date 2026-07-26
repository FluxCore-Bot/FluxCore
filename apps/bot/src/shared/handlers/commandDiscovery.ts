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
    } catch (err) {
      // Only a missing commands/ directory (ENOENT) is a legitimate skip — that
      // just means the feature has no commands. Any other error (e.g. EACCES,
      // EMFILE/ENFILE, ELOOP) must propagate: this helper also feeds deploy.ts,
      // whose rest.put is a full replace, and silently skipping a feature there
      // would deregister its commands instead of just under-loading them at runtime.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  return files;
}
