/**
 * Integration tests: Actions sync (dashboard → bot)
 *
 * Verifies that when the dashboard writes action rules to the database,
 * the bot's in-memory cache correctly picks them up after reload.
 * Uses a REAL PostgreSQL test database — no DB mocks.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDatabase, cleanTestData, teardownTestDatabase } from "../helpers/db.js";
import { createActionRule } from "../helpers/factories.js";
import {
  loadAllRules,
  getRulesForEvent,
  getRulesForGuild,
  reloadGuild,
  invalidateGuild,
  addRuleToCache,
  removeRuleFromCache,
  updateRuleInCache,
} from "../../src/actions/cache.js";
import { rowToRule, createRule, updateRule, deleteRule } from "../../src/actions/persistence.js";

const GUILD_ID = "test-guild-1";
const GUILD_ID_2 = "test-guild-2";

describe("Actions sync: dashboard → bot cache", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestData();
    invalidateGuild(GUILD_ID);
    invalidateGuild(GUILD_ID_2);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  // ─── Full Load ───────────────────────────────────────────

  describe("loadAllRules()", () => {
    it("loads rules from DB into cache on startup", async () => {
      await createActionRule({ guildId: GUILD_ID, eventType: "memberJoin" });
      await createActionRule({ guildId: GUILD_ID, eventType: "memberLeave" });
      await createActionRule({ guildId: GUILD_ID_2, eventType: "memberJoin" });

      await loadAllRules();

      expect(getRulesForEvent(GUILD_ID, "memberJoin")).toHaveLength(1);
      expect(getRulesForEvent(GUILD_ID, "memberLeave")).toHaveLength(1);
      expect(getRulesForEvent(GUILD_ID_2, "memberJoin")).toHaveLength(1);
    });

    it("replaces stale cache data on reload", async () => {
      await createActionRule({ guildId: GUILD_ID, eventType: "memberJoin" });
      await loadAllRules();
      expect(getRulesForEvent(GUILD_ID, "memberJoin")).toHaveLength(1);

      // "Dashboard deletes the rule"
      await cleanTestData();

      await loadAllRules();
      expect(getRulesForEvent(GUILD_ID, "memberJoin")).toHaveLength(0);
    });

    it("handles empty database gracefully", async () => {
      await loadAllRules();
      expect(getRulesForGuild(GUILD_ID)).toHaveLength(0);
    });
  });

  // ─── Per-Guild Reload (the real sync path) ───────────────

  describe("reloadGuild() — triggered by cache invalidation", () => {
    it("picks up a new rule created via dashboard", async () => {
      // Simulate dashboard creating a rule (direct DB write)
      const row = await createActionRule({
        guildId: GUILD_ID,
        eventType: "memberJoin",
        actions: [{ type: "sendMessage", channelId: "ch-1", message: "Hello!" }],
      });

      // Bot receives invalidation → reloads this guild
      await reloadGuild(GUILD_ID);

      const cached = getRulesForEvent(GUILD_ID, "memberJoin");
      expect(cached).toHaveLength(1);
      expect(cached[0].id).toBe(row.id);
      expect(cached[0].actions[0].message).toBe("Hello!");
    });

    it("picks up rule updates from dashboard", async () => {
      const row = await createActionRule({
        guildId: GUILD_ID,
        eventType: "memberJoin",
        actions: [{ type: "sendMessage", channelId: "ch-1", message: "v1" }],
      });
      await reloadGuild(GUILD_ID);

      // Dashboard updates the rule
      await updateRule(row.id, GUILD_ID, {
        actions: [{ type: "sendMessage", channelId: "ch-1", message: "v2" }],
      });

      await reloadGuild(GUILD_ID);

      const cached = getRulesForEvent(GUILD_ID, "memberJoin");
      expect(cached[0].actions[0].message).toBe("v2");
    });

    it("removes deleted rules from cache", async () => {
      const row = await createActionRule({ guildId: GUILD_ID });
      await reloadGuild(GUILD_ID);
      expect(getRulesForGuild(GUILD_ID)).toHaveLength(1);

      // Dashboard deletes the rule
      await deleteRule(row.id, GUILD_ID);
      await reloadGuild(GUILD_ID);

      expect(getRulesForGuild(GUILD_ID)).toHaveLength(0);
    });

    it("does not affect other guilds", async () => {
      await createActionRule({ guildId: GUILD_ID, eventType: "memberJoin" });
      await createActionRule({ guildId: GUILD_ID_2, eventType: "memberJoin" });
      await loadAllRules();

      // Delete guild 1's rules
      await cleanTestData();
      await createActionRule({ guildId: GUILD_ID_2, eventType: "memberJoin" });

      // Only reload guild 1
      await reloadGuild(GUILD_ID);

      expect(getRulesForEvent(GUILD_ID, "memberJoin")).toHaveLength(0);
      // Guild 2 still has its cached rule (from the original loadAllRules)
      expect(getRulesForEvent(GUILD_ID_2, "memberJoin")).toHaveLength(1);
    });
  });

  // ─── Priority Ordering ──────────────────────────────────

  describe("priority ordering", () => {
    it("returns rules sorted by priority descending", async () => {
      await createActionRule({
        guildId: GUILD_ID,
        eventType: "memberJoin",
        name: "low-priority",
        priority: 1,
      });
      await createActionRule({
        guildId: GUILD_ID,
        eventType: "memberJoin",
        name: "high-priority",
        priority: 10,
      });
      await createActionRule({
        guildId: GUILD_ID,
        eventType: "memberJoin",
        name: "mid-priority",
        priority: 5,
      });

      await reloadGuild(GUILD_ID);
      const rules = getRulesForEvent(GUILD_ID, "memberJoin");

      expect(rules[0].name).toBe("high-priority");
      expect(rules[1].name).toBe("mid-priority");
      expect(rules[2].name).toBe("low-priority");
    });
  });

  // ─── Enabled/Disabled ───────────────────────────────────

  describe("enabled/disabled rules", () => {
    it("loads both enabled and disabled rules into cache", async () => {
      await createActionRule({ guildId: GUILD_ID, enabled: true, name: "active" });
      await createActionRule({ guildId: GUILD_ID, enabled: false, name: "inactive" });

      await reloadGuild(GUILD_ID);
      const rules = getRulesForGuild(GUILD_ID);

      expect(rules).toHaveLength(2);
      expect(rules.find((r) => r.name === "active")?.enabled).toBe(true);
      expect(rules.find((r) => r.name === "inactive")?.enabled).toBe(false);
    });

    it("reflects enable/disable toggle from dashboard", async () => {
      const row = await createActionRule({ guildId: GUILD_ID, enabled: true });
      await reloadGuild(GUILD_ID);

      // Dashboard disables the rule
      await updateRule(row.id, GUILD_ID, { enabled: false });
      await reloadGuild(GUILD_ID);

      const rules = getRulesForGuild(GUILD_ID);
      expect(rules[0].enabled).toBe(false);
    });
  });

  // ─── Event Type Filtering ──────────────────────────────

  describe("event type filtering", () => {
    it("only returns rules matching the requested event type", async () => {
      await createActionRule({ guildId: GUILD_ID, eventType: "memberJoin", name: "join-rule" });
      await createActionRule({ guildId: GUILD_ID, eventType: "memberLeave", name: "leave-rule" });
      await createActionRule({ guildId: GUILD_ID, eventType: "messageCreated", name: "msg-rule" });

      await reloadGuild(GUILD_ID);

      expect(getRulesForEvent(GUILD_ID, "memberJoin")).toHaveLength(1);
      expect(getRulesForEvent(GUILD_ID, "memberLeave")).toHaveLength(1);
      expect(getRulesForEvent(GUILD_ID, "messageCreated")).toHaveLength(1);
      expect(getRulesForEvent(GUILD_ID, "voiceJoin")).toHaveLength(0);
    });
  });

  // ─── Persistence layer (createRule/updateRule/deleteRule) ─

  describe("persistence → cache round-trip", () => {
    it("createRule writes to DB and can be loaded into cache", async () => {
      const rule = await createRule({
        guildId: GUILD_ID,
        name: "new-via-persistence",
        enabled: true,
        eventType: "memberJoin",
        actions: [{ type: "addRole", roleId: "role-1" }],
        conditions: { roleIds: ["role-vip"] },
        priority: 5,
        createdBy: "dashboard-user",
      });

      await reloadGuild(GUILD_ID);
      const cached = getRulesForEvent(GUILD_ID, "memberJoin");

      expect(cached).toHaveLength(1);
      expect(cached[0].id).toBe(rule.id);
      expect(cached[0].actions[0].roleId).toBe("role-1");
      expect(cached[0].conditions.roleIds).toEqual(["role-vip"]);
    });
  });
});
