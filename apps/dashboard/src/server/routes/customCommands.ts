import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../middleware.js";
import {
  getCustomCommands,
  getCustomCommandCount,
  createCustomCommand,
  updateCustomCommand,
  deleteCustomCommand,
} from "@fluxcore/systems/customCommands/persistence";
import { MAX_COMMANDS_PER_GUILD } from "@fluxcore/systems/customCommands/constants";
import { TRIGGER_TYPES } from "@fluxcore/systems/customCommands/constants";

function parseIntParam(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function registerCustomCommandRoutes(app: FastifyInstance): void {
  // GET list custom commands
  app.get(
    "/api/guilds/:guildId/custom-commands",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const commands = await getCustomCommands(guildId);
      reply.send(commands);
    },
  );

  // POST create custom command
  app.post(
    "/api/guilds/:guildId/custom-commands",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: {
        body: {
          type: "object",
          required: ["name", "triggerType"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            triggerType: { type: "string", enum: [...TRIGGER_TYPES] },
            response: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["text", "embed"] },
                content: { type: "string", maxLength: 2000 },
                embed: {
                  type: "object",
                  properties: {
                    title: { type: "string", maxLength: 256 },
                    description: { type: "string", maxLength: 4096 },
                    color: { type: "integer" },
                    footer: { type: "string", maxLength: 2048 },
                    thumbnail: { type: "string", maxLength: 2000 },
                    image: { type: "string", maxLength: 2000 },
                  },
                  additionalProperties: false,
                },
              },
              additionalProperties: false,
            },
            actions: {
              type: "array",
              maxItems: 5,
              items: {
                type: "object",
                required: ["type", "roleId"],
                properties: {
                  type: { type: "string", enum: ["addRole", "removeRole"] },
                  roleId: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
              },
            },
            enabled: { type: "boolean" },
            cooldown: { type: "integer", minimum: 0, maximum: 3600 },
            allowedRoles: { type: "array", items: { type: "string" } },
            allowedChannels: { type: "array", items: { type: "string" } },
            deletesTrigger: { type: "boolean" },
            dmResponse: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        name: string;
        triggerType: string;
        response?: { type: "text" | "embed"; content?: string; embed?: Record<string, unknown> };
        actions?: { type: "addRole" | "removeRole"; roleId: string }[];
        enabled?: boolean;
        cooldown?: number;
        allowedRoles?: string[];
        allowedChannels?: string[];
        deletesTrigger?: boolean;
        dmResponse?: boolean;
      };

      // Check guild limit
      const count = await getCustomCommandCount(guildId);
      if (count >= MAX_COMMANDS_PER_GUILD) {
        reply.code(400).send({
          error: `Maximum of ${MAX_COMMANDS_PER_GUILD} custom commands per guild`,
        });
        return;
      }

      // Validate regex if trigger type is regex
      if (body.triggerType === "regex") {
        try {
          new RegExp(body.name, "i");
        } catch {
          reply.code(400).send({ error: "Invalid regex pattern" });
          return;
        }
      }

      try {
        const session = (request as unknown as Record<string, unknown>).session as { userId: string };
        const command = await createCustomCommand({
          guildId,
          name: body.name,
          triggerType: body.triggerType,
          response: body.response,
          actions: body.actions,
          enabled: body.enabled,
          cooldown: body.cooldown,
          allowedRoles: body.allowedRoles,
          allowedChannels: body.allowedChannels,
          deletesTrigger: body.deletesTrigger,
          dmResponse: body.dmResponse,
          createdBy: session.userId,
        });
        reply.code(201).send(command);
      } catch {
        reply.code(400).send({ error: "A command with this name already exists" });
      }
    },
  );

  // PUT update custom command
  app.put(
    "/api/guilds/:guildId/custom-commands/:id",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            triggerType: { type: "string", enum: [...TRIGGER_TYPES] },
            response: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["text", "embed"] },
                content: { type: "string", maxLength: 2000 },
                embed: {
                  type: "object",
                  properties: {
                    title: { type: "string", maxLength: 256 },
                    description: { type: "string", maxLength: 4096 },
                    color: { type: "integer" },
                    footer: { type: "string", maxLength: 2048 },
                    thumbnail: { type: "string", maxLength: 2000 },
                    image: { type: "string", maxLength: 2000 },
                  },
                  additionalProperties: false,
                },
              },
              additionalProperties: false,
            },
            actions: {
              type: "array",
              maxItems: 5,
              items: {
                type: "object",
                required: ["type", "roleId"],
                properties: {
                  type: { type: "string", enum: ["addRole", "removeRole"] },
                  roleId: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
              },
            },
            enabled: { type: "boolean" },
            cooldown: { type: "integer", minimum: 0, maximum: 3600 },
            allowedRoles: { type: "array", items: { type: "string" } },
            allowedChannels: { type: "array", items: { type: "string" } },
            deletesTrigger: { type: "boolean" },
            dmResponse: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const commandId = parseIntParam(id);
      if (commandId === null) {
        reply.code(400).send({ error: "Invalid command ID" });
        return;
      }

      const body = request.body as {
        name?: string;
        triggerType?: string;
        response?: { type: "text" | "embed"; content?: string; embed?: Record<string, unknown> };
        actions?: { type: "addRole" | "removeRole"; roleId: string }[];
        enabled?: boolean;
        cooldown?: number;
        allowedRoles?: string[];
        allowedChannels?: string[];
        deletesTrigger?: boolean;
        dmResponse?: boolean;
      };

      // Validate regex if trigger type is being changed to regex
      if (body.triggerType === "regex" && body.name) {
        try {
          new RegExp(body.name, "i");
        } catch {
          reply.code(400).send({ error: "Invalid regex pattern" });
          return;
        }
      }

      const updated = await updateCustomCommand(commandId, guildId, body);
      if (!updated) {
        reply.code(404).send({ error: "Command not found" });
        return;
      }

      reply.send(updated);
    },
  );

  // DELETE custom command
  app.delete(
    "/api/guilds/:guildId/custom-commands/:id",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const commandId = parseIntParam(id);
      if (commandId === null) {
        reply.code(400).send({ error: "Invalid command ID" });
        return;
      }

      const deleted = await deleteCustomCommand(commandId, guildId);
      if (!deleted) {
        reply.code(404).send({ error: "Command not found" });
        return;
      }

      reply.send({ success: true });
    },
  );
}
