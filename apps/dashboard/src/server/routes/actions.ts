import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../middleware.js";
import {
  createRule,
  updateRule,
  deleteRule,
  getRulesByGuild,
  countRules,
  getRecentLogs,
  getAnalytics,
  getLastFiredByGuild,
  bulkUpdateRules,
  bulkDeleteRules,
  getRuleAnalytics,
  notifyCacheInvalidation,
} from "@fluxcore/systems/actions/persistence";
import {
  getGuildSettingsOrDefault,
  setGuildSettings,
} from "@fluxcore/systems/actions/config";
import {
  EVENT_TYPES,
  ACTION_TYPES,
  MAX_ACTIONS_PER_RULE,
  ACTION_TYPE_FIELDS,
  EVENT_TYPE_VARIABLES,
  TEMPLATE_VARIABLES,
} from "@fluxcore/systems/actions/constants";
import type { ActionEventType, ActionType } from "@fluxcore/systems/actions/types";
import { channelExistsInGuild } from "../discordApi.js";

const validEventTypes = new Set(Object.keys(EVENT_TYPES));
const validActionTypes = new Set(Object.keys(ACTION_TYPES));

export function registerActionRoutes(app: FastifyInstance): void {
  // --- Constants (for frontend dropdowns) ---
  app.get(
    "/api/actions/constants",
    { preHandler: [requireAuth] },
    async (_request, reply) => {
      reply.send({
        eventTypes: EVENT_TYPES,
        actionTypes: ACTION_TYPES,
        maxActionsPerRule: MAX_ACTIONS_PER_RULE,
        actionTypeFields: ACTION_TYPE_FIELDS,
        eventTypeVariables: EVENT_TYPE_VARIABLES,
        templateVariables: TEMPLATE_VARIABLES,
      });
    },
  );

  // --- Rules CRUD ---
  app.get(
    "/api/guilds/:guildId/actions/rules",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const [rules, lastFiredMap] = await Promise.all([
        getRulesByGuild(guildId),
        getLastFiredByGuild(guildId),
      ]);
      const enriched = rules.map((rule) => ({
        ...rule,
        lastFired: lastFiredMap.get(rule.id)?.toISOString() ?? null,
      }));
      reply.send(enriched);
    },
  );

  app.post(
    "/api/guilds/:guildId/actions/rules",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        name?: string;
        eventType?: string;
        actions?: Array<{ type: string; [key: string]: unknown }>;
        steps?: Array<{ id: string; type: string; [key: string]: unknown }>;
        entryStepId?: string;
        conditions?: Record<string, string[]>;
        priority?: number;
        enabled?: boolean;
      };

      if (!body.name || typeof body.name !== "string" || body.name.length > 50) {
        reply.code(400).send({ error: "Name is required (max 50 chars)" });
        return;
      }

      if (!body.eventType || !validEventTypes.has(body.eventType)) {
        reply.code(400).send({ error: "Invalid event type" });
        return;
      }

      if (!Array.isArray(body.actions) || body.actions.length === 0) {
        reply.code(400).send({ error: "At least one action is required" });
        return;
      }

      if (body.actions.length > MAX_ACTIONS_PER_RULE) {
        reply
          .code(400)
          .send({ error: `Max ${MAX_ACTIONS_PER_RULE} actions per rule` });
        return;
      }

      for (const action of body.actions) {
        if (!validActionTypes.has(action.type)) {
          reply.code(400).send({ error: `Invalid action type: ${action.type}` });
          return;
        }
        if (action.type === "sendWebhook") {
          const webhook = action.webhook as { url?: string } | undefined;
          if (!webhook?.url) {
            reply.code(400).send({ error: "sendWebhook requires a webhook URL" });
            return;
          }
          try {
            const url = new URL(webhook.url);
            if (url.protocol !== "https:") {
              reply.code(400).send({ error: "Webhook URL must use HTTPS" });
              return;
            }
          } catch {
            reply.code(400).send({ error: "Invalid webhook URL" });
            return;
          }
        }
      }

      // Validate steps if present
      if (body.steps?.length) {
        if (body.steps.length > 10) {
          reply.code(400).send({ error: "Max 10 steps per rule" });
          return;
        }
        const conditionCount = body.steps.filter((s) => s.type === "condition").length;
        if (conditionCount > 3) {
          reply.code(400).send({ error: "Max 3 condition steps per rule" });
          return;
        }
      }

      const settings = getGuildSettingsOrDefault(guildId);
      const count = await countRules(guildId);
      if (count >= settings.maxRules) {
        reply.code(400).send({ error: `Rule limit reached (${settings.maxRules})` });
        return;
      }

      const rule = await createRule({
        guildId,
        name: body.name,
        eventType: body.eventType as ActionEventType,
        actions: body.actions.map((a) => ({
          ...a,
          type: a.type as ActionType,
        })),
        ...(body.steps && body.entryStepId
          ? { steps: body.steps as any, entryStepId: body.entryStepId }
          : {}),
        conditions: body.conditions ?? {},
        priority: body.priority ?? 0,
        enabled: body.enabled ?? true,
        createdBy: request.session!.userId,
      });

      await notifyCacheInvalidation(guildId);
      reply.code(201).send(rule);
    },
  );

  app.put(
    "/api/guilds/:guildId/actions/rules/:ruleId",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, ruleId } = request.params as {
        guildId: string;
        ruleId: string;
      };
      const body = request.body as {
        name?: string;
        eventType?: string;
        actions?: Array<{ type: string; [key: string]: unknown }>;
        steps?: Array<{ id: string; type: string; [key: string]: unknown }>;
        entryStepId?: string;
        conditions?: Record<string, string[]>;
        priority?: number;
        enabled?: boolean;
      };

      if (body.eventType && !validEventTypes.has(body.eventType)) {
        reply.code(400).send({ error: "Invalid event type" });
        return;
      }

      if (body.actions) {
        if (body.actions.length > MAX_ACTIONS_PER_RULE) {
          reply
            .code(400)
            .send({ error: `Max ${MAX_ACTIONS_PER_RULE} actions per rule` });
          return;
        }
        for (const action of body.actions) {
          if (!validActionTypes.has(action.type)) {
            reply
              .code(400)
              .send({ error: `Invalid action type: ${action.type}` });
            return;
          }
          if (action.type === "sendWebhook") {
            const webhook = action.webhook as { url?: string } | undefined;
            if (!webhook?.url) {
              reply.code(400).send({ error: "sendWebhook requires a webhook URL" });
              return;
            }
            try {
              const url = new URL(webhook.url);
              if (url.protocol !== "https:") {
                reply.code(400).send({ error: "Webhook URL must use HTTPS" });
                return;
              }
            } catch {
              reply.code(400).send({ error: "Invalid webhook URL" });
              return;
            }
          }
        }
      }

      if (body.steps?.length) {
        if (body.steps.length > 10) {
          reply.code(400).send({ error: "Max 10 steps per rule" });
          return;
        }
        const conditionCount = body.steps.filter((s) => s.type === "condition").length;
        if (conditionCount > 3) {
          reply.code(400).send({ error: "Max 3 condition steps per rule" });
          return;
        }
      }

      try {
        const updated = await updateRule(Number(ruleId), guildId, {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.eventType !== undefined && {
            eventType: body.eventType as ActionEventType,
          }),
          ...(body.actions !== undefined && {
            actions: body.actions.map((a) => ({
              ...a,
              type: a.type as ActionType,
            })),
          }),
          ...(body.steps && body.entryStepId
            ? { steps: body.steps as any, entryStepId: body.entryStepId }
            : {}),
          ...(body.conditions !== undefined && { conditions: body.conditions }),
          ...(body.priority !== undefined && { priority: body.priority }),
          ...(body.enabled !== undefined && { enabled: body.enabled }),
        });
        await notifyCacheInvalidation(guildId);
        reply.send(updated);
      } catch {
        reply.code(404).send({ error: "Rule not found" });
      }
    },
  );

  app.delete(
    "/api/guilds/:guildId/actions/rules/:ruleId",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, ruleId } = request.params as {
        guildId: string;
        ruleId: string;
      };
      const deleted = await deleteRule(Number(ruleId), guildId);
      if (deleted) {
        await notifyCacheInvalidation(guildId);
      }
      reply.send({ success: deleted });
    },
  );

  // --- Bulk Operations ---
  app.patch(
    "/api/guilds/:guildId/actions/rules/bulk",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        ruleIds?: number[];
        action?: "enable" | "disable" | "delete";
      };

      if (
        !Array.isArray(body.ruleIds) ||
        body.ruleIds.length === 0 ||
        !body.action
      ) {
        reply.code(400).send({ error: "ruleIds and action are required" });
        return;
      }

      if (!["enable", "disable", "delete"].includes(body.action)) {
        reply.code(400).send({ error: "Invalid action" });
        return;
      }

      let count: number;
      if (body.action === "delete") {
        count = await bulkDeleteRules(guildId, body.ruleIds);
      } else {
        count = await bulkUpdateRules(guildId, body.ruleIds, {
          enabled: body.action === "enable",
        });
      }

      await notifyCacheInvalidation(guildId);
      reply.send({ success: true, count });
    },
  );

  // --- Per-Rule Analytics ---
  app.get(
    "/api/guilds/:guildId/actions/rules/:ruleId/analytics",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, ruleId } = request.params as {
        guildId: string;
        ruleId: string;
      };
      const query = request.query as { days?: string };
      const days = Math.min(Math.max(Number(query.days) || 7, 1), 30);
      const analytics = await getRuleAnalytics(guildId, Number(ruleId), days);
      reply.send(analytics);
    },
  );

  // --- Settings ---
  app.get(
    "/api/guilds/:guildId/actions/settings",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      reply.send(getGuildSettingsOrDefault(guildId));
    },
  );

  app.put(
    "/api/guilds/:guildId/actions/settings",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        maxRules?: number;
        globalEnabled?: boolean;
        logChannelId?: string | null;
      };

      const current = getGuildSettingsOrDefault(guildId);

      const maxRules = body.maxRules ?? current.maxRules;
      if (typeof maxRules !== "number" || maxRules < 1 || maxRules > 100) {
        reply.code(400).send({ error: "maxRules must be 1-100" });
        return;
      }

      if (body.logChannelId) {
        if (!(await channelExistsInGuild(guildId, body.logChannelId))) {
          reply.code(400).send({ error: "Invalid log channel" });
          return;
        }
      }

      await setGuildSettings(guildId, {
        maxRules,
        globalEnabled: body.globalEnabled ?? current.globalEnabled,
        logChannelId:
          body.logChannelId !== undefined
            ? body.logChannelId
            : current.logChannelId,
      });

      await notifyCacheInvalidation(guildId, "reloadSettings");
      reply.send({ success: true });
    },
  );

  // --- Analytics ---
  app.get(
    "/api/guilds/:guildId/actions/analytics",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as { days?: string };
      const days = Math.min(Math.max(Number(query.days) || 7, 1), 30);
      const analytics = await getAnalytics(guildId, days);
      reply.send(analytics);
    },
  );

  // --- Logs ---
  app.get(
    "/api/guilds/:guildId/actions/logs",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as { ruleName?: string; limit?: string };
      const logs = await getRecentLogs(guildId, {
        ruleName: query.ruleName,
        limit: query.limit ? Math.min(Number(query.limit), 50) : 20,
      });
      reply.send(logs);
    },
  );
}
