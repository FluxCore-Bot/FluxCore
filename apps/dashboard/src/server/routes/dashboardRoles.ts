import type { FastifyInstance } from "fastify";
import { getPrisma } from "@fluxcore/database";
import {
  ALL_PERMISSION_KEYS,
  ROLE_PRESETS,
  matchPermission,
} from "@fluxcore/types";
import { requireAuth, requireGuildAdmin, requirePermission } from "../middleware.js";
import {
  createDashboardAuditLog,
  invalidatePermissionCache,
} from "../permissions.js";

const MAX_ROLES_PER_GUILD = 25;
const MAX_PERMISSIONS_PER_ROLE = 100;
const NAME_MAX_LENGTH = 32;
const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function isValidPermissionKey(key: string): boolean {
  // Allow exact keys and wildcard patterns
  if (ALL_PERMISSION_KEYS.includes(key)) return true;
  if (key === "*") return true;
  // Wildcard patterns: "module.*", "*.resource.action", "*.*.view"
  if (key.includes("*")) {
    const parts = key.split(".");
    return parts.length >= 2 && parts.length <= 3;
  }
  return false;
}

export function registerDashboardRoleRoutes(app: FastifyInstance): void {
  // GET all dashboard roles for a guild
  app.get(
    "/api/guilds/:guildId/dashboard-roles",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.roles.view")] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const prisma = getPrisma();

      const roles = await prisma.dashboardRole.findMany({
        where: { guildId },
        include: { _count: { select: { assignments: true } } },
        orderBy: { position: "desc" },
      });

      reply.send(
        roles.map((r) => ({
          id: r.id,
          name: r.name,
          color: r.color,
          position: r.position,
          isDefault: r.isDefault,
          permissions: JSON.parse(r.permissions),
          memberCount: r._count.assignments,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      );
    },
  );

  // POST create a new dashboard role
  app.post(
    "/api/guilds/:guildId/dashboard-roles",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.roles.manage")],
      schema: {
        body: {
          type: "object",
          required: ["name", "permissions"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: NAME_MAX_LENGTH },
            color: { type: ["string", "null"] },
            isDefault: { type: "boolean" },
            permissions: {
              type: "array",
              items: { type: "string" },
              maxItems: MAX_PERMISSIONS_PER_ROLE,
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        name: string;
        color?: string | null;
        isDefault?: boolean;
        permissions: string[];
      };
      const session = request.session!;
      const prisma = getPrisma();

      // Validate role count
      const count = await prisma.dashboardRole.count({ where: { guildId } });
      if (count >= MAX_ROLES_PER_GUILD) {
        reply.code(400).send({ error: `Role limit reached (max ${MAX_ROLES_PER_GUILD})` });
        return;
      }

      // Validate color
      if (body.color && !COLOR_REGEX.test(body.color)) {
        reply.code(400).send({ error: "Invalid color format (use #RRGGBB)" });
        return;
      }

      // Validate permissions
      for (const perm of body.permissions) {
        if (!isValidPermissionKey(perm)) {
          reply.code(400).send({ error: `Invalid permission key: ${perm}` });
          return;
        }
      }

      // Escalation check: user can only grant permissions they have
      if (!request.resolvedPermissions?.isOwner) {
        const userPerms = request.resolvedPermissions!.permissions;
        for (const perm of body.permissions) {
          if (!matchPermission(userPerms, perm)) {
            reply.code(403).send({
              error: "Cannot grant permissions you don't have",
              permission: perm,
            });
            return;
          }
        }
      }

      // Get next position
      const maxPos = await prisma.dashboardRole.aggregate({
        where: { guildId },
        _max: { position: true },
      });

      try {
        const role = await prisma.dashboardRole.create({
          data: {
            guildId,
            name: body.name.trim(),
            color: body.color ?? null,
            position: (maxPos._max.position ?? 0) + 1,
            isDefault: body.isDefault ?? false,
            permissions: JSON.stringify(body.permissions),
          },
        });

        if (body.isDefault) {
          invalidatePermissionCache(guildId);
        }

        await createDashboardAuditLog({
          guildId,
          userId: session.userId,
          username: session.username,
          action: "dashboard.roles.create",
          targetType: "role",
          targetId: role.id,
          details: { name: role.name, permissions: body.permissions },
        });

        reply.code(201).send({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          isDefault: role.isDefault,
          permissions: body.permissions,
          memberCount: 0,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        });
      } catch {
        reply.code(400).send({ error: "A role with this name already exists" });
      }
    },
  );

  // PUT update a dashboard role
  app.put(
    "/api/guilds/:guildId/dashboard-roles/:roleId",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.roles.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: NAME_MAX_LENGTH },
            color: { type: ["string", "null"] },
            position: { type: "integer", minimum: 0 },
            isDefault: { type: "boolean" },
            permissions: {
              type: "array",
              items: { type: "string" },
              maxItems: MAX_PERMISSIONS_PER_ROLE,
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId, roleId } = request.params as { guildId: string; roleId: string };
      const body = request.body as {
        name?: string;
        color?: string | null;
        position?: number;
        isDefault?: boolean;
        permissions?: string[];
      };
      const session = request.session!;
      const prisma = getPrisma();

      const existing = await prisma.dashboardRole.findUnique({ where: { id: roleId } });
      if (!existing || existing.guildId !== guildId) {
        reply.code(404).send({ error: "Role not found" });
        return;
      }

      if (body.color !== undefined && body.color && !COLOR_REGEX.test(body.color)) {
        reply.code(400).send({ error: "Invalid color format (use #RRGGBB)" });
        return;
      }

      if (body.permissions) {
        for (const perm of body.permissions) {
          if (!isValidPermissionKey(perm)) {
            reply.code(400).send({ error: `Invalid permission key: ${perm}` });
            return;
          }
        }

        // Escalation check
        if (!request.resolvedPermissions?.isOwner) {
          const userPerms = request.resolvedPermissions!.permissions;
          for (const perm of body.permissions) {
            if (!matchPermission(userPerms, perm)) {
              reply.code(403).send({
                error: "Cannot grant permissions you don't have",
                permission: perm,
              });
              return;
            }
          }
        }
      }

      const update: Record<string, unknown> = {};
      if (body.name !== undefined) update.name = body.name.trim();
      if (body.color !== undefined) update.color = body.color;
      if (body.position !== undefined) update.position = body.position;
      if (body.isDefault !== undefined) update.isDefault = body.isDefault;
      if (body.permissions !== undefined) update.permissions = JSON.stringify(body.permissions);

      try {
        const role = await prisma.dashboardRole.update({
          where: { id: roleId },
          data: update,
        });

        // Invalidate all users for this guild since role permissions changed
        invalidatePermissionCache(guildId);

        await createDashboardAuditLog({
          guildId,
          userId: session.userId,
          username: session.username,
          action: "dashboard.roles.update",
          targetType: "role",
          targetId: roleId,
          details: { changes: body },
        });

        reply.send({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          isDefault: role.isDefault,
          permissions: JSON.parse(role.permissions),
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        });
      } catch {
        reply.code(400).send({ error: "A role with this name already exists" });
      }
    },
  );

  // DELETE a dashboard role
  app.delete(
    "/api/guilds/:guildId/dashboard-roles/:roleId",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.roles.manage")] },
    async (request, reply) => {
      const { guildId, roleId } = request.params as { guildId: string; roleId: string };
      const session = request.session!;
      const prisma = getPrisma();

      const existing = await prisma.dashboardRole.findUnique({ where: { id: roleId } });
      if (!existing || existing.guildId !== guildId) {
        reply.code(404).send({ error: "Role not found" });
        return;
      }

      await prisma.dashboardRole.delete({ where: { id: roleId } });
      invalidatePermissionCache(guildId);

      await createDashboardAuditLog({
        guildId,
        userId: session.userId,
        username: session.username,
        action: "dashboard.roles.delete",
        targetType: "role",
        targetId: roleId,
        details: { name: existing.name },
      });

      reply.send({ success: true });
    },
  );

  // GET members of a dashboard role
  app.get(
    "/api/guilds/:guildId/dashboard-roles/:roleId/members",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.roles.view")] },
    async (request, reply) => {
      const { guildId, roleId } = request.params as { guildId: string; roleId: string };
      const prisma = getPrisma();

      const role = await prisma.dashboardRole.findUnique({ where: { id: roleId } });
      if (!role || role.guildId !== guildId) {
        reply.code(404).send({ error: "Role not found" });
        return;
      }

      const assignments = await prisma.dashboardRoleAssignment.findMany({
        where: { guildId, roleId },
        orderBy: { createdAt: "desc" },
      });

      reply.send(
        assignments.map((a) => ({
          id: a.id,
          userId: a.userId,
          assignedBy: a.assignedBy,
          createdAt: a.createdAt,
        })),
      );
    },
  );

  // POST assign a user to a role
  app.post(
    "/api/guilds/:guildId/dashboard-roles/:roleId/members",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.roles.manage")],
      schema: {
        body: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId, roleId } = request.params as { guildId: string; roleId: string };
      const { userId } = request.body as { userId: string };
      const session = request.session!;
      const prisma = getPrisma();

      const role = await prisma.dashboardRole.findUnique({ where: { id: roleId } });
      if (!role || role.guildId !== guildId) {
        reply.code(404).send({ error: "Role not found" });
        return;
      }

      try {
        const assignment = await prisma.dashboardRoleAssignment.create({
          data: {
            guildId,
            userId,
            roleId,
            assignedBy: session.userId,
          },
        });

        invalidatePermissionCache(guildId, userId);

        await createDashboardAuditLog({
          guildId,
          userId: session.userId,
          username: session.username,
          action: "dashboard.roles.assign",
          targetType: "user",
          targetId: userId,
          details: { roleId, roleName: role.name },
        });

        reply.code(201).send({
          id: assignment.id,
          userId: assignment.userId,
          assignedBy: assignment.assignedBy,
          createdAt: assignment.createdAt,
        });
      } catch {
        reply.code(400).send({ error: "User already has this role" });
      }
    },
  );

  // DELETE remove a user from a role
  app.delete(
    "/api/guilds/:guildId/dashboard-roles/:roleId/members/:userId",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.roles.manage")] },
    async (request, reply) => {
      const { guildId, roleId, userId } = request.params as {
        guildId: string;
        roleId: string;
        userId: string;
      };
      const session = request.session!;
      const prisma = getPrisma();

      const assignment = await prisma.dashboardRoleAssignment.findFirst({
        where: { guildId, roleId, userId },
        include: { role: true },
      });
      if (!assignment) {
        reply.code(404).send({ error: "Assignment not found" });
        return;
      }

      await prisma.dashboardRoleAssignment.delete({ where: { id: assignment.id } });
      invalidatePermissionCache(guildId, userId);

      await createDashboardAuditLog({
        guildId,
        userId: session.userId,
        username: session.username,
        action: "dashboard.roles.unassign",
        targetType: "user",
        targetId: userId,
        details: { roleId, roleName: assignment.role.name },
      });

      reply.send({ success: true });
    },
  );

  // GET available role presets
  app.get(
    "/api/guilds/:guildId/dashboard-roles/presets",
    { preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.roles.manage")] },
    async (_request, reply) => {
      reply.send(ROLE_PRESETS);
    },
  );

  // POST create a role from preset
  app.post(
    "/api/guilds/:guildId/dashboard-roles/from-preset",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.roles.manage")],
      schema: {
        body: {
          type: "object",
          required: ["preset"],
          properties: {
            preset: { type: "string", enum: Object.keys(ROLE_PRESETS) },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const { preset: presetKey } = request.body as { preset: string };
      const session = request.session!;
      const prisma = getPrisma();

      const preset = ROLE_PRESETS[presetKey];
      if (!preset) {
        reply.code(400).send({ error: "Unknown preset" });
        return;
      }

      const count = await prisma.dashboardRole.count({ where: { guildId } });
      if (count >= MAX_ROLES_PER_GUILD) {
        reply.code(400).send({ error: `Role limit reached (max ${MAX_ROLES_PER_GUILD})` });
        return;
      }

      // Escalation check
      if (!request.resolvedPermissions?.isOwner) {
        const userPerms = request.resolvedPermissions!.permissions;
        for (const perm of preset.permissions) {
          if (!matchPermission(userPerms, perm)) {
            reply.code(403).send({
              error: "Cannot create preset with permissions you don't have",
              permission: perm,
            });
            return;
          }
        }
      }

      const maxPos = await prisma.dashboardRole.aggregate({
        where: { guildId },
        _max: { position: true },
      });

      try {
        const role = await prisma.dashboardRole.create({
          data: {
            guildId,
            name: preset.name,
            color: preset.color,
            position: (maxPos._max.position ?? 0) + 1,
            permissions: JSON.stringify(preset.permissions),
          },
        });

        await createDashboardAuditLog({
          guildId,
          userId: session.userId,
          username: session.username,
          action: "dashboard.roles.create",
          targetType: "role",
          targetId: role.id,
          details: { preset: presetKey, name: role.name },
        });

        reply.code(201).send({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          isDefault: role.isDefault,
          permissions: preset.permissions,
          memberCount: 0,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        });
      } catch {
        reply.code(400).send({ error: `A role named "${preset.name}" already exists` });
      }
    },
  );
}
