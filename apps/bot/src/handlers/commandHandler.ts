import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExtendedClient } from "../client/ExtendedClient.js";
import type { Command } from "@fluxcore/types";
import { getFiles, logger } from "@fluxcore/utils";

export async function loadCommands(client: ExtendedClient): Promise<void> {
  const dirname = fileURLToPath(new URL(".", import.meta.url));
  const commandsDir = join(dirname, "..", "commands");

  const files = await getFiles(commandsDir);

  const modules = await Promise.all(
    files.map(async (file) => {
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
