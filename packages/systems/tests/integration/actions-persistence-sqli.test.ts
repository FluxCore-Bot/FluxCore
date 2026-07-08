/**
 * Regression: prisma.$queryRaw in actions/persistence.ts MUST use the
 * tagged-template form so guildId is bound as a parameter, not concatenated.
 * If anyone switches these call sites to $queryRawUnsafe with string
 * interpolation, the malicious guildId below would drop or corrupt rows
 * and these assertions would fail.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setupTestDatabase,
  cleanTestData,
  teardownTestDatabase,
} from "../helpers/db.js";
import { getPrisma } from "@fluxcore/database";
import {
  getAnalytics,
  getLastFiredByGuild,
} from "../../src/actions/persistence.js";

const SAFE_GUILD = "guild-safe-1";
const MALICIOUS_GUILD = `guild-x'; DROP TABLE "ActionLog"; --`;

describe("actions persistence — $queryRaw SQLi safety", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestData();
    const prisma = getPrisma();
    await prisma.actionRule.create({
      data: {
        guildId: SAFE_GUILD,
        name: "rule-1",
        enabled: true,
        eventType: "memberJoin",
        actions: "[]",
        conditions: "{}",
        priority: 0,
        createdBy: "user-1",
      },
    });
    await prisma.actionLog.create({
      data: {
        guildId: SAFE_GUILD,
        ruleId: 0,
        ruleName: "rule-1",
        eventType: "memberJoin",
        actionType: "sendMessage",
        success: true,
        error: null,
        metadata: "{}",
      },
    });
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("getAnalytics treats malicious guildId as a literal value, not SQL", async () => {
    const result = await getAnalytics(MALICIOUS_GUILD, 7);
    expect(result.summary.totalExecutions).toBe(0);
    expect(result.executionTrend).toEqual([]);

    // ActionLog table must still exist and still contain the safe row
    const prisma = getPrisma();
    const stillThere = await prisma.actionLog.count({
      where: { guildId: SAFE_GUILD },
    });
    expect(stillThere).toBe(1);
  });

  it("getLastFiredByGuild treats malicious guildId as a literal value, not SQL", async () => {
    const map = await getLastFiredByGuild(MALICIOUS_GUILD);
    expect(map.size).toBe(0);

    const prisma = getPrisma();
    const stillThere = await prisma.actionLog.count({
      where: { guildId: SAFE_GUILD },
    });
    expect(stillThere).toBe(1);
  });

  it("getAnalytics returns real data for the legitimate guildId", async () => {
    const result = await getAnalytics(SAFE_GUILD, 7);
    expect(result.summary.totalExecutions).toBe(1);
  });
});
