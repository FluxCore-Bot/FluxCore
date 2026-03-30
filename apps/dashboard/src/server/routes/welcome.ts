import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin, requirePermission } from "../middleware.js";
import { getWelcomeConfig, upsertWelcomeConfig } from "@fluxcore/systems/welcome/config";

export function registerWelcomeRoutes(app: FastifyInstance): void {
  // GET full welcome config
  app.get(
    "/api/guilds/:guildId/welcome",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.config.view")] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const config = await getWelcomeConfig(guildId);
      reply.send(config ?? {
        guildId,
        welcomeEnabled: false,
        welcomeChannelId: null,
        welcomeMessage: {},
        farewellEnabled: false,
        farewellChannelId: null,
        farewellMessage: {},
        dmEnabled: false,
        dmMessage: {},
        autoRoleIds: [],
      });
    },
  );

  // PUT update welcome config
  app.put(
    "/api/guilds/:guildId/welcome",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.config.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            welcomeEnabled: { type: "boolean" },
            welcomeChannelId: { type: ["string", "null"] },
            welcomeMessage: { type: "object" },
            farewellEnabled: { type: "boolean" },
            farewellChannelId: { type: ["string", "null"] },
            farewellMessage: { type: "object" },
            dmEnabled: { type: "boolean" },
            dmMessage: { type: "object" },
            autoRoleIds: { type: "array", items: { type: "string" } },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        welcomeEnabled?: boolean;
        welcomeChannelId?: string | null;
        welcomeMessage?: Record<string, unknown>;
        farewellEnabled?: boolean;
        farewellChannelId?: string | null;
        farewellMessage?: Record<string, unknown>;
        dmEnabled?: boolean;
        dmMessage?: Record<string, unknown>;
        autoRoleIds?: string[];
      };

      const update: Record<string, unknown> = {};
      if (body.welcomeEnabled !== undefined) update.welcomeEnabled = body.welcomeEnabled;
      if (body.welcomeChannelId !== undefined) update.welcomeChannelId = body.welcomeChannelId;
      if (body.welcomeMessage !== undefined) update.welcomeMessage = body.welcomeMessage;
      if (body.farewellEnabled !== undefined) update.farewellEnabled = body.farewellEnabled;
      if (body.farewellChannelId !== undefined) update.farewellChannelId = body.farewellChannelId;
      if (body.farewellMessage !== undefined) update.farewellMessage = body.farewellMessage;
      if (body.dmEnabled !== undefined) update.dmEnabled = body.dmEnabled;
      if (body.dmMessage !== undefined) update.dmMessage = body.dmMessage;
      if (body.autoRoleIds !== undefined) update.autoRoleIds = body.autoRoleIds;

      const config = await upsertWelcomeConfig(guildId, update);
      reply.send(config);
    },
  );

  // POST test welcome message
  app.post(
    "/api/guilds/:guildId/welcome/test",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.test.execute")] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const config = await getWelcomeConfig(guildId);

      if (!config || !config.welcomeEnabled) {
        reply.code(400).send({ error: "Welcome messages are not enabled" });
        return;
      }

      if (!config.welcomeChannelId) {
        reply.code(400).send({ error: "No welcome channel configured" });
        return;
      }

      // Test message is sent via the bot, not the dashboard.
      // Return success so the dashboard can indicate it was triggered.
      reply.send({ success: true, channelId: config.welcomeChannelId });
    },
  );
}
