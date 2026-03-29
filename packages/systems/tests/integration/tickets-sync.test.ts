/**
 * Integration tests: Ticket system persistence
 *
 * Verifies that ticket CRUD operations work correctly with a real database.
 * Uses a REAL PostgreSQL test database — no DB mocks.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDatabase, cleanTestData, teardownTestDatabase } from "../helpers/db.js";
import { getPrisma } from "@fluxcore/database";
import {
  createTicket,
  getTicketByChannel,
  getTicketById,
  getTickets,
  getOpenTicketCount,
  closeTicket,
  claimTicket,
  getTicketPanels,
  createTicketPanel,
  updateTicketPanel,
  deleteTicketPanel,
} from "../../src/tickets/persistence.js";
import {
  getTicketSettings,
  upsertTicketSettings,
  incrementTicketCounter,
} from "../../src/tickets/config.js";

const GUILD_ID = "test-guild-1";

describe("Ticket system persistence", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestData();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  // --- Settings ---
  describe("ticket settings", () => {
    it("returns defaults for unconfigured guild", async () => {
      const settings = await getTicketSettings(GUILD_ID);
      expect(settings.guildId).toBe(GUILD_ID);
      expect(settings.maxOpenPerUser).toBe(3);
      expect(settings.staffRoleIds).toEqual([]);
    });

    it("upserts settings correctly", async () => {
      const settings = await upsertTicketSettings(GUILD_ID, {
        staffRoleIds: ["role-1", "role-2"],
        maxOpenPerUser: 5,
        namingFormat: "support-{number}",
      });

      expect(settings.staffRoleIds).toEqual(["role-1", "role-2"]);
      expect(settings.maxOpenPerUser).toBe(5);
      expect(settings.namingFormat).toBe("support-{number}");
    });

    it("increments ticket counter", async () => {
      const counter1 = await incrementTicketCounter(GUILD_ID);
      expect(counter1).toBe(1);

      const counter2 = await incrementTicketCounter(GUILD_ID);
      expect(counter2).toBe(2);

      const counter3 = await incrementTicketCounter(GUILD_ID);
      expect(counter3).toBe(3);
    });
  });

  // --- Tickets ---
  describe("ticket CRUD", () => {
    it("creates and retrieves a ticket by channel", async () => {
      const ticket = await createTicket({
        guildId: GUILD_ID,
        channelId: "channel-1",
        userId: "user-1",
        categoryName: "support",
        formResponses: { "What is your issue?": "Help me!" },
      });

      expect(ticket.id).toBeGreaterThan(0);
      expect(ticket.status).toBe("open");
      expect(ticket.formResponses).toEqual({ "What is your issue?": "Help me!" });

      const found = await getTicketByChannel("channel-1");
      expect(found).not.toBeNull();
      expect(found?.id).toBe(ticket.id);
    });

    it("retrieves a ticket by ID", async () => {
      const ticket = await createTicket({
        guildId: GUILD_ID,
        channelId: "channel-2",
        userId: "user-1",
      });

      const found = await getTicketById(ticket.id);
      expect(found).not.toBeNull();
      expect(found?.channelId).toBe("channel-2");
    });

    it("lists tickets with filters", async () => {
      await createTicket({ guildId: GUILD_ID, channelId: "ch-1", userId: "user-1" });
      await createTicket({ guildId: GUILD_ID, channelId: "ch-2", userId: "user-2" });
      await createTicket({ guildId: GUILD_ID, channelId: "ch-3", userId: "user-1" });

      const allTickets = await getTickets(GUILD_ID);
      expect(allTickets.total).toBe(3);

      const user1Tickets = await getTickets(GUILD_ID, { userId: "user-1" });
      expect(user1Tickets.total).toBe(2);
    });

    it("counts open tickets per user", async () => {
      await createTicket({ guildId: GUILD_ID, channelId: "ch-a", userId: "user-1" });
      await createTicket({ guildId: GUILD_ID, channelId: "ch-b", userId: "user-1" });

      const count = await getOpenTicketCount(GUILD_ID, "user-1");
      expect(count).toBe(2);
    });

    it("claims a ticket", async () => {
      const ticket = await createTicket({
        guildId: GUILD_ID,
        channelId: "ch-claim",
        userId: "user-1",
      });

      const claimed = await claimTicket(ticket.id, "staff-1");
      expect(claimed.status).toBe("claimed");
      expect(claimed.claimedBy).toBe("staff-1");
    });

    it("closes a ticket with reason", async () => {
      const ticket = await createTicket({
        guildId: GUILD_ID,
        channelId: "ch-close",
        userId: "user-1",
      });

      const closed = await closeTicket(ticket.id, "Resolved", "https://example.com/transcript");
      expect(closed.status).toBe("closed");
      expect(closed.closeReason).toBe("Resolved");
      expect(closed.transcriptUrl).toBe("https://example.com/transcript");
      expect(closed.closedAt).not.toBeNull();
    });
  });

  // --- Panels ---
  describe("ticket panel CRUD", () => {
    it("creates and lists panels", async () => {
      await createTicketPanel({
        guildId: GUILD_ID,
        channelId: "panel-ch-1",
        name: "Support",
        categories: [{ name: "general", label: "General Support" }],
        createdBy: "admin-1",
      });

      const panels = await getTicketPanels(GUILD_ID);
      expect(panels).toHaveLength(1);
      expect(panels[0].name).toBe("Support");
      expect(panels[0].categories).toHaveLength(1);
    });

    it("updates a panel", async () => {
      const panel = await createTicketPanel({
        guildId: GUILD_ID,
        channelId: "panel-ch-2",
        name: "Reports",
        createdBy: "admin-1",
      });

      const updated = await updateTicketPanel(panel.id, {
        name: "Bug Reports",
        categories: [
          { name: "bug", label: "Bug Report" },
          { name: "feature", label: "Feature Request" },
        ],
      });

      expect(updated.name).toBe("Bug Reports");
      expect(updated.categories).toHaveLength(2);
    });

    it("deletes a panel", async () => {
      const panel = await createTicketPanel({
        guildId: GUILD_ID,
        channelId: "panel-ch-3",
        name: "ToDelete",
        createdBy: "admin-1",
      });

      await deleteTicketPanel(panel.id, GUILD_ID);

      const panels = await getTicketPanels(GUILD_ID);
      expect(panels).toHaveLength(0);
    });
  });
});
