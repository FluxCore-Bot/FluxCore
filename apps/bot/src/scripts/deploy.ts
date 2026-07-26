import { REST, Routes } from "discord.js";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { config } from "@fluxcore/config";
import type { Command } from "@fluxcore/types";
import { logger } from "@fluxcore/utils";
import { collectCommandFiles } from "../shared/handlers/commandDiscovery.js";

async function deploy(): Promise<void> {
  const dirname = fileURLToPath(new URL(".", import.meta.url));
  const featuresDir = join(dirname, "..", "features");

  const files = await collectCommandFiles(featuresDir);
  const commands: ReturnType<Command["data"]["toJSON"]>[] = [];

  for (const file of files) {
    const fileUrl = pathToFileURL(file).href;
    const module = await import(fileUrl);
    const command: Command = module.default;

    if (command?.data) {
      commands.push(command.data.toJSON());
    }
  }

  // rest.put is a full replace — deploying an empty array would silently
  // deregister every command. Fail loudly instead.
  if (commands.length === 0) {
    throw new Error(
      `No commands discovered under ${featuresDir} — refusing to deploy an empty command set.`,
    );
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
