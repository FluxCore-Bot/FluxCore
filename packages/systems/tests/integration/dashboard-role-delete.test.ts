/**
 * Integration tests: DashboardRole delete semantics + audited helper.
 *
 * Verifies the schema's onDelete: Restrict guard and the
 * deleteDashboardRoleWithAudit() helper. Uses a REAL PostgreSQL test
 * database — no DB mocks.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { getPrisma } from "@fluxcore/database";
import { setupTestDatabase, teardownTestDatabase } from "../helpers/db.js";
import { deleteDashboardRoleWithAudit } from "../../../../apps/dashboard/src/server/shared/dashboardRoleDelete.js";

async function cleanDashboardRoleTables(): Promise<void> {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "DashboardAuditLog",
      "DashboardRoleAssignment",
      "DashboardUserPermission",
      "DashboardRole"
    CASCADE
  `);
}

describe("DashboardRole delete semantics", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  beforeEach(async () => {
    await cleanDashboardRoleTables();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("refuses to delete a role with active assignments", async () => {
    const prisma = getPrisma();
    const role = await prisma.dashboardRole.create({
      data: { guildId: "g1", name: "mods", permissions: '["moderation.warn"]' },
    });
    await prisma.dashboardRoleAssignment.create({
      data: { guildId: "g1", userId: "u1", roleId: role.id, assignedBy: "admin" },
    });

    await expect(
      prisma.dashboardRole.delete({ where: { id: role.id } }),
    ).rejects.toThrow();
  });

  it("permits deletion after all assignments are removed", async () => {
    const prisma = getPrisma();
    const role = await prisma.dashboardRole.create({
      data: { guildId: "g1", name: "mods", permissions: "[]" },
    });
    await prisma.dashboardRoleAssignment.create({
      data: { guildId: "g1", userId: "u1", roleId: role.id, assignedBy: "admin" },
    });
    await prisma.dashboardRoleAssignment.deleteMany({ where: { roleId: role.id } });

    await expect(
      prisma.dashboardRole.delete({ where: { id: role.id } }),
    ).resolves.toMatchObject({ id: role.id });
  });
});

describe("deleteDashboardRoleWithAudit", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  beforeEach(async () => {
    await cleanDashboardRoleTables();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("unassigns members, writes audit entries, then deletes the role", async () => {
    const prisma = getPrisma();
    const role = await prisma.dashboardRole.create({
      data: { guildId: "g1", name: "mods", permissions: "[]" },
    });
    await prisma.dashboardRoleAssignment.createMany({
      data: [
        { guildId: "g1", userId: "u1", roleId: role.id, assignedBy: "a" },
        { guildId: "g1", userId: "u2", roleId: role.id, assignedBy: "a" },
      ],
    });

    await deleteDashboardRoleWithAudit({
      guildId: "g1",
      roleId: role.id,
      actorId: "admin",
      actorUsername: "admin#0",
    });

    const remaining = await prisma.dashboardRole.findUnique({
      where: { id: role.id },
    });
    expect(remaining).toBeNull();

    const auditEntries = await prisma.dashboardAuditLog.findMany({
      where: { guildId: "g1", action: { in: ["role.unassign", "role.delete"] } },
      orderBy: { createdAt: "asc" },
    });
    expect(auditEntries.map((e) => e.action)).toEqual([
      "role.unassign",
      "role.unassign",
      "role.delete",
    ]);
  });
});
