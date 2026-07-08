/**
 * Integration tests: DashboardAuditLog.details JSONB column.
 *
 * Verifies the migrated jsonb column type and that
 * createDashboardAuditLog stores structured objects (not stringified JSON).
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { getPrisma } from "@fluxcore/database";
import { setupTestDatabase, teardownTestDatabase } from "../helpers/db.js";
import { createDashboardAuditLog } from "../../../../apps/dashboard/src/server/shared/permissions.js";

async function cleanAuditTables(): Promise<void> {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "DashboardAuditLog" CASCADE`);
}

describe("createDashboardAuditLog (JSONB)", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  beforeEach(async () => {
    await cleanAuditTables();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("stores details as a structured object, not a string", async () => {
    await createDashboardAuditLog({
      guildId: "g1",
      userId: "u1",
      username: "user#0",
      action: "role.update",
      targetType: "role",
      targetId: "role-1",
      details: {
        before: { permissions: ["a"] },
        after: { permissions: ["a", "b"] },
      },
    });

    const row = await getPrisma().dashboardAuditLog.findFirst({
      where: { guildId: "g1" },
    });
    expect(row).not.toBeNull();
    // After migration, details is an object — NOT a JSON string
    expect(typeof row!.details).toBe("object");
    const details = row!.details as {
      before: { permissions: string[] };
    };
    expect(details.before.permissions).toEqual(["a"]);
  });

  it("supports JSONB filtering", async () => {
    await createDashboardAuditLog({
      guildId: "g2",
      userId: "u",
      username: "u",
      action: "role.update",
      details: { reason: "promotion" },
    });

    const rows = await getPrisma().$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "DashboardAuditLog"
      WHERE "guildId" = 'g2' AND details->>'reason' = 'promotion'
    `;
    expect(rows.length).toBe(1);
  });
});
