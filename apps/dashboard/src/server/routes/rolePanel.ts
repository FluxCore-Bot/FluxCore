import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin, requirePermission } from "../middleware.js";
import {
  getRolePanels,
  getRolePanel,
  createRolePanel,
  updateRolePanel,
  deleteRolePanel,
} from "@fluxcore/systems/rolePanel/persistence";
import {
  MAX_ROLES_PER_PANEL,
  VALID_PANEL_TYPES,
  VALID_PANEL_MODES,
} from "@fluxcore/systems/rolePanel/constants";

function parseIntParam(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function registerRolePanelRoutes(app: FastifyInstance): void {
  // GET all panels for a guild
  app.get(
    "/api/guilds/:guildId/role-panels",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("roles.panels.view")] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const panels = await getRolePanels(guildId);
      reply.send(panels);
    },
  );

  // POST create a panel
  app.post(
    "/api/guilds/:guildId/role-panels",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("roles.panels.manage")],
      schema: {
        body: {
          type: "object",
          required: ["name", "type", "channelId"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            type: { type: "string", enum: [...VALID_PANEL_TYPES] },
            mode: { type: "string", enum: [...VALID_PANEL_MODES] },
            channelId: { type: "string", minLength: 1 },
            embed: { type: "string" },
            roles: {
              type: "array",
              maxItems: MAX_ROLES_PER_PANEL,
              items: {
                type: "object",
                required: ["roleId", "label"],
                properties: {
                  roleId: { type: "string", minLength: 1 },
                  label: { type: "string", minLength: 1, maxLength: 80 },
                  emoji: { type: "string" },
                  description: { type: "string", maxLength: 100 },
                  style: { type: "integer", minimum: 1, maximum: 4 },
                },
                additionalProperties: false,
              },
            },
            maxRoles: { type: ["integer", "null"], minimum: 1 },
            minRoles: { type: ["integer", "null"], minimum: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        name: string;
        type: string;
        mode?: string;
        channelId: string;
        embed?: string;
        roles?: Array<{
          roleId: string;
          label: string;
          emoji?: string;
          description?: string;
          style?: number;
        }>;
        maxRoles?: number;
        minRoles?: number;
      };

      const panel = await createRolePanel({
        guildId,
        channelId: body.channelId,
        name: body.name,
        type: body.type as "reaction" | "button" | "dropdown",
        mode: (body.mode as "toggle" | "unique" | "verify") ?? "toggle",
        embed: body.embed,
        roles: body.roles,
        maxRoles: body.maxRoles,
        minRoles: body.minRoles,
        createdBy: request.session!.userId,
      });

      reply.code(201).send(panel);
    },
  );

  // PUT update a panel
  app.put(
    "/api/guilds/:guildId/role-panels/:panelId",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("roles.panels.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            type: { type: "string", enum: [...VALID_PANEL_TYPES] },
            mode: { type: "string", enum: [...VALID_PANEL_MODES] },
            channelId: { type: "string", minLength: 1 },
            embed: { type: "string" },
            roles: {
              type: "array",
              maxItems: MAX_ROLES_PER_PANEL,
              items: {
                type: "object",
                required: ["roleId", "label"],
                properties: {
                  roleId: { type: "string", minLength: 1 },
                  label: { type: "string", minLength: 1, maxLength: 80 },
                  emoji: { type: "string" },
                  description: { type: "string", maxLength: 100 },
                  style: { type: "integer", minimum: 1, maximum: 4 },
                },
                additionalProperties: false,
              },
            },
            maxRoles: { type: ["integer", "null"], minimum: 1 },
            minRoles: { type: ["integer", "null"], minimum: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId, panelId } = request.params as { guildId: string; panelId: string };
      const id = parseIntParam(panelId);
      if (id === null) {
        reply.code(400).send({ error: "Invalid panel ID" });
        return;
      }

      const body = request.body as {
        name?: string;
        type?: string;
        mode?: string;
        channelId?: string;
        embed?: string;
        roles?: Array<{
          roleId: string;
          label: string;
          emoji?: string;
          description?: string;
          style?: number;
        }>;
        maxRoles?: number | null;
        minRoles?: number | null;
      };

      const updated = await updateRolePanel(id, guildId, {
        name: body.name,
        channelId: body.channelId,
        type: body.type as "reaction" | "button" | "dropdown" | undefined,
        mode: body.mode as "toggle" | "unique" | "verify" | undefined,
        embed: body.embed,
        roles: body.roles,
        maxRoles: body.maxRoles,
        minRoles: body.minRoles,
      });

      if (!updated) {
        reply.code(404).send({ error: "Panel not found" });
        return;
      }

      reply.send(updated);
    },
  );

  // DELETE a panel
  app.delete(
    "/api/guilds/:guildId/role-panels/:panelId",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("roles.panels.manage")] },
    async (request, reply) => {
      const { guildId, panelId } = request.params as { guildId: string; panelId: string };
      const id = parseIntParam(panelId);
      if (id === null) {
        reply.code(400).send({ error: "Invalid panel ID" });
        return;
      }

      const deleted = await deleteRolePanel(id, guildId);
      if (!deleted) {
        reply.code(404).send({ error: "Panel not found" });
        return;
      }

      reply.send({ success: true });
    },
  );

  // POST send/resend panel message
  app.post(
    "/api/guilds/:guildId/role-panels/:panelId/send",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("roles.panels.manage")] },
    async (request, reply) => {
      const { guildId, panelId } = request.params as { guildId: string; panelId: string };
      const id = parseIntParam(panelId);
      if (id === null) {
        reply.code(400).send({ error: "Invalid panel ID" });
        return;
      }

      const panel = await getRolePanel(id);
      if (!panel || panel.guildId !== guildId) {
        reply.code(404).send({ error: "Panel not found" });
        return;
      }

      if (panel.roles.length === 0) {
        reply.code(400).send({ error: "Panel has no roles configured" });
        return;
      }

      // Return panel data for the bot to handle sending
      // The actual Discord message sending requires the bot client,
      // which is not available in the dashboard server.
      reply.send({
        success: true,
        message: "Panel is ready to send. Use /rolepanel send in Discord.",
        panel,
      });
    },
  );
}
