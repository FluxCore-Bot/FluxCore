import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../middleware.js";
import {
  createRule,
  updateRule,
  deleteRule,
  getRulesByGuild,
  countRules,
  getRecentLogs,
} from "@fluxcore/systems/actions/persistence";
import {
  addRuleToCache,
  updateRuleInCache,
  removeRuleFromCache,
} from "@fluxcore/systems/actions/cache";
import {
  getGuildSettingsOrDefault,
  setGuildSettings,
} from "@fluxcore/systems/actions/config";
import {
  EVENT_TYPES,
  ACTION_TYPES,
  MAX_ACTIONS_PER_RULE,
} from "@fluxcore/systems/actions/constants";
import type { ActionEventType, ActionType } from "@fluxcore/systems/actions/types";

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
      });
    },
  );

  // --- Rules CRUD ---
  app.get(
    "/api/guilds/:guildId/actions/rules",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const rules = await getRulesByGuild(guildId);
      reply.send(rules);
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
        conditions: body.conditions ?? {},
        priority: body.priority ?? 0,
        enabled: body.enabled ?? true,
        createdBy: request.session!.userId,
      });

      addRuleToCache(rule);
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
          ...(body.conditions !== undefined && { conditions: body.conditions }),
          ...(body.priority !== undefined && { priority: body.priority }),
          ...(body.enabled !== undefined && { enabled: body.enabled }),
        });
        updateRuleInCache(updated);
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
        removeRuleFromCache(guildId, Number(ruleId));
      }
      reply.send({ success: deleted });
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
        const guild = request.discordClient!.guilds.cache.get(guildId);
        if (!guild?.channels.cache.has(body.logChannelId)) {
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

      reply.send({ success: true });
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
