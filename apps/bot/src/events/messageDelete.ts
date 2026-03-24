import type { Event } from "@fluxcore/types";
import type { Message, PartialMessage } from "discord.js";
import { getLogConfig, isIgnored } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatMessageDelete } from "@fluxcore/systems/logging/formatter";

const event: Event<"messageDelete"> = {
  name: "messageDelete",
  async execute(message: Message | PartialMessage) {
    if (!message.guild || message.author?.bot) return;

    const config = await getLogConfig(message.guild.id, "message");
    if (!config?.enabled) return;
    if (isIgnored(config, message.channelId, message.member?.roles)) return;

    const embed = formatMessageDelete(message);
    await sendLogEmbed(message.guild, config.channelId, embed);

    await createLogEntry({
      guildId: message.guild.id,
      category: "message",
      eventType: "messageDelete",
      targetId: message.author?.id,
      content: {
        channelId: message.channelId,
        messageContent: message.content?.slice(0, 2000),
        attachments: message.attachments?.map((a) => ({ name: a.name, url: a.proxyURL })) ?? [],
      },
    });
  },
};

export default event;
