import type { Event } from "@fluxcore/types";
import type { GuildTextBasedChannel, Message, PartialMessage, ReadonlyCollection } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatBulkDelete } from "@fluxcore/systems/logging/formatter";

const event: Event<"messageDeleteBulk"> = {
  name: "messageDeleteBulk",
  async execute(
    messages: ReadonlyCollection<string, Message<true> | PartialMessage<true>>,
    channel: GuildTextBasedChannel,
  ) {
    const guild = channel.guild;
    if (!guild) return;

    const guildId = guild.id;
    const config = await getLogConfig(guildId, "message");
    if (!config?.enabled) return;

    const embed = formatBulkDelete(channel.id, messages.size);
    // Access the full guild object from the first message if available
    const firstMessage = messages.first();
    if (firstMessage?.guild) {
      await sendLogEmbed(firstMessage.guild, config.channelId, embed);
    }

    await createLogEntry({
      guildId,
      category: "message",
      eventType: "messageBulkDelete",
      content: {
        channelId: channel.id,
        count: messages.size,
      },
    });
  },
};

export default event;
