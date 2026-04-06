import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExtendedClient } from "../client/ExtendedClient.js";
import type { Command } from "@fluxcore/types";
import { getFiles, logger } from "@fluxcore/utils";

export async function loadCommands(client: ExtendedClient): Promise<void> {
  const dirname = fileURLToPath(new URL(".", import.meta.url));
  const featuresDir = join(dirname, "..", "..", "features");

  // Collect command files from all features/*/commands/ directories
  const featureEntries = await readdir(featuresDir, { withFileTypes: true });
  const allFiles: string[] = [];

  for (const entry of featureEntries) {
    if (!entry.isDirectory()) continue;
    const commandsDir = join(featuresDir, entry.name, "commands");
    try {
      const files = await getFiles(commandsDir);
      allFiles.push(...files);
    } catch {
      // Feature has no commands/ directory — skip
    }
  }

  const modules = await Promise.all(
    allFiles.map(async (file) => {
      const fileUrl = pathToFileURL(file).href;
      const module = await import(fileUrl);
      return { file, module };
    }),
  );

  for (const { file, module } of modules) {
    const command: Command = module.default;

    if (!command?.data || !command?.execute) {
      logger.warn(`Skipping ${file}: missing "data" or "execute" export`);
      continue;
    }

    client.commands.set(command.data.name, command);
    logger.debug(`Loaded command: ${command.data.name}`);
  }

  logger.info(`Loaded ${client.commands.size} command(s)`);
}
