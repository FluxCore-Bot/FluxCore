import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let root: string;
let collectCommandFiles: (featuresDir: string) => Promise<string[]>;

beforeAll(async () => {
  // commandDiscovery.js transitively imports @fluxcore/config (via @fluxcore/utils's
  // logger), which eager-loads and requires DISCORD_TOKEN/CLIENT_ID at import time.
  // Stub fake values here so this file doesn't rely on env leaked from other test
  // files — turbo.json intentionally does not pass real credentials to the test task.
  vi.stubEnv("DISCORD_TOKEN", "test-token");
  vi.stubEnv("CLIENT_ID", "test-client-id");

  ({ collectCommandFiles } = await import("../../src/shared/handlers/commandDiscovery.js"));

  root = await mkdtemp(join(tmpdir(), "fluxcore-cmd-"));

  // A feature with a flat commands/ directory
  await mkdir(join(root, "moderation", "commands"), { recursive: true });
  await writeFile(join(root, "moderation", "commands", "ban.ts"), "export default {};");

  // A feature whose commands/ has a nested subdirectory
  await mkdir(join(root, "general", "commands", "nested"), { recursive: true });
  await writeFile(join(root, "general", "commands", "nested", "deep.ts"), "export default {};");

  // A feature with NO commands/ directory — must not throw
  await mkdir(join(root, "logging", "system"), { recursive: true });
  await writeFile(join(root, "logging", "system", "sender.ts"), "export default {};");

  // A stray file at the features root — must be ignored
  await writeFile(join(root, "README.md"), "not a feature");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("collectCommandFiles", () => {
  it("finds command files across every feature, including nested ones", async () => {
    const files = await collectCommandFiles(root);
    const relative = files.map((f) => f.slice(root.length));

    expect(relative).toHaveLength(2);
    expect(relative).toEqual(
      expect.arrayContaining([
        "/moderation/commands/ban.ts",
        "/general/commands/nested/deep.ts",
      ]),
    );
  });

  it("skips features that have no commands directory", async () => {
    const files = await collectCommandFiles(root);
    expect(files.some((f) => f.includes("logging"))).toBe(false);
  });

  it("ignores non-directory entries at the features root", async () => {
    const files = await collectCommandFiles(root);
    expect(files.some((f) => f.endsWith("README.md"))).toBe(false);
  });

  it("returns an empty array for a features directory with no features", async () => {
    const empty = await mkdtemp(join(tmpdir(), "fluxcore-empty-"));
    try {
      expect(await collectCommandFiles(empty)).toEqual([]);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});
