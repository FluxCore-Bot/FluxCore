import type { Event } from "@fluxcore/types";
import type { GuildBan } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatBan } from "@fluxcore/systems/logging/formatter";

const event: Event<"guildBanAdd"> = {
  name: "guildBanAdd",
  async execute(ban: GuildBan) {
    const config = await getLogConfig(ban.guild.id, "member");
    if (!config?.enabled) return;

    const embed = formatBan(ban);
    await sendLogEmbed(ban.guild, config.channelId, embed);

    await createLogEntry({
      guildId: ban.guild.id,
      category: "member",
      eventType: "memberBan",
      targetId: ban.user.id,
      content: {
        tag: ban.user.tag,
        reason: ban.reason,
      },
    });
  },
};

export default event;
