import type { Event } from "@fluxcore/types";
import type { Role } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatRoleEvent } from "@fluxcore/systems/logging/formatter";

const event: Event<"roleUpdate"> = {
  name: "roleUpdate",
  async execute(oldRole: Role, newRole: Role) {
    const config = await getLogConfig(newRole.guild.id, "role");
    if (!config?.enabled) return;

    const embed = formatRoleEvent("update", newRole);

    const changes: string[] = [];
    if (oldRole.name !== newRole.name) {
      changes.push(`**Name:** ${oldRole.name} -> ${newRole.name}`);
    }
    if (oldRole.hexColor !== newRole.hexColor) {
      changes.push(`**Color:** ${oldRole.hexColor} -> ${newRole.hexColor}`);
    }
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      changes.push("**Permissions** were changed");
    }
    if (changes.length > 0) {
      embed.setDescription(changes.join("\n"));
    }

    await sendLogEmbed(newRole.guild, config.channelId, embed);

    await createLogEntry({
      guildId: newRole.guild.id,
      category: "role",
      eventType: "roleUpdate",
      targetId: newRole.id,
      content: {
        name: newRole.name,
        oldName: oldRole.name,
        color: newRole.hexColor,
        oldColor: oldRole.hexColor,
      },
    });
  },
};

export default event;
