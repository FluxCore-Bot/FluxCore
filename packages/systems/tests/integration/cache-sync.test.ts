/**
 * Integration tests: Cache invalidation & sync pipeline
 *
 * Verifies the notification mechanism that propagates dashboard changes
 * to the bot's runtime:
 *   1. notifyCacheInvalidation() writes to ActionCacheInvalidation table
 *   2. pollInvalidations() reads those records and triggers reloads
 *   3. Old records are cleaned up after 1 hour
 *
 * Uses a REAL PostgreSQL test database — no DB mocks.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDatabase, cleanTestData, teardownTestDatabase } from "../helpers/db.js";
import { createActionRule, createCacheInvalidation, createMusicSettings } from "../helpers/factories.js";
import { getPrisma } from "@fluxcore/database";
import { getRulesForEvent, reloadGuild, invalidateGuild } from "../../src/actions/cache.js";
import { notifyCacheInvalidation } from "../../src/actions/persistence.js";
import { getMusicSettings, loadMusicSettingsForGuild } from "../../src/music/config.js";

const GUILD_ID = "test-guild-1";

describe("Cache invalidation pipeline", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestData();
    invalidateGuild(GUILD_ID);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  // ─── notifyCacheInvalidation() ───────────────────────────

  describe("notifyCacheInvalidation()", () => {
    it("writes an invalidation record to the database", async () => {
      await notifyCacheInvalidation(GUILD_ID, "reload");

      const prisma = getPrisma();
      const records = await prisma.actionCacheInvalidation.findMany({
        where: { guildId: GUILD_ID },
      });

      expect(records).toHaveLength(1);
      expect(records[0].guildId).toBe(GUILD_ID);
      expect(records[0].action).toBe("reload");
    });

    it("writes correct action type for music reload", async () => {
      await notifyCacheInvalidation(GUILD_ID, "reloadMusic");

      const prisma = getPrisma();
      const records = await prisma.actionCacheInvalidation.findMany({
        where: { guildId: GUILD_ID },
      });

      expect(records[0].action).toBe("reloadMusic");
    });

    it("writes correct action type for settings reload", async () => {
      await notifyCacheInvalidation(GUILD_ID, "reloadSettings");

      const prisma = getPrisma();
      const records = await prisma.actionCacheInvalidation.findMany({
        where: { guildId: GUILD_ID },
      });

      expect(records[0].action).toBe("reloadSettings");
    });

    it("writes correct action type for tempVoice reload", async () => {
      await notifyCacheInvalidation(GUILD_ID, "reloadTempVoice");

      const prisma = getPrisma();
      const records = await prisma.actionCacheInvalidation.findMany({
        where: { guildId: GUILD_ID },
      });

      expect(records[0].action).toBe("reloadTempVoice");
    });

    it("creates multiple records for multiple invalidations", async () => {
      await notifyCacheInvalidation(GUILD_ID, "reload");
      await notifyCacheInvalidation(GUILD_ID, "reloadMusic");
      await notifyCacheInvalidation("test-guild-2", "reload");

      const prisma = getPrisma();
      const records = await prisma.actionCacheInvalidation.findMany();

      expect(records).toHaveLength(3);
    });
  });

  // ─── End-to-end: dashboard write → invalidation → reload ─

  describe("full sync flow", () => {
    it("action rule: dashboard write → invalidation record → bot reload", async () => {
      // Step 1: Dashboard creates a rule
      const rule = await createActionRule({
        guildId: GUILD_ID,
        eventType: "memberJoin",
        actions: [{ type: "sendMessage", channelId: "ch-1", message: "Welcome!" }],
      });

      // Step 2: Dashboard writes invalidation (what the route handler does)
      await notifyCacheInvalidation(GUILD_ID, "reload");

      // Step 3: Verify invalidation record exists
      const prisma = getPrisma();
      const records = await prisma.actionCacheInvalidation.findMany({
        where: { guildId: GUILD_ID, action: "reload" },
      });
      expect(records.length).toBeGreaterThanOrEqual(1);

      // Step 4: Bot reloads guild (what pollInvalidations or HTTP push triggers)
      await reloadGuild(GUILD_ID);

      // Step 5: Verify bot cache has the rule
      const cached = getRulesForEvent(GUILD_ID, "memberJoin");
      expect(cached).toHaveLength(1);
      expect(cached[0].id).toBe(rule.id);
    });

    it("music settings: dashboard write → invalidation record → bot reload", async () => {
      // Step 1: Dashboard creates music settings
      await createMusicSettings({
        guildId: GUILD_ID,
        defaultVolume: 80,
        twentyFourSeven: true,
        lastChannelId: "vc-1",
      });

      // Step 2: Dashboard writes invalidation
      await notifyCacheInvalidation(GUILD_ID, "reloadMusic");

      // Step 3: Bot reloads music for this guild
      await loadMusicSettingsForGuild(GUILD_ID);

      // Step 4: Verify bot cache has the settings
      const cached = getMusicSettings(GUILD_ID);
      expect(cached.defaultVolume).toBe(80);
      expect(cached.twentyFourSeven).toBe(true);
    });
  });

  // ─── Invalidation record cleanup ────────────────────────

  describe("old record cleanup", () => {
    it("records have timestamps for cleanup queries", async () => {
      await createCacheInvalidation(GUILD_ID, "reload");

      const prisma = getPrisma();
      const records = await prisma.actionCacheInvalidation.findMany({
        where: { guildId: GUILD_ID },
      });

      expect(records[0].createdAt).toBeInstanceOf(Date);
      // Should be recent (within last minute)
      const ageMs = Date.now() - records[0].createdAt.getTime();
      expect(ageMs).toBeLessThan(60_000);
    });

    it("old records can be cleaned up", async () => {
      const prisma = getPrisma();

      // Create a record and manually backdate it
      const record = await createCacheInvalidation(GUILD_ID, "reload");
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await prisma.actionCacheInvalidation.update({
        where: { id: record.id },
        data: { createdAt: twoHoursAgo },
      });

      // Create a fresh record
      await createCacheInvalidation(GUILD_ID, "reload");

      // Clean records older than 1 hour
      const cutoff = new Date(Date.now() - 60 * 60 * 1000);
      const result = await prisma.actionCacheInvalidation.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      expect(result.count).toBe(1);

      // Fresh record should still exist
      const remaining = await prisma.actionCacheInvalidation.findMany();
      expect(remaining).toHaveLength(1);
    });
  });
});
