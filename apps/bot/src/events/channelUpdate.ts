import type { Event } from "@fluxcore/types";
import type { DMChannel, GuildChannel } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatChannelEvent } from "@fluxcore/systems/logging/formatter";

const event: Event<"channelUpdate"> = {
  name: "channelUpdate",
  async execute(
    oldChannel: DMChannel | GuildChannel,
    newChannel: DMChannel | GuildChannel,
  ) {
    if (!("guild" in newChannel) || !newChannel.guild) return;

    const guildChannel = newChannel as GuildChannel;
    const config = await getLogConfig(guildChannel.guild.id, "channel");
    if (!config?.enabled) return;

    const embed = formatChannelEvent("update", guildChannel);

    // Add change details
    const oldGuildChannel = oldChannel as GuildChannel;
    const changes: string[] = [];
    if (oldGuildChannel.name !== guildChannel.name) {
      changes.push(`**Name:** ${oldGuildChannel.name} -> ${guildChannel.name}`);
    }
    if (changes.length > 0) {
      embed.setDescription(changes.join("\n"));
    }

    await sendLogEmbed(guildChannel.guild, config.channelId, embed);

    await createLogEntry({
      guildId: guildChannel.guild.id,
      category: "channel",
      eventType: "channelUpdate",
      targetId: guildChannel.id,
      content: {
        name: guildChannel.name,
        oldName: oldGuildChannel.name,
      },
    });
  },
};

export default event;
