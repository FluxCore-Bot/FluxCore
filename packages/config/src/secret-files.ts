import { readFileSync } from "node:fs";

/**
 * Resolve Docker-style `*_FILE` environment variables.
 *
 * For each name in `names`, if `${NAME}_FILE` is set, read its contents
 * (trimming trailing whitespace) and assign the value to `process.env[NAME]`.
 *
 * If both `NAME` and `NAME_FILE` are set, this function throws — operators
 * must pick one source of truth so a stale literal cannot mask a rotated
 * secret file.
 */
export function resolveSecretFiles(names: readonly string[]): void {
  for (const name of names) {
    const fileVar = `${name}_FILE`;
    const filePath = process.env[fileVar];
    const literal = process.env[name];
    if (filePath && literal) {
      throw new Error(
        `Both ${name} and ${fileVar} are set; choose one.`,
      );
    }
    if (filePath) {
      process.env[name] = readFileSync(filePath, "utf8").trimEnd();
    }
  }
}
