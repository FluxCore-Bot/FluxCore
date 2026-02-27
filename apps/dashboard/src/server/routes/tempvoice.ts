import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../middleware.js";
import {
  getGuildConfigs,
  addGuildConfig,
  updateGuildConfig,
  removeGuildConfig,
  getConfigByHubChannel,
} from "@fluxcore/systems/tempVoice/config";
import { MAX_TEMPVOICE_CONFIGS_PER_GUILD } from "@fluxcore/systems/tempVoice/constants";
import { channelExistsInGuild } from "../discordApi.js";

export function registerTempVoiceRoutes(app: FastifyInstance): void {
  // GET all configs for a guild
  app.get(
    "/api/guilds/:guildId/tempvoice",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const configs = getGuildConfigs(guildId);
      reply.send(configs);
    },
  );

  // POST create a new config
  app.post(
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

      if (getConfigByHubChannel(body.hubChannelId)) {
        reply.code(400).send({ error: "This channel is already a temp voice hub" });
        return;
      }

      const existing = getGuildConfigs(guildId);
      if (existing.length >= MAX_TEMPVOICE_CONFIGS_PER_GUILD) {
        reply.code(400).send({
          error: `Config limit reached (max ${MAX_TEMPVOICE_CONFIGS_PER_GUILD})`,
        });
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

      const config = await addGuildConfig(guildId, {
        hubChannelId: body.hubChannelId,
        categoryId: body.categoryId ?? null,
        nameTemplate,
      });

      reply.code(201).send(config);
    },
  );

  // PUT update an existing config
  app.put(
    "/api/guilds/:guildId/tempvoice/:configId",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, configId } = request.params as {
        guildId: string;
        configId: string;
      };
      const body = request.body as {
        hubChannelId?: string;
        categoryId?: string | null;
        nameTemplate?: string;
      };

      if (body.hubChannelId) {
        if (!(await channelExistsInGuild(guildId, body.hubChannelId))) {
          reply.code(400).send({ error: "Invalid hub channel" });
          return;
        }
        const existingHub = getConfigByHubChannel(body.hubChannelId);
        if (existingHub && existingHub.id !== Number(configId)) {
          reply
            .code(400)
            .send({ error: "This channel is already a temp voice hub" });
          return;
        }
      }

      if (
        body.categoryId &&
        !(await channelExistsInGuild(guildId, body.categoryId))
      ) {
        reply.code(400).send({ error: "Invalid category channel" });
        return;
      }

      if (body.nameTemplate && body.nameTemplate.length > 100) {
        reply.code(400).send({ error: "Name template too long (max 100)" });
        return;
      }

      try {
        const updated = await updateGuildConfig(guildId, Number(configId), {
          ...(body.hubChannelId !== undefined && {
            hubChannelId: body.hubChannelId,
          }),
          ...(body.categoryId !== undefined && {
            categoryId: body.categoryId,
          }),
          ...(body.nameTemplate !== undefined && {
            nameTemplate: body.nameTemplate,
          }),
        });
        reply.send(updated);
      } catch {
        reply.code(404).send({ error: "Config not found" });
      }
    },
  );

  // DELETE a specific config
  app.delete(
    "/api/guilds/:guildId/tempvoice/:configId",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, configId } = request.params as {
        guildId: string;
        configId: string;
      };
      const removed = await removeGuildConfig(guildId, Number(configId));
      reply.send({ success: removed });
    },
  );
}
