/**
 * Integration tests: Music settings sync (dashboard → bot)
 *
 * Verifies that when the dashboard writes music settings to the database,
 * the bot's in-memory cache and reactive callbacks respond correctly.
 * Uses a REAL PostgreSQL test database — no DB mocks.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDatabase, cleanTestData, teardownTestDatabase } from "../helpers/db.js";
import { createMusicSettings } from "../helpers/factories.js";
import { getPrisma } from "@fluxcore/database";
import {
  loadMusicSettings,
  loadMusicSettingsForGuild,
  getMusicSettings,
  fetchMusicSettings,
  upsertMusicSettings,
  onMusicSettingsChanged,
  getAllMusicGuildIds,
  get247Guilds,
} from "../../src/music/config.js";

const GUILD_ID = "test-guild-1";
const GUILD_ID_2 = "test-guild-2";

describe("Music settings sync: dashboard → bot cache", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestData();
    // Reset callback
    onMusicSettingsChanged(() => {});
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  // ─── Full Load ───────────────────────────────────────────

  describe("loadMusicSettings()", () => {
    it("loads all guild settings from DB into cache", async () => {
      await createMusicSettings({ guildId: GUILD_ID, defaultVolume: 75 });
      await createMusicSettings({ guildId: GUILD_ID_2, defaultVolume: 30 });

      await loadMusicSettings();

      expect(getMusicSettings(GUILD_ID).defaultVolume).toBe(75);
      expect(getMusicSettings(GUILD_ID_2).defaultVolume).toBe(30);
      expect(getAllMusicGuildIds()).toHaveLength(2);
    });

    it("returns defaults for unknown guilds", async () => {
      await loadMusicSettings();

      const settings = getMusicSettings("nonexistent-guild");
      expect(settings.defaultVolume).toBe(50);
      expect(settings.twentyFourSeven).toBe(false);
      expect(settings.mode).toBe("open");
    });
  });

  // ─── Per-Guild Reload (the real sync path) ───────────────

  describe("loadMusicSettingsForGuild() — triggered by cache invalidation", () => {
    it("picks up new settings created via dashboard", async () => {
      // Dashboard writes settings
      await createMusicSettings({
        guildId: GUILD_ID,
        defaultVolume: 80,
        twentyFourSeven: true,
        lastChannelId: "vc-1",
      });

      // Bot receives invalidation → reloads this guild
      await loadMusicSettingsForGuild(GUILD_ID);

      const cached = getMusicSettings(GUILD_ID);
      expect(cached.defaultVolume).toBe(80);
      expect(cached.twentyFourSeven).toBe(true);
      expect(cached.lastChannelId).toBe("vc-1");
    });

    it("picks up volume changes from dashboard", async () => {
      await createMusicSettings({ guildId: GUILD_ID, defaultVolume: 50 });
      await loadMusicSettingsForGuild(GUILD_ID);

      // Dashboard changes volume
      const prisma = getPrisma();
      await prisma.musicGuildSettings.update({
        where: { guildId: GUILD_ID },
        data: { defaultVolume: 25 },
      });

      await loadMusicSettingsForGuild(GUILD_ID);
      expect(getMusicSettings(GUILD_ID).defaultVolume).toBe(25);
    });

    it("picks up 24/7 toggle from dashboard", async () => {
      await createMusicSettings({
        guildId: GUILD_ID,
        twentyFourSeven: false,
      });
      await loadMusicSettingsForGuild(GUILD_ID);

      // Dashboard enables 24/7
      const prisma = getPrisma();
      await prisma.musicGuildSettings.update({
        where: { guildId: GUILD_ID },
        data: { twentyFourSeven: true, lastChannelId: "vc-1" },
      });

      await loadMusicSettingsForGuild(GUILD_ID);
      expect(getMusicSettings(GUILD_ID).twentyFourSeven).toBe(true);
    });

    it("reverts to defaults when settings are deleted", async () => {
      await createMusicSettings({ guildId: GUILD_ID, defaultVolume: 80 });
      await loadMusicSettingsForGuild(GUILD_ID);
      expect(getMusicSettings(GUILD_ID).defaultVolume).toBe(80);

      // Settings deleted (guild removed etc.)
      const prisma = getPrisma();
      await prisma.musicGuildSettings.delete({ where: { guildId: GUILD_ID } });

      await loadMusicSettingsForGuild(GUILD_ID);
      expect(getMusicSettings(GUILD_ID).defaultVolume).toBe(50); // default
    });
  });

  // ─── Change Callback (settingsReactor integration) ───────

  describe("onMusicSettingsChanged() callback", () => {
    it("fires when settings change", async () => {
      const callback = vi.fn();
      onMusicSettingsChanged(callback);

      await createMusicSettings({ guildId: GUILD_ID, defaultVolume: 50 });
      await loadMusicSettingsForGuild(GUILD_ID);

      // Dashboard changes volume
      const prisma = getPrisma();
      await prisma.musicGuildSettings.update({
        where: { guildId: GUILD_ID },
        data: { defaultVolume: 80 },
      });

      await loadMusicSettingsForGuild(GUILD_ID);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        GUILD_ID,
        expect.objectContaining({ defaultVolume: 50 }),
        expect.objectContaining({ defaultVolume: 80 }),
      );
    });

    it("fires when 24/7 is toggled on", async () => {
      const callback = vi.fn();
      onMusicSettingsChanged(callback);

      await createMusicSettings({ guildId: GUILD_ID, twentyFourSeven: false });
      await loadMusicSettingsForGuild(GUILD_ID);

      const prisma = getPrisma();
      await prisma.musicGuildSettings.update({
        where: { guildId: GUILD_ID },
        data: { twentyFourSeven: true, lastChannelId: "vc-1" },
      });

      await loadMusicSettingsForGuild(GUILD_ID);

      expect(callback).toHaveBeenCalledWith(
        GUILD_ID,
        expect.objectContaining({ twentyFourSeven: false }),
        expect.objectContaining({ twentyFourSeven: true, lastChannelId: "vc-1" }),
      );
    });

    it("does NOT fire when settings are unchanged", async () => {
      const callback = vi.fn();
      onMusicSettingsChanged(callback);

      await createMusicSettings({ guildId: GUILD_ID, defaultVolume: 50 });
      await loadMusicSettingsForGuild(GUILD_ID);

      // Reload again without changes
      await loadMusicSettingsForGuild(GUILD_ID);

      // First call fires (default → new), second should not fire
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("provides correct old and new values for DJ role change", async () => {
      const callback = vi.fn();
      onMusicSettingsChanged(callback);

      await createMusicSettings({ guildId: GUILD_ID, djRoleId: null, mode: "open" });
      await loadMusicSettingsForGuild(GUILD_ID);

      const prisma = getPrisma();
      await prisma.musicGuildSettings.update({
        where: { guildId: GUILD_ID },
        data: { djRoleId: "role-dj", mode: "library" },
      });

      await loadMusicSettingsForGuild(GUILD_ID);

      const [, , oldSettings, newSettings] = callback.mock.calls[callback.mock.calls.length - 1];
      expect(oldSettings.djRoleId).toBeNull();
      expect(oldSettings.mode).toBe("open");
      expect(newSettings.djRoleId).toBe("role-dj");
      expect(newSettings.mode).toBe("library");
    });
  });

  // ─── upsertMusicSettings (used by dashboard route) ──────

  describe("upsertMusicSettings()", () => {
    it("creates settings and updates cache atomically", async () => {
      const result = await upsertMusicSettings(GUILD_ID, {
        defaultVolume: 70,
        twentyFourSeven: true,
      });

      expect(result.defaultVolume).toBe(70);
      expect(result.twentyFourSeven).toBe(true);

      // Cache is also updated (no reload needed for local writes)
      expect(getMusicSettings(GUILD_ID).defaultVolume).toBe(70);
    });

    it("updates existing settings via upsert", async () => {
      await upsertMusicSettings(GUILD_ID, { defaultVolume: 50 });
      await upsertMusicSettings(GUILD_ID, { defaultVolume: 90 });

      expect(getMusicSettings(GUILD_ID).defaultVolume).toBe(90);

      // Verify DB is also correct
      const dbSettings = await fetchMusicSettings(GUILD_ID);
      expect(dbSettings.defaultVolume).toBe(90);
    });
  });

  // ─── 24/7 Guild Tracking ────────────────────────────────

  describe("get247Guilds()", () => {
    it("returns only guilds with 24/7 enabled and a channel set", async () => {
      await createMusicSettings({
        guildId: GUILD_ID,
        twentyFourSeven: true,
        lastChannelId: "vc-1",
      });
      await createMusicSettings({
        guildId: GUILD_ID_2,
        twentyFourSeven: true,
        lastChannelId: null, // No channel — should not be included
      });
      await createMusicSettings({
        guildId: "test-guild-3",
        twentyFourSeven: false,
        lastChannelId: "vc-2",
      });

      await loadMusicSettings();
      const guilds = get247Guilds();

      expect(guilds).toHaveLength(1);
      expect(guilds[0].guildId).toBe(GUILD_ID);
    });
  });
});
