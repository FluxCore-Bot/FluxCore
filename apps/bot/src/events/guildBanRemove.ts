import type { Event } from "@fluxcore/types";
import type { GuildBan } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatUnban } from "@fluxcore/systems/logging/formatter";

const event: Event<"guildBanRemove"> = {
  name: "guildBanRemove",
  async execute(ban: GuildBan) {
    const config = await getLogConfig(ban.guild.id, "member");
    if (!config?.enabled) return;

    const embed = formatUnban(ban);
    await sendLogEmbed(ban.guild, config.channelId, embed);

    await createLogEntry({
      guildId: ban.guild.id,
      category: "member",
      eventType: "memberUnban",
      targetId: ban.user.id,
      content: {
        tag: ban.user.tag,
      },
    });
  },
};

export default event;
