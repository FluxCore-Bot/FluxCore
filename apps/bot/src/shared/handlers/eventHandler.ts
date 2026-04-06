import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExtendedClient } from "../client/ExtendedClient.js";
import type { Event } from "@fluxcore/types";
import { logger } from "@fluxcore/utils";

export async function loadEvents(client: ExtendedClient): Promise<void> {
  const dirname = fileURLToPath(new URL(".", import.meta.url));
  const eventsDir = join(dirname, "..", "..", "events");

  const entries = await readdir(eventsDir, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".js")) continue;

    const filePath = join(eventsDir, entry.name);
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(fileUrl);
    const event: Event = module.default;

    if (!event?.name || !event?.execute) {
      logger.warn(
        `Skipping event ${entry.name}: missing "name" or "execute" export`,
      );
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => {
        Promise.resolve(event.execute(...args)).catch((err: unknown) =>
          logger.error(
            `Event ${event.name} error`,
            err instanceof Error ? err : new Error(String(err)),
          ),
        );
      });
    } else {
      client.on(event.name, (...args) => {
        Promise.resolve(event.execute(...args)).catch((err: unknown) =>
          logger.error(
            `Event ${event.name} error`,
            err instanceof Error ? err : new Error(String(err)),
          ),
        );
      });
    }

    count++;
    logger.debug(`Loaded event: ${event.name}${event.once ? " (once)" : ""}`);
  }

  logger.info(`Loaded ${count} event(s)`);
}
