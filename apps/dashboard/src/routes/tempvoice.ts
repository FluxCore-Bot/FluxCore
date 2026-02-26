import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../middleware.js";
import {
  getGuildConfig,
  setGuildConfig,
  removeGuildConfig,
} from "@fluxcore/systems/tempVoice/config";
import { channelExistsInGuild } from "../discordApi.js";

export function registerTempVoiceRoutes(app: FastifyInstance): void {
  app.get(
    "/api/guilds/:guildId/tempvoice",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const config = getGuildConfig(guildId);
      reply.send(config ?? null);
    },
  );

  app.put(
    "/api/guilds/:guildId/tempvoice",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        hubChannelId?: string;
        categoryId?: string | null;
        nameTemplate?: string;
      };

      if (!body.hubChannelId || typeof body.hubChannelId !== "string") {
        reply.code(400).send({ error: "hubChannelId is required" });
        return;
      }

      if (!(await channelExistsInGuild(guildId, body.hubChannelId))) {
        reply.code(400).send({ error: "Invalid hub channel" });
        return;
      }

      if (
        body.categoryId &&
        !(await channelExistsInGuild(guildId, body.categoryId))
      ) {
        reply.code(400).send({ error: "Invalid category channel" });
        return;
      }

      const nameTemplate = body.nameTemplate || "{user}'s Channel";
      if (nameTemplate.length > 100) {
        reply.code(400).send({ error: "Name template too long (max 100)" });
        return;
      }

      await setGuildConfig(guildId, {
        hubChannelId: body.hubChannelId,
        categoryId: body.categoryId ?? null,
        nameTemplate,
      });

      reply.send({ success: true });
    },
  );

  app.delete(
    "/api/guilds/:guildId/tempvoice",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const removed = await removeGuildConfig(guildId);
      reply.send({ success: removed });
    },
  );
}
