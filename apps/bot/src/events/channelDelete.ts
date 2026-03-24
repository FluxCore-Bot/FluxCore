import type { Event } from "@fluxcore/types";
import type { DMChannel, GuildChannel } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatChannelEvent } from "@fluxcore/systems/logging/formatter";

const event: Event<"channelDelete"> = {
  name: "channelDelete",
  async execute(channel: DMChannel | GuildChannel) {
    if (!("guild" in channel) || !channel.guild) return;

    const guildChannel = channel as GuildChannel;
    const config = await getLogConfig(guildChannel.guild.id, "channel");
    if (!config?.enabled) return;

    const embed = formatChannelEvent("delete", guildChannel);
    await sendLogEmbed(guildChannel.guild, config.channelId, embed);

    await createLogEntry({
      guildId: guildChannel.guild.id,
      category: "channel",
      eventType: "channelDelete",
      targetId: guildChannel.id,
      content: {
        name: guildChannel.name,
        type: guildChannel.type,
      },
    });
  },
};

export default event;
