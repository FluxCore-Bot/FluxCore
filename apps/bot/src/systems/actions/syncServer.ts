import { createServer, type Server } from "node:http";
import { config } from "@fluxcore/config";
import { logger } from "@fluxcore/utils";
import { reloadGuild } from "@fluxcore/systems/actions/cache";
import { loadActionGuildSettings } from "@fluxcore/systems/actions/config";
import { reloadGuildTempVoiceConfig } from "@fluxcore/systems/tempVoice/config";
import { loadMusicSettings } from "@fluxcore/systems/music/config";

let server: Server | null = null;

export function startSyncServer(): void {
  if (server) return;

  server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/cache/invalidate") {
      res.writeHead(404);
      res.end();
      return;
    }

    const secret = req.headers["x-sync-secret"];
    if (secret !== config.botSyncSecret) {
      res.writeHead(401);
      res.end();
      return;
    }

    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > 1024) {
        res.writeHead(413);
        res.end();
        req.destroy();
      }
    });

    req.on("end", async () => {
      try {
        const { guildId, action } = JSON.parse(body) as {
          guildId: string;
          action: string;
        };

        if (!guildId || typeof guildId !== "string") {
          res.writeHead(400);
          res.end();
          return;
        }

        if (action === "reloadSettings") {
          await loadActionGuildSettings();
        }

        if (action === "reloadTempVoice") {
          await reloadGuildTempVoiceConfig(guildId);
        } else if (action === "reloadMusic") {
          await loadMusicSettings();
        } else {
          await reloadGuild(guildId);
        }

        logger.debug(`Cache sync (HTTP): reloaded guild ${guildId}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        logger.error(
          "Cache sync HTTP handler failed",
          error instanceof Error ? error : new Error(String(error)),
        );
        res.writeHead(500);
        res.end();
      }
    });
  });

  server.listen(config.botSyncPort, () => {
    logger.info(`Cache sync server listening on port ${config.botSyncPort}`);
  });

  server.on("error", (err) => {
    logger.error("Cache sync server error", err);
  });
}

export function stopSyncServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
