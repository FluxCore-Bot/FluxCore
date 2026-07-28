import type { Guild } from "../../lib/schemas";
import type { Command } from "../types";

export function serverCommands(opts: { guilds: Guild[] }): Command[] {
  const { guilds } = opts;

  // Bot-less guilds are deliberately excluded: every dashboard page for such a
  // guild 403s (requireGuildAccess checks isBotInGuild first), so offering them
  // here would be offering a dead end. They remain visible on the server list,
  // where the invite affordance lives.
  return guilds
    .filter((g) => g.botPresent)
    .map((g) => ({
      id: `server:${g.id}`,
      group: "servers" as const,
      title: g.name,
      icon: "dns",
      to: "/guild/$guildId/overview",
      params: { guildId: g.id },
    }));
}
