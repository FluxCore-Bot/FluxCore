import type { FastifyInstance } from "fastify";
import { withDocs } from "../../shared/openapi-schemas.js";
import { requireAuth, requireGuildAdmin, requirePermission } from "../../shared/middleware.js";
import {
  getScheduledMessages,
  getScheduledMessageById,
  createScheduledMessage,
  updateScheduledMessage,
  deleteScheduledMessage,
} from "@fluxcore/systems/scheduled-messages/persistence";
import { validateCronExpression, getNextCronRun } from "@fluxcore/systems/scheduled-messages/cron";

function parseIntParam(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function registerScheduledMessageRoutes(app: FastifyInstance): void {
  // GET list scheduled messages
  app.get(
    "/api/guilds/:guildId/scheduled-messages",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("scheduled.messages.view")],
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] }, querystring: { type: "object", properties: { page: { type: "integer", minimum: 1, default: 1 }, limit: { type: "integer", minimum: 1, maximum: 100, default: 20 }, sort: { type: "string" } } } },
        { tag: "ScheduledMessages", response: { 200: { type: "object", additionalProperties: true } } },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as { page?: string; limit?: string };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? Math.min(parseInt(query.limit, 10), 50) : 25;

      const result = await getScheduledMessages(
        guildId,
        Number.isFinite(page) && page > 0 ? page : 1,
        Number.isFinite(limit) && limit > 0 ? limit : 25,
      );
      reply.send(result);
    },
  );

  // POST create scheduled message
  app.post(
    "/api/guilds/:guildId/scheduled-messages",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("scheduled.messages.manage")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            required: ["channelId", "name", "message", "cronExpr"],
            properties: {
              channelId: { type: "string", minLength: 1 },
              name: { type: "string", minLength: 1, maxLength: 100 },
              message: {
                type: "object",
                required: ["type"],
                properties: {
                  type: { type: "string", enum: ["text", "embed"] },
                  content: { type: "string", maxLength: 2000 },
                  embed: { type: "object", additionalProperties: true },
                },
              },
              cronExpr: { type: "string", minLength: 1 },
              timezone: { type: "string" },
              enabled: { type: "boolean" },
            },
            additionalProperties: false,
          },
        },
        { tag: "ScheduledMessages", response: { 201: { type: "object", additionalProperties: true } } },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        channelId: string;
        name: string;
        message: { type: "text" | "embed"; content?: string; embed?: Record<string, unknown> };
        cronExpr: string;
        timezone?: string;
        enabled?: boolean;
      };

      // Validate cron expression
      const cronError = validateCronExpression(body.cronExpr);
      if (cronError) {
        reply.code(400).send({ error: `Invalid cron expression: ${cronError}` });
        return;
      }

      // Get the user ID from the session
      const session = (request as unknown as { session: { userId: string } }).session;

      try {
        const msg = await createScheduledMessage(guildId, {
          channelId: body.channelId,
          name: body.name,
          message: body.message,
          cronExpr: body.cronExpr,
          timezone: body.timezone,
          enabled: body.enabled,
          createdBy: session.userId,
        });
        reply.code(201).send(msg);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Maximum")) {
          reply.code(400).send({ error: error.message });
        } else if (error instanceof Error && error.message.includes("Unique")) {
          reply.code(400).send({ error: "A scheduled message with this name already exists" });
        } else {
          throw error;
        }
      }
    },
  );

  // PUT update scheduled message
  app.put(
    "/api/guilds/:guildId/scheduled-messages/:id",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("scheduled.messages.manage")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            properties: {
              channelId: { type: "string", minLength: 1 },
              name: { type: "string", minLength: 1, maxLength: 100 },
              message: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["text", "embed"] },
                  content: { type: "string", maxLength: 2000 },
                  embed: { type: "object", additionalProperties: true },
                },
              },
              cronExpr: { type: "string", minLength: 1 },
              timezone: { type: "string" },
              enabled: { type: "boolean" },
            },
            additionalProperties: false,
          },
        },
        { tag: "ScheduledMessages", response: { 200: { type: "object", additionalProperties: true } } },
      ),
    },
    async (request, reply) => {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const msgId = parseIntParam(id);
      if (msgId === null) {
        reply.code(400).send({ error: "Invalid message ID" });
        return;
      }

      const body = request.body as {
        channelId?: string;
        name?: string;
        message?: { type: "text" | "embed"; content?: string; embed?: Record<string, unknown> };
        cronExpr?: string;
        timezone?: string;
        enabled?: boolean;
      };

      // Validate cron expression if provided
      if (body.cronExpr) {
        const cronError = validateCronExpression(body.cronExpr);
        if (cronError) {
          reply.code(400).send({ error: `Invalid cron expression: ${cronError}` });
          return;
        }
      }

      const result = await updateScheduledMessage(msgId, guildId, body);
      if (!result) {
        reply.code(404).send({ error: "Scheduled message not found" });
        return;
      }
      reply.send(result);
    },
  );

  // DELETE scheduled message
  app.delete(
    "/api/guilds/:guildId/scheduled-messages/:id",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("scheduled.messages.manage")],
      schema: withDocs({ params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } }, { tag: "ScheduledMessages", response: { 200: { type: "object", properties: { success: { type: "boolean" } } } } }),
    },
    async (request, reply) => {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const msgId = parseIntParam(id);
      if (msgId === null) {
        reply.code(400).send({ error: "Invalid message ID" });
        return;
      }

      const deleted = await deleteScheduledMessage(msgId, guildId);
      if (!deleted) {
        reply.code(404).send({ error: "Scheduled message not found" });
        return;
      }
      reply.send({ success: true });
    },
  );

  // POST test send a scheduled message
  app.post(
    "/api/guilds/:guildId/scheduled-messages/:id/test",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("scheduled.messages.execute")],
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        {
          tag: "ScheduledMessages",
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                channelId: { type: "string" },
                message: {},
              },
            },
          },
        },
      ),
    },
    async (request, reply) => {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const msgId = parseIntParam(id);
      if (msgId === null) {
        reply.code(400).send({ error: "Invalid message ID" });
        return;
      }

      const msg = await getScheduledMessageById(msgId, guildId);
      if (!msg) {
        reply.code(404).send({ error: "Scheduled message not found" });
        return;
      }

      // Return the message data for the bot to send (test send is informational)
      reply.send({
        success: true,
        channelId: msg.channelId,
        message: msg.message,
      });
    },
  );

  // GET preview next run time for a cron expression
  app.get(
    "/api/guilds/:guildId/scheduled-messages/preview-cron",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("scheduled.messages.view")],
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        {
          tag: "ScheduledMessages",
          response: {
            200: {
              type: "object",
              properties: { nextRuns: { type: "array", items: { type: "string" } } },
            },
          },
        },
      ),
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "10 seconds",
          keyGenerator: (req) =>
            (req as { session?: { userId?: string } }).session?.userId ?? req.ip,
        },
      },
    },
    async (request, reply) => {
      const query = request.query as { cronExpr?: string; timezone?: string };
      if (!query.cronExpr) {
        reply.code(400).send({ error: "cronExpr query parameter is required" });
        return;
      }

      const cronError = validateCronExpression(query.cronExpr);
      if (cronError) {
        reply.code(400).send({ error: `Invalid cron expression: ${cronError}` });
        return;
      }

      const timezone = query.timezone ?? "UTC";
      const budgetMs = 250;
      const start = Date.now();

      try {
        const nextRun = getNextCronRun(query.cronExpr, timezone);
        if (Date.now() - start > budgetMs) {
          reply
            .code(400)
            .send({ error: "Cron expression too slow to evaluate (budget exceeded)" });
          return;
        }
        const nextRuns: string[] = [nextRun.toISOString()];
        let lastRun = nextRun;
        for (let i = 0; i < 4; i++) {
          if (Date.now() - start > budgetMs) {
            reply
              .code(400)
              .send({ error: "Cron expression too slow to evaluate (budget exceeded)" });
            return;
          }
          const next = getNextCronRun(query.cronExpr, timezone, lastRun);
          nextRuns.push(next.toISOString());
          lastRun = next;
        }
        reply.send({ nextRuns });
      } catch {
        reply.code(400).send({ error: "Failed to evaluate cron expression" });
      }
    },
  );
}
