import type { FastifyInstance } from "fastify";
import { withDocs } from "../../shared/openapi-schemas.js";
import { requireAuth, requireGuildAdmin, requirePermission } from "../../shared/middleware.js";
import {
  getLevelSettings,
  upsertLevelSettings,
  getLevelRewards,
  addLevelReward,
  removeLevelReward,
} from "@fluxcore/systems/leveling/config";
import {
  getLeaderboard,
  getUserLevel,
  setXp,
  getUserRank,
} from "@fluxcore/systems/leveling/persistence";
import { LEADERBOARD_PAGE_SIZE } from "@fluxcore/systems/leveling/constants";

function parseIntParam(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function registerLevelingRoutes(app: FastifyInstance): void {
  // GET leaderboard
  app.get(
    "/api/guilds/:guildId/leaderboard",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("leveling.leaderboard.view")],
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] }, querystring: { type: "object", properties: { page: { type: "integer", minimum: 1, default: 1 }, limit: { type: "integer", minimum: 1, maximum: 100, default: 20 }, sort: { type: "string" } } } },
        { tag: "Leveling", response: { 200: { type: "object", additionalProperties: true } } },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as { page?: string; limit?: string };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? Math.min(parseInt(query.limit, 10), 50) : LEADERBOARD_PAGE_SIZE;

      const result = await getLeaderboard(
        guildId,
        Number.isFinite(page) && page > 0 ? page : 1,
        Number.isFinite(limit) && limit > 0 ? limit : LEADERBOARD_PAGE_SIZE,
      );
      reply.send(result);
    },
  );

  // GET user level info
  app.get(
    "/api/guilds/:guildId/levels/:userId",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("leveling.leaderboard.view")],
      schema: withDocs({ params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } }, { tag: "Leveling", response: { 200: { type: "object", additionalProperties: true } } }),
    },
    async (request, reply) => {
      const { guildId, userId } = request.params as { guildId: string; userId: string };
      const userLevel = await getUserLevel(guildId, userId);
      const rank = await getUserRank(guildId, userId);

      if (!userLevel) {
        reply.send({
          guildId,
          userId,
          xp: 0,
          level: 0,
          messageCount: 0,
          voiceMinutes: 0,
          rank: 0,
        });
        return;
      }

      reply.send({ ...userLevel, rank });
    },
  );

  // PUT admin set XP
  app.put(
    "/api/guilds/:guildId/levels/:userId",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("leveling.users.manage")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            required: ["xp"],
            properties: {
              xp: { type: "integer", minimum: 0 },
            },
            additionalProperties: false,
          },
        },
        { tag: "Leveling", response: { 200: { type: "object", additionalProperties: true } } },
      ),
    },
    async (request, reply) => {
      const { guildId, userId } = request.params as { guildId: string; userId: string };
      const body = request.body as { xp: number };
      const result = await setXp(guildId, userId, body.xp);
      reply.send(result);
    },
  );

  // GET level settings
  app.get(
    "/api/guilds/:guildId/level-settings",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("leveling.settings.manage")],
      schema: withDocs({ params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } }, { tag: "Leveling", response: { 200: { type: "object", additionalProperties: true } } }),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const settings = await getLevelSettings(guildId);
      reply.send(settings);
    },
  );

  // PUT update level settings
  app.put(
    "/api/guilds/:guildId/level-settings",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("leveling.settings.manage")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              xpPerMessage: { type: "integer", minimum: 1, maximum: 1000 },
              xpCooldownSeconds: { type: "integer", minimum: 0, maximum: 3600 },
              voiceXpPerMinute: { type: "integer", minimum: 0, maximum: 100 },
              voiceXpEnabled: { type: "boolean" },
              announceChannel: { type: ["string", "null"] },
              announceMessage: { type: "string", minLength: 1, maxLength: 500 },
              announceEnabled: { type: "boolean" },
              noXpChannels: { type: "array", items: { type: "string" } },
              noXpRoles: { type: "array", items: { type: "string" } },
              xpMultipliers: { type: "object", additionalProperties: true },
            },
            additionalProperties: false,
          },
        },
        {
          tag: "Leveling",
          response: {
            200: {
              type: "object",
              properties: {
                guildId: { type: "string" },
                enabled: { type: "boolean" },
                xpPerMessage: { type: "integer" },
                xpCooldownSeconds: { type: "integer" },
                voiceXpPerMinute: { type: "integer" },
                voiceXpEnabled: { type: "boolean" },
                announceChannel: { type: ["string", "null"] },
                announceMessage: { type: ["string", "null"] },
                announceEnabled: { type: "boolean" },
                noXpChannels: { type: "array", items: { type: "string" } },
                noXpRoles: { type: "array", items: { type: "string" } },
                xpMultipliers: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Partial<{
        enabled: boolean;
        xpPerMessage: number;
        xpCooldownSeconds: number;
        voiceXpPerMinute: number;
        voiceXpEnabled: boolean;
        announceChannel: string | null;
        announceMessage: string;
        announceEnabled: boolean;
        noXpChannels: string[];
        noXpRoles: string[];
        xpMultipliers: Record<string, unknown>;
      }>;

      const settings = await upsertLevelSettings(guildId, body);
      reply.send(settings);
    },
  );

  // GET level rewards
  app.get(
    "/api/guilds/:guildId/level-rewards",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("leveling.rewards.manage")],
      schema: withDocs({ params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } }, { tag: "Leveling", response: { 200: { type: "array", items: {} } } }),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const rewards = await getLevelRewards(guildId);
      reply.send(rewards);
    },
  );

  // POST add level reward
  app.post(
    "/api/guilds/:guildId/level-rewards",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("leveling.rewards.manage")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            required: ["level", "roleId"],
            properties: {
              level: { type: "integer", minimum: 1, maximum: 100 },
              roleId: { type: "string", minLength: 1 },
            },
            additionalProperties: false,
          },
        },
        {
          tag: "Leveling",
          response: {
            201: {
              type: "object",
              properties: {
                id: { type: "integer" },
                guildId: { type: "string" },
                level: { type: "integer" },
                roleId: { type: "string" },
              },
            },
          },
        },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as { level: number; roleId: string };

      try {
        const reward = await addLevelReward(guildId, body.level, body.roleId);
        reply.code(201).send(reward);
      } catch {
        reply.code(400).send({ error: "A reward for this level and role already exists" });
      }
    },
  );

  // DELETE level reward
  app.delete(
    "/api/guilds/:guildId/level-rewards/:id",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("leveling.rewards.manage")],
      schema: withDocs({ params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } }, { tag: "Leveling", response: { 200: { type: "object", properties: { success: { type: "boolean" } } } } }),
    },
    async (request, reply) => {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const rewardId = parseIntParam(id);
      if (rewardId === null) {
        reply.code(400).send({ error: "Invalid reward ID" });
        return;
      }
      await removeLevelReward(rewardId, guildId);
      reply.send({ success: true });
    },
  );
}
