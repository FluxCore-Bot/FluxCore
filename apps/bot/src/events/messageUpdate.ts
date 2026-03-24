import type { Event } from "@fluxcore/types";
import type { Message, PartialMessage } from "discord.js";
import { getLogConfig, isIgnored } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatMessageUpdate } from "@fluxcore/systems/logging/formatter";

const event: Event<"messageUpdate"> = {
  name: "messageUpdate",
  async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    // Skip if content did not change (e.g. embed-only updates)
    if (oldMessage.content === newMessage.content) return;

    const config = await getLogConfig(newMessage.guild.id, "message");
    if (!config?.enabled) return;
    if (isIgnored(config, newMessage.channelId, newMessage.member?.roles)) return;

    const embed = formatMessageUpdate(oldMessage, newMessage);
    await sendLogEmbed(newMessage.guild, config.channelId, embed);

    await createLogEntry({
      guildId: newMessage.guild.id,
      category: "message",
      eventType: "messageUpdate",
      targetId: newMessage.author?.id,
      content: {
        channelId: newMessage.channelId,
        before: oldMessage.content?.slice(0, 2000),
        after: newMessage.content?.slice(0, 2000),
      },
    });
  },
};

export default event;
