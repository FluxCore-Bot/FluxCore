import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../middleware.js";
import {
  getModCases,
  getModCaseById,
  updateModCase,
  deleteModCase,
  getModSettings,
  upsertModSettings,
} from "@fluxcore/systems/moderation/persistence";
import { VALID_MOD_ACTIONS, MAX_REASON_LENGTH } from "@fluxcore/systems/moderation/constants";

function parseIntParam(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function registerModerationRoutes(app: FastifyInstance): void {
  // GET /api/guilds/:guildId/cases — list cases
  app.get(
    "/api/guilds/:guildId/cases",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as {
        userId?: string;
        action?: string;
        page?: string;
        limit?: string;
      };

      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 10;

      if (query.action && !VALID_MOD_ACTIONS.includes(query.action as (typeof VALID_MOD_ACTIONS)[number])) {
        reply.code(400).send({ error: "Invalid action filter" });
        return;
      }

      const result = await getModCases(guildId, {
        targetId: query.userId,
        action: query.action,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        limit: Number.isFinite(limit) && limit > 0 && limit <= 50 ? limit : 10,
      });

      reply.send(result);
    },
  );

  // GET /api/guilds/:guildId/cases/:caseId — get single case
  app.get(
    "/api/guilds/:guildId/cases/:caseId",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, caseId } = request.params as { guildId: string; caseId: string };
      const caseIdNum = parseIntParam(caseId);
      if (caseIdNum === null) {
        reply.code(400).send({ error: "Invalid case ID" });
        return;
      }

      const modCase = await getModCaseById(caseIdNum, guildId);
      if (!modCase) {
        reply.code(404).send({ error: "Case not found" });
        return;
      }

      reply.send(modCase);
    },
  );

  // PUT /api/guilds/:guildId/cases/:caseId — edit reason
  app.put(
    "/api/guilds/:guildId/cases/:caseId",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: {
        body: {
          type: "object",
          required: ["reason"],
          properties: {
            reason: { type: "string", minLength: 1, maxLength: MAX_REASON_LENGTH },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId, caseId } = request.params as { guildId: string; caseId: string };
      const body = request.body as { reason: string };

      const caseIdNum = parseIntParam(caseId);
      if (caseIdNum === null) {
        reply.code(400).send({ error: "Invalid case ID" });
        return;
      }

      const existing = await getModCaseById(caseIdNum, guildId);
      if (!existing) {
        reply.code(404).send({ error: "Case not found" });
        return;
      }

      const updated = await updateModCase(caseIdNum, guildId, { reason: body.reason });
      reply.send(updated);
    },
  );

  // DELETE /api/guilds/:guildId/cases/:caseId — delete case
  app.delete(
    "/api/guilds/:guildId/cases/:caseId",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, caseId } = request.params as { guildId: string; caseId: string };
      const caseIdNum = parseIntParam(caseId);
      if (caseIdNum === null) {
        reply.code(400).send({ error: "Invalid case ID" });
        return;
      }

      const existing = await getModCaseById(caseIdNum, guildId);
      if (!existing) {
        reply.code(404).send({ error: "Case not found" });
        return;
      }

      await deleteModCase(caseIdNum, guildId);
      reply.send({ success: true });
    },
  );

  // GET /api/guilds/:guildId/mod-settings
  app.get(
    "/api/guilds/:guildId/mod-settings",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const settings = await getModSettings(guildId);
      reply.send(settings);
    },
  );

  // PUT /api/guilds/:guildId/mod-settings
  app.put(
    "/api/guilds/:guildId/mod-settings",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: {
        body: {
          type: "object",
          properties: {
            dmOnPunishment: { type: "boolean" },
            modLogChannelId: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        dmOnPunishment?: boolean;
        modLogChannelId?: string | null;
      };

      const update: Record<string, unknown> = {};
      if (body.dmOnPunishment !== undefined) update.dmOnPunishment = body.dmOnPunishment;
      if (body.modLogChannelId !== undefined) update.modLogChannelId = body.modLogChannelId;

      const settings = await upsertModSettings(guildId, update);
      reply.send(settings);
    },
  );
}
