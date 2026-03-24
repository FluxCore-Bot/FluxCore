import type { Event } from "@fluxcore/types";
import type { Role } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatRoleEvent } from "@fluxcore/systems/logging/formatter";

const event: Event<"roleDelete"> = {
  name: "roleDelete",
  async execute(role: Role) {
    const config = await getLogConfig(role.guild.id, "role");
    if (!config?.enabled) return;

    const embed = formatRoleEvent("delete", role);
    await sendLogEmbed(role.guild, config.channelId, embed);

    await createLogEntry({
      guildId: role.guild.id,
      category: "role",
      eventType: "roleDelete",
      targetId: role.id,
      content: {
        name: role.name,
        color: role.hexColor,
      },
    });
  },
};

export default event;
