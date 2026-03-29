/**
 * Integration tests: Starboard sync (dashboard -> bot)
 *
 * Verifies that when the dashboard writes starboard settings/entries to the database,
 * the bot's system logic correctly reads them back.
 * Uses a REAL PostgreSQL test database -- no DB mocks.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDatabase, cleanTestData, teardownTestDatabase } from "../helpers/db.js";
import { createStarboardSettings, createStarboardEntry } from "../helpers/factories.js";
import { getStarboardSettings, upsertStarboardSettings } from "../../src/starboard/config.js";
import {
  getStarboardEntry,
  getStarboardEntries,
  upsertStarboardEntry,
  deleteStarboardEntry,
} from "../../src/starboard/persistence.js";

const GUILD_ID = "test-guild-1";
const GUILD_ID_2 = "test-guild-2";

describe("Starboard sync: dashboard -> bot", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestData();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  // ─── Settings ───────────────────────────────────────────

  describe("getStarboardSettings()", () => {
    it("returns defaults when no settings exist", async () => {
      const settings = await getStarboardSettings(GUILD_ID);

      expect(settings.guildId).toBe(GUILD_ID);
      expect(settings.enabled).toBe(true);
      expect(settings.channelId).toBeNull();
      expect(settings.emoji).toBe("\u2B50");
      expect(settings.threshold).toBe(3);
      expect(settings.selfStar).toBe(false);
      expect(settings.ignoredChannels).toEqual([]);
      expect(settings.nsfwHandling).toBe("ignore");
    });

    it("returns saved settings", async () => {
      await createStarboardSettings({
        guildId: GUILD_ID,
        channelId: "starboard-ch",
        threshold: 5,
        selfStar: true,
        ignoredChannels: ["ch-ignore-1"],
      });

      const settings = await getStarboardSettings(GUILD_ID);

      expect(settings.channelId).toBe("starboard-ch");
      expect(settings.threshold).toBe(5);
      expect(settings.selfStar).toBe(true);
      expect(settings.ignoredChannels).toEqual(["ch-ignore-1"]);
    });
  });

  describe("upsertStarboardSettings()", () => {
    it("creates settings when none exist", async () => {
      const settings = await upsertStarboardSettings(GUILD_ID, {
        channelId: "new-ch",
        threshold: 7,
      });

      expect(settings.guildId).toBe(GUILD_ID);
      expect(settings.channelId).toBe("new-ch");
      expect(settings.threshold).toBe(7);
    });

    it("updates existing settings", async () => {
      await createStarboardSettings({ guildId: GUILD_ID, threshold: 3 });

      const settings = await upsertStarboardSettings(GUILD_ID, {
        threshold: 10,
        selfStar: true,
      });

      expect(settings.threshold).toBe(10);
      expect(settings.selfStar).toBe(true);
    });

    it("correctly serializes ignoredChannels", async () => {
      const settings = await upsertStarboardSettings(GUILD_ID, {
        ignoredChannels: ["ch-a", "ch-b"],
      });

      expect(settings.ignoredChannels).toEqual(["ch-a", "ch-b"]);

      // Re-read to verify it was persisted correctly
      const reread = await getStarboardSettings(GUILD_ID);
      expect(reread.ignoredChannels).toEqual(["ch-a", "ch-b"]);
    });
  });

  // ─── Entries ────────────────────────────────────────────

  describe("getStarboardEntry()", () => {
    it("returns null when no entry exists", async () => {
      const entry = await getStarboardEntry(GUILD_ID, "nonexistent");
      expect(entry).toBeNull();
    });

    it("returns existing entry", async () => {
      await createStarboardEntry({
        guildId: GUILD_ID,
        originalMessageId: "msg-100",
        originalChannelId: "ch-1",
        authorId: "user-1",
        starCount: 5,
      });

      const entry = await getStarboardEntry(GUILD_ID, "msg-100");
      expect(entry).not.toBeNull();
      expect(entry!.starCount).toBe(5);
      expect(entry!.authorId).toBe("user-1");
    });
  });

  describe("upsertStarboardEntry()", () => {
    it("creates new entry", async () => {
      const entry = await upsertStarboardEntry(GUILD_ID, "msg-200", {
        originalChannelId: "ch-1",
        authorId: "user-2",
        starCount: 3,
        starboardMessageId: "star-msg-1",
      });

      expect(entry.originalMessageId).toBe("msg-200");
      expect(entry.starCount).toBe(3);
      expect(entry.starboardMessageId).toBe("star-msg-1");
    });

    it("updates existing entry star count", async () => {
      await createStarboardEntry({
        guildId: GUILD_ID,
        originalMessageId: "msg-300",
        starCount: 3,
      });

      const updated = await upsertStarboardEntry(GUILD_ID, "msg-300", {
        originalChannelId: "ch-1",
        authorId: "user-1",
        starCount: 8,
      });

      expect(updated.starCount).toBe(8);
    });
  });

  describe("deleteStarboardEntry()", () => {
    it("removes entry from database", async () => {
      await createStarboardEntry({
        guildId: GUILD_ID,
        originalMessageId: "msg-400",
      });

      await deleteStarboardEntry(GUILD_ID, "msg-400");

      const entry = await getStarboardEntry(GUILD_ID, "msg-400");
      expect(entry).toBeNull();
    });

    it("does not error when entry does not exist", async () => {
      await expect(
        deleteStarboardEntry(GUILD_ID, "nonexistent"),
      ).resolves.not.toThrow();
    });
  });

  describe("getStarboardEntries()", () => {
    it("returns empty list when no entries exist", async () => {
      const result = await getStarboardEntries(GUILD_ID);
      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("returns entries sorted by star count descending", async () => {
      await createStarboardEntry({
        guildId: GUILD_ID,
        originalMessageId: "msg-low",
        starCount: 3,
      });
      await createStarboardEntry({
        guildId: GUILD_ID,
        originalMessageId: "msg-high",
        starCount: 10,
      });
      await createStarboardEntry({
        guildId: GUILD_ID,
        originalMessageId: "msg-mid",
        starCount: 5,
      });

      const result = await getStarboardEntries(GUILD_ID);

      expect(result.total).toBe(3);
      expect(result.entries[0].originalMessageId).toBe("msg-high");
      expect(result.entries[1].originalMessageId).toBe("msg-mid");
      expect(result.entries[2].originalMessageId).toBe("msg-low");
    });

    it("paginates correctly", async () => {
      // Create 5 entries
      for (let i = 1; i <= 5; i++) {
        await createStarboardEntry({
          guildId: GUILD_ID,
          originalMessageId: `msg-page-${i}`,
          starCount: i,
        });
      }

      const page1 = await getStarboardEntries(GUILD_ID, 1, 2);
      expect(page1.entries).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.entries[0].starCount).toBe(5); // highest first

      const page2 = await getStarboardEntries(GUILD_ID, 2, 2);
      expect(page2.entries).toHaveLength(2);
      expect(page2.total).toBe(5);
    });

    it("only returns entries for the requested guild", async () => {
      await createStarboardEntry({
        guildId: GUILD_ID,
        originalMessageId: "msg-g1",
        starCount: 5,
      });
      await createStarboardEntry({
        guildId: GUILD_ID_2,
        originalMessageId: "msg-g2",
        starCount: 10,
      });

      const result = await getStarboardEntries(GUILD_ID);
      expect(result.total).toBe(1);
      expect(result.entries[0].originalMessageId).toBe("msg-g1");
    });
  });
});
