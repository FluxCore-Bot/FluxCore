import type { FastifyInstance } from "fastify";
import { withDocs } from "../../shared/openapi-schemas.js";
import { getPrisma } from "@fluxcore/database";
import {
  PERMISSION_REGISTRY,
  ALL_PERMISSION_KEYS,
  resolveEffectivePermissions,
} from "@fluxcore/types";
import { requireAuth, requireGuildAdmin, requirePermission } from "../../shared/middleware.js";
import {
  resolveUserPermissions,
  createDashboardAuditLog,
  invalidatePermissionCache,
} from "../../shared/permissions.js";
import { getGuildOwnerId } from "../../shared/discordApi.js";

export function registerDashboardPermissionRoutes(app: FastifyInstance): void {
  // ─── My Permissions ───

  // GET current user's resolved permissions for this guild
  app.get(
    "/api/guilds/:guildId/my-permissions",
    {
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        { tag: "DashboardPermissions", response: { 200: { type: "object", additionalProperties: true } } },
      ),
      preHandler: [requireAuth, requireGuildAdmin],
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const resolved = request.resolvedPermissions!;

      const prisma = getPrisma();
      const assignments = await prisma.dashboardRoleAssignment.findMany({
        where: { guildId, userId: request.session!.userId },
        include: { role: { select: { id: true, name: true, color: true } } },
      });

      reply.send({
        permissions: [...resolved.permissions],
        effectivePermissions: resolveEffectivePermissions([...resolved.permissions]),
        roles: assignments.map((a) => a.role),
        isOwner: resolved.isOwner,
      });
    },
  );

  // GET permission registry (available permissions)
  app.get(
    "/api/guilds/:guildId/permission-registry",
    {
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        { tag: "DashboardPermissions", response: { 200: { type: "object", additionalProperties: true } } },
      ),
      preHandler: [requireAuth, requireGuildAdmin],
    },
    async (_request, reply) => {
      reply.send(PERMISSION_REGISTRY);
    },
  );

  // ─── Per-User Permission Overrides ───

  // GET a user's direct permission overrides
  app.get(
    "/api/guilds/:guildId/user-permissions/:userId",
    {
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        { tag: "DashboardPermissions", response: { 200: { type: "object", additionalProperties: true } } },
      ),
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.roles.manage")],
    },
    async (request, reply) => {
      const { guildId, userId } = request.params as { guildId: string; userId: string };
      const prisma = getPrisma();

      const perms = await prisma.dashboardUserPermission.findMany({
        where: { guildId, userId },
        orderBy: { createdAt: "desc" },
      });

      // Also resolve effective permissions for this user
      const resolved = await resolveUserPermissions(userId, guildId);

      reply.send({
        overrides: perms.map((p) => ({
          id: p.id,
          permission: p.permission,
          grantedBy: p.grantedBy,
          createdAt: p.createdAt,
        })),
        effectivePermissions: resolveEffectivePermissions([...resolved.permissions]),
        isOwner: resolved.isOwner,
      });
    },
  );

  // PUT set a user's permission overrides (replaces all)
  app.put(
    "/api/guilds/:guildId/user-permissions/:userId",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.roles.manage")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            required: ["permissions"],
            properties: {
              permissions: {
                type: "array",
                items: { type: "string" },
                maxItems: 100,
              },
            },
            additionalProperties: false,
          },
        },
        {
          tag: "DashboardPermissions",
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                permissions: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      ),
    },
    async (request, reply) => {
      const { guildId, userId } = request.params as { guildId: string; userId: string };
      const { permissions } = request.body as { permissions: string[] };
      const session = request.session!;
      const prisma = getPrisma();

      // Cannot modify owner permissions
      const ownerId = await getGuildOwnerId(guildId);
      if (ownerId === userId) {
        reply.code(400).send({ error: "Cannot modify guild owner permissions" });
        return;
      }

      // Block self-grant: a user must never grant or modify their own permission set
      if (session.userId === userId) {
        reply.code(403).send({ error: "Cannot modify your own permissions" });
        return;
      }

      // Validate keys
      for (const perm of permissions) {
        if (!isValidPermKey(perm)) {
          reply.code(400).send({ error: `Invalid permission key: ${perm}` });
          return;
        }
      }

      // Strict escalation gate: non-owners must literally hold every key they grant.
      // Wildcards (`*`, `module.*`, `module.feature.*`) may only be granted by the
      // guild owner — match-by-wildcard is not enough.
      if (!request.resolvedPermissions?.isOwner) {
        const literalCallerPerms = request.resolvedPermissions!.permissions;
        for (const perm of permissions) {
          if (perm === "*" || perm.includes("*")) {
            reply.code(403).send({ error: "Insufficient privileges to grant this permission" });
            return;
          }
          if (!literalCallerPerms.has(perm)) {
            reply.code(403).send({ error: "Insufficient privileges to grant this permission" });
            return;
          }
        }
      }

      // Replace all user permissions in a transaction
      await prisma.$transaction(async (tx) => {
        await tx.dashboardUserPermission.deleteMany({ where: { guildId, userId } });
        if (permissions.length > 0) {
          await tx.dashboardUserPermission.createMany({
            data: permissions.map((perm) => ({
              guildId,
              userId,
              permission: perm,
              grantedBy: session.userId,
            })),
          });
        }
      });

      invalidatePermissionCache(guildId, userId);

      await createDashboardAuditLog({
        guildId,
        userId: session.userId,
        username: session.username,
        action: "dashboard.permissions.update",
        targetType: "user",
        targetId: userId,
        details: { permissions },
      });

      reply.send({ success: true, permissions });
    },
  );

  // DELETE clear all permission overrides for a user
  app.delete(
    "/api/guilds/:guildId/user-permissions/:userId",
    {
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        {
          tag: "DashboardPermissions",
          response: { 200: { type: "object", properties: { success: { type: "boolean" } } } },
        },
      ),
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.roles.manage")],
    },
    async (request, reply) => {
      const { guildId, userId } = request.params as { guildId: string; userId: string };
      const session = request.session!;
      const prisma = getPrisma();

      await prisma.dashboardUserPermission.deleteMany({ where: { guildId, userId } });
      invalidatePermissionCache(guildId, userId);

      await createDashboardAuditLog({
        guildId,
        userId: session.userId,
        username: session.username,
        action: "dashboard.permissions.clear",
        targetType: "user",
        targetId: userId,
      });

      reply.send({ success: true });
    },
  );

  // ─── Dashboard Guild Settings ───

  // GET dashboard settings
  app.get(
    "/api/guilds/:guildId/dashboard-settings",
    {
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        { tag: "DashboardPermissions", response: { 200: { type: "object", additionalProperties: true } } },
      ),
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.settings.manage")],
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const prisma = getPrisma();

      const settings = await prisma.dashboardGuildSettings.findUnique({
        where: { guildId },
      });

      reply.send(
        settings ?? {
          guildId,
          auditRetentionDays: 90,
          requirePermissions: false,
        },
      );
    },
  );

  // PUT update dashboard settings (owner only for requirePermissions toggle)
  app.put(
    "/api/guilds/:guildId/dashboard-settings",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.settings.manage")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            properties: {
              auditRetentionDays: { type: "integer", minimum: 7, maximum: 365 },
              requirePermissions: { type: "boolean" },
            },
            additionalProperties: false,
          },
        },
        { tag: "DashboardPermissions", response: { 200: { type: "object", additionalProperties: true } } },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        auditRetentionDays?: number;
        requirePermissions?: boolean;
      };
      const session = request.session!;

      // Only guild owner can toggle requirePermissions
      if (body.requirePermissions !== undefined && !request.resolvedPermissions?.isOwner) {
        reply.code(403).send({ error: "Only the guild owner can toggle the permissions system" });
        return;
      }

      const prisma = getPrisma();
      const update: Record<string, unknown> = {};
      if (body.auditRetentionDays !== undefined) update.auditRetentionDays = body.auditRetentionDays;
      if (body.requirePermissions !== undefined) update.requirePermissions = body.requirePermissions;

      const settings = await prisma.dashboardGuildSettings.upsert({
        where: { guildId },
        create: { guildId, ...update },
        update,
      });

      // Toggling permissions invalidates all caches for this guild
      if (body.requirePermissions !== undefined) {
        invalidatePermissionCache(guildId);
      }

      await createDashboardAuditLog({
        guildId,
        userId: session.userId,
        username: session.username,
        action: "dashboard.settings.update",
        targetType: "settings",
        details: { changes: body },
      });

      reply.send(settings);
    },
  );

  // ─── Dashboard Audit Log ───

  // GET audit log entries
  app.get(
    "/api/guilds/:guildId/dashboard-audit",
    {
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          querystring: { type: "object", properties: { page: { type: "integer", minimum: 1, default: 1 }, limit: { type: "integer", minimum: 1, maximum: 100, default: 20 }, sort: { type: "string" } } },
        },
        { tag: "DashboardPermissions", response: { 200: { type: "object", additionalProperties: true } } },
      ),
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("dashboard.audit.view")],
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as {
        userId?: string;
        action?: string;
        targetType?: string;
        from?: string;
        to?: string;
        page?: string;
        limit?: string;
      };
      const prisma = getPrisma();

      const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "50", 10) || 50));
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = { guildId };
      const isOwner = request.resolvedPermissions?.isOwner === true;
      if (isOwner) {
        if (query.userId) where.userId = query.userId;
      } else {
        // Non-owners may only view their own audit entries
        where.userId = request.session!.userId;
      }
      if (query.action) {
        if (!ALLOWED_AUDIT_ACTIONS.has(query.action)) {
          reply.code(400).send({ error: "Unknown action filter" });
          return;
        }
        where.action = query.action;
      }
      if (query.targetType) where.targetType = query.targetType;
      if (query.from || query.to) {
        const createdAt: Record<string, Date> = {};
        if (query.from) {
          const d = new Date(query.from);
          if (!Number.isFinite(d.getTime())) {
            reply.code(400).send({ error: "Invalid 'from' date" });
            return;
          }
          createdAt.gte = d;
        }
        if (query.to) {
          const d = new Date(query.to);
          if (!Number.isFinite(d.getTime())) {
            reply.code(400).send({ error: "Invalid 'to' date" });
            return;
          }
          createdAt.lte = d;
        }
        where.createdAt = createdAt;
      }

      const [entries, total] = await Promise.all([
        prisma.dashboardAuditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.dashboardAuditLog.count({ where }),
      ]);

      reply.send({
        entries: entries.map((e) => ({
          id: e.id,
          userId: e.userId,
          username: e.username,
          action: e.action,
          targetType: e.targetType,
          targetId: e.targetId,
          details: e.details,
          createdAt: e.createdAt,
        })),
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    },
  );
}

// ─── Helpers ───

const ALLOWED_AUDIT_ACTIONS = new Set([
  "dashboard.permissions.update",
  "dashboard.permissions.clear",
  "dashboard.settings.update",
  "dashboard.role.create",
  "dashboard.role.update",
  "dashboard.role.delete",
  "dashboard.role.assign",
  "dashboard.role.unassign",
]);

function isValidPermKey(key: string): boolean {
  if (ALL_PERMISSION_KEYS.includes(key)) return true;
  if (key === "*") return true;
  if (key.includes("*")) {
    const parts = key.split(".");
    return parts.length >= 2 && parts.length <= 3;
  }
  return false;
}
