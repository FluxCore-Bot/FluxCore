import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    logLevel: "info",
  },
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock database
const mockPrisma = {
  rolePanel: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
};
vi.mock("@fluxcore/database", () => ({
  getPrisma: () => mockPrisma,
}));

// Mock discord.js for builder tests
vi.mock("discord.js", () => {
  class MockButtonBuilder {
    data: Record<string, unknown> = {};
    setCustomId(id: string) { this.data.customId = id; return this; }
    setLabel(label: string) { this.data.label = label; return this; }
    setStyle(style: number) { this.data.style = style; return this; }
    setEmoji(emoji: string) { this.data.emoji = emoji; return this; }
  }

  class MockActionRowBuilder {
    components: unknown[] = [];
    addComponents(...items: unknown[]) {
      this.components.push(...items);
      return this;
    }
  }

  class MockStringSelectMenuBuilder {
    data: Record<string, unknown> = {};
    options: unknown[] = [];
    setCustomId(id: string) { this.data.customId = id; return this; }
    setPlaceholder(p: string) { this.data.placeholder = p; return this; }
    setMinValues(n: number) { this.data.minValues = n; return this; }
    setMaxValues(n: number) { this.data.maxValues = n; return this; }
    addOptions(opts: unknown[]) { this.options = opts; return this; }
  }

  class MockEmbedBuilder {
    data: Record<string, unknown> = {};
    setTitle(t: string) { this.data.title = t; return this; }
    setDescription(d: string) { this.data.description = d; return this; }
    setColor(c: number) { this.data.color = c; return this; }
    setFooter(f: { text: string }) { this.data.footer = f; return this; }
  }

  return {
    ActionRowBuilder: MockActionRowBuilder,
    ButtonBuilder: MockButtonBuilder,
    ButtonStyle: { Primary: 1, Secondary: 2, Success: 3, Danger: 4 },
    StringSelectMenuBuilder: MockStringSelectMenuBuilder,
    EmbedBuilder: MockEmbedBuilder,
  };
});

import { buildButtonComponents, buildDropdownComponent, buildPanelEmbed } from "../../src/rolePanel/builder.js";
import { getRolePanels, getRolePanel, createRolePanel, deleteRolePanel } from "../../src/rolePanel/persistence.js";
import { handleRolePanelButton, handleRolePanelDropdown } from "../../src/rolePanel/handler.js";
import type { RolePanel } from "../../src/rolePanel/types.js";

