import { describe, it, expect, vi } from "vitest";
import { pageCommands } from "../../../../src/client/shared/command-palette/sources/pages";
import { serverCommands } from "../../../../src/client/shared/command-palette/sources/servers";
import { actionCommands } from "../../../../src/client/shared/command-palette/sources/actions";
import type { Guild } from "../../../../src/client/shared/lib/schemas";

const t = ((key: string) => key) as unknown as Parameters<typeof pageCommands>[0]["t"];

describe("pageCommands", () => {
  it("returns nothing outside a guild", () => {
    expect(pageCommands({ guildId: undefined, t, can: () => true })).toEqual([]);
  });

  it("includes every page when all permissions are granted", () => {
    expect(pageCommands({ guildId: "g1", t, can: () => true })).toHaveLength(18);
  });

  it("hides pages the viewer cannot see", () => {
    const cmds = pageCommands({
      guildId: "g1",
      t,
      can: (p) => p === "moderation.cases.view",
    });
    // Overview is ungated, moderation is granted; nothing else.
    expect(cmds.map((c) => c.to)).toEqual([
      "/guild/$guildId/overview",
      "/guild/$guildId/moderation",
    ]);
  });

  it("carries the guild id through as a route param", () => {
    const [overview] = pageCommands({ guildId: "g1", t, can: () => true });
    expect(overview.params).toEqual({ guildId: "g1" });
    expect(overview.group).toBe("pages");
  });

  it("resolves keyword hints through the translator", () => {
    const cmds = pageCommands({ guildId: "g1", t, can: () => true });
    const automation = cmds.find((c) => c.to === "/guild/$guildId/rules");
    expect(automation?.keywords).toBe("palette.keywords.automation");
  });
});

describe("serverCommands", () => {
  const guilds: Guild[] = [
    { id: "g1", name: "Etqan", icon: null, botPresent: true },
    { id: "g2", name: "No Bot", icon: null, botPresent: false },
  ];

  it("offers only servers the bot is actually in", () => {
    const cmds = serverCommands({ guilds });
    expect(cmds).toHaveLength(1);
    expect(cmds[0].title).toBe("Etqan");
  });

  it("routes to the guild overview", () => {
    const [first] = serverCommands({ guilds });
    expect(first.to).toBe("/guild/$guildId/overview");
    expect(first.params).toEqual({ guildId: "g1" });
    expect(first.group).toBe("servers");
  });

  it("tolerates an empty list", () => {
    expect(serverCommands({ guilds: [] })).toEqual([]);
  });
});

describe("actionCommands", () => {
  it("offers guild-scoped actions only inside a guild", () => {
    const outside = actionCommands({
      guildId: undefined, t,
      onRefreshGuild: vi.fn(), onRefreshGuildList: vi.fn(), inviteUrl: null,
    });
    expect(outside.map((c) => c.id)).not.toContain("action:refreshGuild");
    expect(outside.map((c) => c.id)).toContain("action:refreshGuildList");
  });

  it("offers the guild refresh inside a guild", () => {
    const inside = actionCommands({
      guildId: "g1", t,
      onRefreshGuild: vi.fn(), onRefreshGuildList: vi.fn(), inviteUrl: null,
    });
    expect(inside.map((c) => c.id)).toContain("action:refreshGuild");
    expect(inside.map((c) => c.id)).toContain("action:backToServers");
  });

  it("runs the supplied callback on select", () => {
    const onRefreshGuild = vi.fn();
    const cmds = actionCommands({
      guildId: "g1", t,
      onRefreshGuild, onRefreshGuildList: vi.fn(), inviteUrl: null,
    });
    cmds.find((c) => c.id === "action:refreshGuild")?.onSelect?.();
    expect(onRefreshGuild).toHaveBeenCalledOnce();
  });

  it("omits the invite action when there is no invite url", () => {
    const cmds = actionCommands({
      guildId: "g1", t,
      onRefreshGuild: vi.fn(), onRefreshGuildList: vi.fn(), inviteUrl: null,
    });
    expect(cmds.map((c) => c.id)).not.toContain("action:addToServer");
  });

  it("includes the invite action as an external link when a url exists", () => {
    const cmds = actionCommands({
      guildId: "g1", t,
      onRefreshGuild: vi.fn(), onRefreshGuildList: vi.fn(),
      inviteUrl: "https://discord.com/invite",
    });
    const invite = cmds.find((c) => c.id === "action:addToServer");
    expect(invite?.href).toBe("https://discord.com/invite");
  });
});
