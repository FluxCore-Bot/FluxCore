import type { Event } from "@fluxcore/types";
import type { GuildChannel } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatChannelEvent } from "@fluxcore/systems/logging/formatter";

const event: Event<"channelCreate"> = {
  name: "channelCreate",
  async execute(channel: GuildChannel) {
    if (!channel.guild) return;

    const config = await getLogConfig(channel.guild.id, "channel");
    if (!config?.enabled) return;

    const embed = formatChannelEvent("create", channel);
    await sendLogEmbed(channel.guild, config.channelId, embed);

    await createLogEntry({
      guildId: channel.guild.id,
      category: "channel",
      eventType: "channelCreate",
      targetId: channel.id,
      content: {
        name: channel.name,
        type: channel.type,
      },
    });
  },
};

export default event;
