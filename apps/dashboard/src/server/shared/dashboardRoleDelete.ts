import { getPrisma } from "@fluxcore/database";
import { logger } from "@fluxcore/utils";
import { invalidatePermissionCache } from "./permissions.js";

export interface DeleteDashboardRoleArgs {
  guildId: string;
  roleId: string;
  actorId: string;
  actorUsername: string;
}

/**
 * Safely delete a DashboardRole: enumerate assignments, write an audit
 * entry per unassignment, invalidate per-user permission caches, and
 * only then delete the role itself. The schema's onDelete: Restrict
 * guarantees that this is the ONLY safe path to remove a role.
 */
export async function deleteDashboardRoleWithAudit(
  args: DeleteDashboardRoleArgs,
): Promise<void> {
  const prisma = getPrisma();

  const assignedUserIds: string[] = await prisma.$transaction(async (tx) => {
    const assignments = await tx.dashboardRoleAssignment.findMany({
      where: { guildId: args.guildId, roleId: args.roleId },
    });

    for (const a of assignments) {
      await tx.dashboardRoleAssignment.delete({ where: { id: a.id } });
      await tx.dashboardAuditLog.create({
        data: {
          guildId: args.guildId,
          userId: args.actorId,
          username: args.actorUsername,
          action: "role.unassign",
          targetType: "user",
          targetId: a.userId,
          details: { roleId: args.roleId, reason: "role-delete" },
        },
      });
    }

    await tx.dashboardRole.delete({ where: { id: args.roleId } });
    await tx.dashboardAuditLog.create({
      data: {
        guildId: args.guildId,
        userId: args.actorId,
        username: args.actorUsername,
        action: "role.delete",
        targetType: "role",
        targetId: args.roleId,
        details: { unassignedUsers: assignments.map((a) => a.userId) },
      },
    });

    return assignments.map((a) => a.userId);
  });

  // Invalidate cached permissions for every previously-assigned user
  invalidatePermissionCache(args.guildId);
  logger.info(
    `Dashboard role ${args.roleId} deleted in guild ${args.guildId} by ${args.actorUsername} (${assignedUserIds.length} unassigned)`,
  );
}
