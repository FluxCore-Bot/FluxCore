/**
 * Integration tests: Scheduled messages persistence
 *
 * Verifies that the dashboard can create, read, update, and delete
 * scheduled messages via the persistence layer, and that the scheduler
 * can find due messages.
 * Uses a REAL PostgreSQL test database -- no DB mocks.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDatabase, cleanTestData, teardownTestDatabase } from "../helpers/db.js";
import { getPrisma } from "@fluxcore/database";
import {
  getScheduledMessages,
  getScheduledMessageById,
  createScheduledMessage,
  updateScheduledMessage,
  deleteScheduledMessage,
  getDueMessages,
  markMessageExecuted,
} from "../../src/scheduled-messages/persistence.js";

const GUILD_ID = "test-guild-1";

describe("Scheduled messages persistence", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestData();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe("createScheduledMessage", () => {
    it("creates a new scheduled message", async () => {
      const msg = await createScheduledMessage(GUILD_ID, {
        channelId: "ch-1",
        name: "Daily Update",
        message: { type: "text", content: "Hello world!" },
        cronExpr: "0 9 * * *",
        createdBy: "user-1",
      });

      expect(msg.id).toBeGreaterThan(0);
      expect(msg.guildId).toBe(GUILD_ID);
      expect(msg.name).toBe("Daily Update");
      expect(msg.message.type).toBe("text");
      expect(msg.cronExpr).toBe("0 9 * * *");
      expect(msg.timezone).toBe("UTC");
      expect(msg.enabled).toBe(true);
      expect(msg.nextRunAt).not.toBeNull();
    });

    it("creates a disabled message with null nextRunAt", async () => {
      const msg = await createScheduledMessage(GUILD_ID, {
        channelId: "ch-1",
        name: "Disabled Msg",
        message: { type: "text", content: "test" },
        cronExpr: "0 9 * * *",
        enabled: false,
        createdBy: "user-1",
      });

      expect(msg.enabled).toBe(false);
      expect(msg.nextRunAt).toBeNull();
    });

    it("creates embed type messages", async () => {
      const msg = await createScheduledMessage(GUILD_ID, {
        channelId: "ch-1",
        name: "Embed Msg",
        message: {
          type: "embed",
          embed: { title: "Test", description: "Hello", color: 0xa3a6ff },
        },
        cronExpr: "0 0 * * *",
        createdBy: "user-1",
      });

      expect(msg.message.type).toBe("embed");
      expect(msg.message.embed?.title).toBe("Test");
      expect(msg.message.embed?.color).toBe(0xa3a6ff);
    });

    it("rejects duplicate names in the same guild", async () => {
      await createScheduledMessage(GUILD_ID, {
        channelId: "ch-1",
        name: "Unique Name",
        message: { type: "text", content: "first" },
        cronExpr: "0 9 * * *",
        createdBy: "user-1",
      });

      await expect(
        createScheduledMessage(GUILD_ID, {
          channelId: "ch-1",
          name: "Unique Name",
          message: { type: "text", content: "second" },
          cronExpr: "0 9 * * *",
          createdBy: "user-1",
        }),
      ).rejects.toThrow();
    });
  });

  describe("getScheduledMessages", () => {
    it("lists messages for a guild with pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await createScheduledMessage(GUILD_ID, {
          channelId: "ch-1",
          name: `Msg ${i}`,
          message: { type: "text", content: `Hello ${i}` },
          cronExpr: "0 9 * * *",
          createdBy: "user-1",
        });
      }

      const page1 = await getScheduledMessages(GUILD_ID, 1, 3);
      expect(page1.messages.length).toBe(3);
      expect(page1.total).toBe(5);

      const page2 = await getScheduledMessages(GUILD_ID, 2, 3);
      expect(page2.messages.length).toBe(2);
    });

    it("returns empty for a guild with no messages", async () => {
      const result = await getScheduledMessages("nonexistent-guild");
      expect(result.messages).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("getScheduledMessageById", () => {
    it("returns the message by ID and guildId", async () => {
      const created = await createScheduledMessage(GUILD_ID, {
        channelId: "ch-1",
        name: "Lookup Test",
        message: { type: "text", content: "hello" },
        cronExpr: "0 9 * * *",
        createdBy: "user-1",
      });

      const found = await getScheduledMessageById(created.id, GUILD_ID);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe("Lookup Test");
    });

    it("returns null for wrong guild", async () => {
      const created = await createScheduledMessage(GUILD_ID, {
        channelId: "ch-1",
        name: "Wrong Guild",
        message: { type: "text", content: "test" },
        cronExpr: "0 9 * * *",
        createdBy: "user-1",
      });

      const found = await getScheduledMessageById(created.id, "other-guild");
      expect(found).toBeNull();
    });
  });

  describe("updateScheduledMessage", () => {
    it("updates message fields", async () => {
      const created = await createScheduledMessage(GUILD_ID, {
        channelId: "ch-1",
        name: "Update Test",
        message: { type: "text", content: "original" },
        cronExpr: "0 9 * * *",
        createdBy: "user-1",
      });

      const updated = await updateScheduledMessage(created.id, GUILD_ID, {
        name: "Updated Name",
        message: { type: "text", content: "updated content" },
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe("Updated Name");
      expect(updated!.message.content).toBe("updated content");
    });

    it("disabling sets nextRunAt to null", async () => {
      const created = await createScheduledMessage(GUILD_ID, {
        channelId: "ch-1",
        name: "Disable Test",
        message: { type: "text", content: "test" },
        cronExpr: "0 9 * * *",
        createdBy: "user-1",
      });
      expect(created.nextRunAt).not.toBeNull();

      const updated = await updateScheduledMessage(created.id, GUILD_ID, {
        enabled: false,
      });
      expect(updated!.enabled).toBe(false);
      expect(updated!.nextRunAt).toBeNull();
    });

    it("re-enabling recalculates nextRunAt", async () => {
      const created = await createScheduledMessage(GUILD_ID, {
        channelId: "ch-1",
        name: "Re-enable Test",
        message: { type: "text", content: "test" },
        cronExpr: "0 9 * * *",
        enabled: false,
        createdBy: "user-1",
      });
      expect(created.nextRunAt).toBeNull();

      const updated = await updateScheduledMessage(created.id, GUILD_ID, {
        enabled: true,
      });
      expect(updated!.enabled).toBe(true);
      expect(updated!.nextRunAt).not.toBeNull();
    });

    it("returns null for non-existent message", async () => {
      const result = await updateScheduledMessage(99999, GUILD_ID, { name: "nope" });
      expect(result).toBeNull();
    });
  });

  describe("deleteScheduledMessage", () => {
    it("deletes an existing message", async () => {
      const created = await createScheduledMessage(GUILD_ID, {
        channelId: "ch-1",
        name: "Delete Test",
        message: { type: "text", content: "bye" },
        cronExpr: "0 9 * * *",
        createdBy: "user-1",
      });

      const deleted = await deleteScheduledMessage(created.id, GUILD_ID);
      expect(deleted).toBe(true);

      const found = await getScheduledMessageById(created.id, GUILD_ID);
      expect(found).toBeNull();
    });

    it("returns false for non-existent message", async () => {
      const deleted = await deleteScheduledMessage(99999, GUILD_ID);
      expect(deleted).toBe(false);
    });
  });

  describe("getDueMessages", () => {
    it("returns messages where nextRunAt <= now and enabled", async () => {
      const prisma = getPrisma();

      // Create a message with nextRunAt in the past
      await prisma.scheduledMessage.create({
        data: {
          guildId: GUILD_ID,
          channelId: "ch-1",
          name: "Due Message",
          message: JSON.stringify({ type: "text", content: "due!" }),
          cronExpr: "0 9 * * *",
          timezone: "UTC",
          enabled: true,
          nextRunAt: new Date(Date.now() - 60_000), // 1 minute ago
          createdBy: "user-1",
        },
      });

      // Create a future message (should not be returned)
      await prisma.scheduledMessage.create({
        data: {
          guildId: GUILD_ID,
          channelId: "ch-1",
          name: "Future Message",
          message: JSON.stringify({ type: "text", content: "future!" }),
          cronExpr: "0 9 * * *",
          timezone: "UTC",
          enabled: true,
          nextRunAt: new Date(Date.now() + 3_600_000), // 1 hour from now
          createdBy: "user-1",
        },
      });

      // Create a disabled message with past nextRunAt (should not be returned)
      await prisma.scheduledMessage.create({
        data: {
          guildId: GUILD_ID,
          channelId: "ch-1",
          name: "Disabled Due",
          message: JSON.stringify({ type: "text", content: "disabled" }),
          cronExpr: "0 9 * * *",
          timezone: "UTC",
          enabled: false,
          nextRunAt: new Date(Date.now() - 60_000),
          createdBy: "user-1",
        },
      });

      const due = await getDueMessages();
      expect(due.length).toBe(1);
      expect(due[0].name).toBe("Due Message");
    });
  });

  describe("markMessageExecuted", () => {
    it("updates lastRunAt and recalculates nextRunAt", async () => {
      const prisma = getPrisma();

      const created = await prisma.scheduledMessage.create({
        data: {
          guildId: GUILD_ID,
          channelId: "ch-1",
          name: "Mark Executed",
          message: JSON.stringify({ type: "text", content: "test" }),
          cronExpr: "0 9 * * *",
          timezone: "UTC",
          enabled: true,
          nextRunAt: new Date(Date.now() - 60_000),
          createdBy: "user-1",
        },
      });

      await markMessageExecuted(created.id, "0 9 * * *", "UTC");

      const updated = await prisma.scheduledMessage.findUnique({
        where: { id: created.id },
      });

      expect(updated!.lastRunAt).not.toBeNull();
      expect(updated!.nextRunAt).not.toBeNull();
      expect(updated!.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
