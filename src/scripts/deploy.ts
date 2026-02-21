import { REST, Routes } from "discord.js";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { config } from "../config/index.js";
import type { Command } from "../types/index.js";
import { getFiles } from "../utils/files.js";
import { logger } from "../utils/logger.js";

async function deploy(): Promise<void> {
  const dirname = fileURLToPath(new URL(".", import.meta.url));
  const commandsDir = join(dirname, "..", "commands");

  const files = await getFiles(commandsDir);
  const commands: ReturnType<Command["data"]["toJSON"]>[] = [];

  for (const file of files) {
    const fileUrl = pathToFileURL(file).href;
    const module = await import(fileUrl);
    const command: Command = module.default;

    if (command?.data) {
      commands.push(command.data.toJSON());
    }
  }

  const rest = new REST().setToken(config.token);

  if (config.guildId) {
    logger.info(
      `Deploying ${commands.length} command(s) to guild ${config.guildId}...`,
    );
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands },
    );
  } else {
    logger.info(`Deploying ${commands.length} command(s) globally...`);
    await rest.put(Routes.applicationCommands(config.clientId), {
      body: commands,
    });
  }

  logger.info("Commands deployed successfully!");
}

deploy().catch((error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error("Failed to deploy commands", err);
  process.exit(1);
});
