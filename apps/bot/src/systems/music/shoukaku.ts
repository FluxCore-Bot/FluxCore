import { Shoukaku, Connectors } from "shoukaku";
import type { Client } from "discord.js";
import { config } from "@fluxcore/config";
import { logger } from "@fluxcore/utils";

let shoukaku: Shoukaku;

export function initShoukaku(client: Client): Shoukaku {
  const nodeUrl = `${config.lavalinkHost}:${config.lavalinkPort}`;
  logger.info(`Connecting to Lavalink at ${nodeUrl}`);

  shoukaku = new Shoukaku(
    new Connectors.DiscordJS(client),
    [
      {
        name: "main",
        url: nodeUrl,
        auth: config.lavalinkPassword,
      },
    ],
    {
      moveOnDisconnect: false,
      resume: true,
      resumeTimeout: 30,
      reconnectTries: 5,
      reconnectInterval: 10,
    },
  );

  shoukaku.on("ready", (name: string) => {
    logger.info(`Lavalink node "${name}" connected`);
  });

  shoukaku.on("error", (name: string, error: Error) => {
    logger.error(`Lavalink node "${name}" error`, error);
  });

  shoukaku.on("close", (name: string, code: number, reason: string) => {
    logger.warn(`Lavalink node "${name}" closed (code: ${code}, reason: ${reason})`);
  });

  shoukaku.on("disconnect", (name: string, count: number) => {
    logger.warn(`Lavalink node "${name}" disconnected, ${count} player(s) affected`);
  });

  shoukaku.on("reconnecting", (name: string, left: number, interval: number) => {
    logger.info(`Lavalink node "${name}" reconnecting, ${left} tries left (interval: ${interval}s)`);
  });

  shoukaku.on("debug", (name: string, info: string) => {
    logger.debug(`Lavalink [${name}]: ${info}`);
  });

  return shoukaku;
}

export function getShoukaku(): Shoukaku {
  return shoukaku;
}
