import type { Event } from "@fluxcore/types";
import type { Guild } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatGuildUpdate } from "@fluxcore/systems/logging/formatter";

const event: Event<"guildUpdate"> = {
  name: "guildUpdate",
  async execute(oldGuild: Guild, newGuild: Guild) {
    const config = await getLogConfig(newGuild.id, "server");
    if (!config?.enabled) return;

    const embed = formatGuildUpdate(oldGuild, newGuild);
    await sendLogEmbed(newGuild, config.channelId, embed);

    await createLogEntry({
      guildId: newGuild.id,
      category: "server",
      eventType: "serverUpdate",
      content: {
        oldName: oldGuild.name,
        newName: newGuild.name,
      },
    });
  },
};

export default event;
