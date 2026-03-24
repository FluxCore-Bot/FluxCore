import type { Event } from "@fluxcore/types";
import type { GuildMember } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatMemberJoin } from "@fluxcore/systems/logging/formatter";

const event: Event<"guildMemberAdd"> = {
  name: "guildMemberAdd",
  async execute(member: GuildMember) {
    if (member.user.bot) return;

    const config = await getLogConfig(member.guild.id, "member");
    if (!config?.enabled) return;

    const embed = formatMemberJoin(member);
    await sendLogEmbed(member.guild, config.channelId, embed);

    const accountAge = Math.floor(
      (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24),
    );

    await createLogEntry({
      guildId: member.guild.id,
      category: "member",
      eventType: "memberJoin",
      targetId: member.id,
      content: {
        tag: member.user.tag,
        accountAgeDays: accountAge,
        memberCount: member.guild.memberCount,
      },
    });
  },
};

export default event;
