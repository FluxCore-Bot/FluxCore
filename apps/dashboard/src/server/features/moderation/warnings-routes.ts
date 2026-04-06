import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin, requirePermission } from "../../shared/middleware.js";
import {
  createWarning,
  getWarnings,
  deleteWarning,
  deleteAllWarnings,
} from "@fluxcore/systems/warnings/persistence";
import {
  getWarnSettings,
  upsertWarnSettings,
  getPunishments,
  addPunishment,
  removePunishment,
} from "@fluxcore/systems/warnings/config";
import { MAX_REASON_LENGTH, VALID_ESCALATION_ACTIONS } from "@fluxcore/systems/warnings/constants";

function parseIntParam(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function registerWarningRoutes(app: FastifyInstance): void {
  // GET warnings for a guild (filterable by userId)
  app.get(
    "/api/guilds/:guildId/warnings",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("moderation.warnings.view")] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as { userId?: string; page?: string; limit?: string };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? Math.min(parseInt(query.limit, 10), 50) : 10;

      const result = await getWarnings(
        guildId,
        query.userId || undefined,
        Number.isFinite(page) && page > 0 ? page : 1,
        Number.isFinite(limit) && limit > 0 ? limit : 10,
      );
      reply.send(result);
    },
  );

  // POST create a warning
  app.post(
    "/api/guilds/:guildId/warnings",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("moderation.warnings.manage")],
      schema: {
        body: {
          type: "object",
          required: ["userId", "reason"],
          properties: {
            userId: { type: "string", minLength: 1 },
            reason: { type: "string", minLength: 1, maxLength: MAX_REASON_LENGTH },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as { userId: string; reason: string };

      const warning = await createWarning({
        guildId,
        userId: body.userId,
        moderatorId: request.session!.userId,
        reason: body.reason,
      });

      reply.code(201).send(warning);
    },
  );

  // DELETE a specific warning
  app.delete(
    "/api/guilds/:guildId/warnings/:warningId",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("moderation.warnings.manage")] },
    async (request, reply) => {
      const { guildId, warningId } = request.params as { guildId: string; warningId: string };
      const id = parseIntParam(warningId);
      if (id === null) {
        reply.code(400).send({ error: "Invalid warning ID" });
        return;
      }
      await deleteWarning(id, guildId);
      reply.send({ success: true });
    },
  );

  // DELETE all warnings for a user
  app.delete(
    "/api/guilds/:guildId/warnings/user/:userId",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("moderation.warnings.manage")] },
    async (request, reply) => {
      const { guildId, userId } = request.params as { guildId: string; userId: string };
      const count = await deleteAllWarnings(guildId, userId);
      reply.send({ success: true, count });
    },
  );

  // GET punishment config
  app.get(
    "/api/guilds/:guildId/warn-punishments",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("moderation.punishments.manage")] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const punishments = await getPunishments(guildId);
      reply.send(punishments);
    },
  );

  // POST add punishment threshold
  app.post(
    "/api/guilds/:guildId/warn-punishments",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("moderation.punishments.manage")],
      schema: {
        body: {
          type: "object",
          required: ["threshold", "action"],
          properties: {
            threshold: { type: "integer", minimum: 1 },
            action: { type: "string", enum: [...VALID_ESCALATION_ACTIONS] },
            duration: { type: ["integer", "null"], minimum: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as { threshold: number; action: string; duration?: number | null };

      try {
        const punishment = await addPunishment(guildId, body.threshold, body.action, body.duration);
        reply.code(201).send(punishment);
      } catch {
        reply.code(400).send({ error: "A punishment at this threshold already exists" });
      }
    },
  );

  // DELETE a punishment
  app.delete(
    "/api/guilds/:guildId/warn-punishments/:id",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("moderation.punishments.manage")] },
    async (request, reply) => {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const punishmentId = parseIntParam(id);
      if (punishmentId === null) {
        reply.code(400).send({ error: "Invalid punishment ID" });
        return;
      }
      await removePunishment(punishmentId, guildId);
      reply.send({ success: true });
    },
  );

  // GET warn settings
  app.get(
    "/api/guilds/:guildId/warn-settings",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("moderation.punishments.manage")] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const settings = await getWarnSettings(guildId);
      reply.send(settings);
    },
  );

  // PUT update warn settings
  app.put(
    "/api/guilds/:guildId/warn-settings",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("moderation.punishments.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            dmOnWarn: { type: "boolean" },
            reasonRequired: { type: "boolean" },
            maxWarnings: { type: "integer", minimum: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        dmOnWarn?: boolean;
        reasonRequired?: boolean;
        maxWarnings?: number;
      };

      const update: Record<string, unknown> = {};
      if (body.dmOnWarn !== undefined) update.dmOnWarn = body.dmOnWarn;
      if (body.reasonRequired !== undefined) update.reasonRequired = body.reasonRequired;
      if (body.maxWarnings !== undefined) update.maxWarnings = body.maxWarnings;

      const settings = await upsertWarnSettings(guildId, update);
      reply.send(settings);
    },
  );
}