function createTestPanel(overrides: Partial<RolePanel> = {}): RolePanel {
  return {
    id: 1,
    guildId: "guild-1",
    channelId: "ch-1",
    messageId: null,
    name: "Test Panel",
    type: "button",
    mode: "toggle",
    embed: "{}",
    roles: [
      { roleId: "role-1", label: "Red", style: 2 },
      { roleId: "role-2", label: "Blue", style: 1 },
    ],
    maxRoles: null,
    minRoles: null,
    createdBy: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("rolePanel builder", () => {
  describe("buildButtonComponents", () => {
    it("creates button rows from panel roles", () => {
      const panel = createTestPanel();
      const rows = buildButtonComponents(panel);

      expect(rows).toHaveLength(1);
      expect(rows[0].components).toHaveLength(2);
    });

    it("splits into multiple rows when exceeding 5 buttons", () => {
      const roles = Array.from({ length: 7 }, (_, i) => ({
        roleId: `role-${i}`,
        label: `Role ${i}`,
        style: 2,
      }));
      const panel = createTestPanel({ roles });
      const rows = buildButtonComponents(panel);

      expect(rows).toHaveLength(2);
      expect(rows[0].components).toHaveLength(5);
      expect(rows[1].components).toHaveLength(2);
    });

    it("returns empty array for panel with no roles", () => {
      const panel = createTestPanel({ roles: [] });
      const rows = buildButtonComponents(panel);

      expect(rows).toHaveLength(0);
    });

    it("sets emoji on button when provided", () => {
      const panel = createTestPanel({
        roles: [{ roleId: "role-1", label: "Red", emoji: "red_circle", style: 2 }],
      });
      const rows = buildButtonComponents(panel);

      expect(rows).toHaveLength(1);
      const button = rows[0].components[0] as { data: Record<string, unknown> };
      expect(button.data.emoji).toBe("red_circle");
    });
  });

  describe("buildDropdownComponent", () => {
    it("creates a dropdown with options from panel roles", () => {
      const panel = createTestPanel({ type: "dropdown" });
      const row = buildDropdownComponent(panel);

      expect(row.components).toHaveLength(1);
      const menu = row.components[0] as { data: Record<string, unknown>; options: unknown[] };
      expect(menu.data.customId).toBe("rpd_1");
      expect(menu.options).toHaveLength(2);
    });

    it("respects min/max roles settings", () => {
      const panel = createTestPanel({ type: "dropdown", minRoles: 1, maxRoles: 3 });
      const row = buildDropdownComponent(panel);

      const menu = row.components[0] as { data: Record<string, unknown> };
      expect(menu.data.minValues).toBe(1);
      expect(menu.data.maxValues).toBe(3);
    });
  });

  describe("buildPanelEmbed", () => {
    it("uses panel name as default title", () => {
      const panel = createTestPanel();
      const embed = buildPanelEmbed(panel);

      expect((embed as unknown as { data: Record<string, unknown> }).data.title).toBe("Test Panel");
    });

    it("uses embed config title when provided", () => {
      const panel = createTestPanel({
        embed: JSON.stringify({ title: "Custom Title", description: "Custom desc" }),
      });
      const embed = buildPanelEmbed(panel);

      expect((embed as unknown as { data: Record<string, unknown> }).data.title).toBe("Custom Title");
      expect((embed as unknown as { data: Record<string, unknown> }).data.description).toBe("Custom desc");
    });

    it("sets default accent color", () => {
      const panel = createTestPanel();
      const embed = buildPanelEmbed(panel);

      expect((embed as unknown as { data: Record<string, unknown> }).data.color).toBe(0xa3a6ff);
    });

    it("handles invalid embed JSON gracefully", () => {
      const panel = createTestPanel({ embed: "not-json" });
      const embed = buildPanelEmbed(panel);

      // Should still create an embed with defaults
      expect((embed as unknown as { data: Record<string, unknown> }).data.title).toBe("Test Panel");
    });
  });
});

describe("rolePanel persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRolePanels", () => {
    it("queries panels by guildId", async () => {
      mockPrisma.rolePanel.findMany.mockResolvedValueOnce([
        {
          id: 1,
          guildId: "guild-1",
          channelId: "ch-1",
          messageId: null,
          name: "Test",
          type: "button",
          mode: "toggle",
          embed: "{}",
          roles: '[{"roleId":"r1","label":"Red"}]',
          maxRoles: null,
          minRoles: null,
          createdBy: "u1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const panels = await getRolePanels("guild-1");

      expect(panels).toHaveLength(1);
      expect(panels[0].roles).toEqual([{ roleId: "r1", label: "Red" }]);
      expect(mockPrisma.rolePanel.findMany).toHaveBeenCalledWith({
        where: { guildId: "guild-1" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("getRolePanel", () => {
    it("returns null when not found", async () => {
      mockPrisma.rolePanel.findUnique.mockResolvedValueOnce(null);

      const panel = await getRolePanel(999);
      expect(panel).toBeNull();
    });

    it("parses roles JSON", async () => {
      mockPrisma.rolePanel.findUnique.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-1",
        channelId: "ch-1",
        messageId: null,
        name: "Test",
        type: "button",
        mode: "toggle",
        embed: "{}",
        roles: '[{"roleId":"r1","label":"One"}]',
        maxRoles: null,
        minRoles: null,
        createdBy: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const panel = await getRolePanel(1);
      expect(panel).not.toBeNull();
      expect(panel!.roles).toEqual([{ roleId: "r1", label: "One" }]);
    });
  });

  describe("createRolePanel", () => {
    it("creates a panel with serialized roles", async () => {
      const now = new Date();
      mockPrisma.rolePanel.create.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-1",
        channelId: "ch-1",
        messageId: null,
        name: "New Panel",
        type: "button",
        mode: "toggle",
        embed: "{}",
        roles: '[{"roleId":"r1","label":"Red"}]',
        maxRoles: null,
        minRoles: null,
        createdBy: "user-1",
        createdAt: now,
        updatedAt: now,
      });

      const panel = await createRolePanel({
        guildId: "guild-1",
        channelId: "ch-1",
        name: "New Panel",
        type: "button",
        createdBy: "user-1",
        roles: [{ roleId: "r1", label: "Red" }],
      });

      expect(panel.name).toBe("New Panel");
      expect(mockPrisma.rolePanel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guildId: "guild-1",
          name: "New Panel",
          roles: '[{"roleId":"r1","label":"Red"}]',
        }),
      });
    });
  });

  describe("deleteRolePanel", () => {
    it("returns true when panel was deleted", async () => {
      mockPrisma.rolePanel.deleteMany.mockResolvedValueOnce({ count: 1 });

      const result = await deleteRolePanel(1, "guild-1");
      expect(result).toBe(true);
    });

    it("returns false when panel was not found", async () => {
      mockPrisma.rolePanel.deleteMany.mockResolvedValueOnce({ count: 0 });

      const result = await deleteRolePanel(999, "guild-1");
      expect(result).toBe(false);
    });
  });
});

describe("rolePanel handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockButtonInteraction(hasRole: boolean) {
    return {
      reply: vi.fn(),
      member: {
        roles: {
          cache: {
            has: vi.fn().mockImplementation((id: string) => {
              if (hasRole && id === "role-1") return true;
              return false;
            }),
          },
          add: vi.fn(),
          remove: vi.fn(),
        },
      },
    };
  }

  describe("handleRolePanelButton", () => {
    it("replies with error when panel not found", async () => {
      mockPrisma.rolePanel.findUnique.mockResolvedValueOnce(null);
      const interaction = createMockButtonInteraction(false);

      await handleRolePanelButton(interaction as never, 999, "role-1");

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "This role panel no longer exists.",
          ephemeral: true,
        }),
      );
    });

    it("adds role in toggle mode when user does not have it", async () => {
      mockPrisma.rolePanel.findUnique.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-1",
        channelId: "ch-1",
        messageId: "msg-1",
        name: "Test",
        type: "button",
        mode: "toggle",
        embed: "{}",
        roles: '[{"roleId":"role-1","label":"Red"}]',
        maxRoles: null,
        minRoles: null,
        createdBy: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const interaction = createMockButtonInteraction(false);
      await handleRolePanelButton(interaction as never, 1, "role-1");

      expect(interaction.member.roles.add).toHaveBeenCalledWith("role-1");
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Added <@&role-1>",
          ephemeral: true,
        }),
      );
    });

    it("removes role in toggle mode when user already has it", async () => {
      mockPrisma.rolePanel.findUnique.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-1",
        channelId: "ch-1",
        messageId: "msg-1",
        name: "Test",
        type: "button",
        mode: "toggle",
        embed: "{}",
        roles: '[{"roleId":"role-1","label":"Red"}]',
        maxRoles: null,
        minRoles: null,
        createdBy: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const interaction = createMockButtonInteraction(true);
      await handleRolePanelButton(interaction as never, 1, "role-1");

      expect(interaction.member.roles.remove).toHaveBeenCalledWith("role-1");
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Removed <@&role-1>",
          ephemeral: true,
        }),
      );
    });

    it("prevents removal in verify mode", async () => {
      mockPrisma.rolePanel.findUnique.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-1",
        channelId: "ch-1",
        messageId: "msg-1",
        name: "Test",
        type: "button",
        mode: "verify",
        embed: "{}",
        roles: '[{"roleId":"role-1","label":"Verified"}]',
        maxRoles: null,
        minRoles: null,
        createdBy: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const interaction = createMockButtonInteraction(true);
      await handleRolePanelButton(interaction as never, 1, "role-1");

      expect(interaction.member.roles.remove).not.toHaveBeenCalled();
      expect(interaction.member.roles.add).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "You already have this role.",
          ephemeral: true,
        }),
      );
    });

    it("removes other roles in unique mode", async () => {
      mockPrisma.rolePanel.findUnique.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-1",
        channelId: "ch-1",
        messageId: "msg-1",
        name: "Test",
        type: "button",
        mode: "unique",
        embed: "{}",
        roles: '[{"roleId":"role-1","label":"Red"},{"roleId":"role-2","label":"Blue"}]',
        maxRoles: null,
        minRoles: null,
        createdBy: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // User has role-2, clicking role-1
      const interaction = {
        reply: vi.fn(),
        member: {
          roles: {
            cache: {
              has: vi.fn().mockImplementation((id: string) => id === "role-2"),
            },
            add: vi.fn(),
            remove: vi.fn(),
          },
        },
      };

      await handleRolePanelButton(interaction as never, 1, "role-1");

      // Should remove role-2 first, then add role-1
      expect(interaction.member.roles.remove).toHaveBeenCalledWith(["role-2"]);
      expect(interaction.member.roles.add).toHaveBeenCalledWith("role-1");
    });
  });

  describe("handleRolePanelDropdown", () => {
    it("replies with error when panel not found", async () => {
      mockPrisma.rolePanel.findUnique.mockResolvedValueOnce(null);
      const interaction = {
        reply: vi.fn(),
        member: { roles: { cache: { has: vi.fn() }, add: vi.fn(), remove: vi.fn() } },
      };

      await handleRolePanelDropdown(interaction as never, 999, ["role-1"]);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "This role panel no longer exists.",
          ephemeral: true,
        }),
      );
    });

    it("adds and removes roles in toggle mode", async () => {
      mockPrisma.rolePanel.findUnique.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-1",
        channelId: "ch-1",
        messageId: "msg-1",
        name: "Test",
        type: "dropdown",
        mode: "toggle",
        embed: "{}",
        roles: '[{"roleId":"role-1","label":"Red"},{"roleId":"role-2","label":"Blue"}]',
        maxRoles: null,
        minRoles: null,
        createdBy: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // User has role-2, selects role-1 only
      const interaction = {
        reply: vi.fn(),
        member: {
          roles: {
            cache: {
              has: vi.fn().mockImplementation((id: string) => id === "role-2"),
            },
            add: vi.fn(),
            remove: vi.fn(),
          },
        },
      };

      await handleRolePanelDropdown(interaction as never, 1, ["role-1"]);

      expect(interaction.member.roles.remove).toHaveBeenCalledWith(["role-2"]);
      expect(interaction.member.roles.add).toHaveBeenCalledWith(["role-1"]);
    });
  });
});
