import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const FEATURES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/server/features",
);

const callPattern = /requirePermission\(([^)]*)\)/g;
const literalPattern = /"([^"]+)"/g;

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Statically scans every route source file under `src/server/features/` for
 * `requirePermission(...)` calls and extracts the string-literal keys passed
 * to them.
 *
 * This reproduces the same key set `getDeclaredPermissions()` accumulates
 * once the real app boots and every route registers — without booting a real
 * `createApp()` (which connects to the database and can `process.exit` on
 * missing config, making it unsuitable for a unit test). Because it reads the
 * actual route sources, a new route declaring an unknown module or a bad
 * action verb shows up here exactly as it would at boot, so tests built on
 * this helper act as the CI-time equivalent of the boot-time
 * `validatePermissionRegistry` check.
 *
 * Exported for reuse — later tests (e.g. a drift check against the dashboard
 * client) should scan the same way rather than re-implementing the regex.
 */
export function scanDeclaredPermissionKeys(): Set<string> {
  const keys = new Set<string>();

  for (const file of walk(FEATURES_DIR)) {
    const source = readFileSync(file, "utf8");
    for (const call of source.matchAll(callPattern)) {
      const args = call[1] ?? "";
      for (const literal of args.matchAll(literalPattern)) {
        keys.add(literal[1]);
      }
    }
  }

  return keys;
}
