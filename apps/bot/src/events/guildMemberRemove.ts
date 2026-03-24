import type { Event } from "@fluxcore/types";
import type { GuildMember, PartialGuildMember } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatMemberLeave } from "@fluxcore/systems/logging/formatter";

const event: Event<"guildMemberRemove"> = {
  name: "guildMemberRemove",
  async execute(member: GuildMember | PartialGuildMember) {
    if (member.user.bot) return;

    const config = await getLogConfig(member.guild.id, "member");
    if (!config?.enabled) return;

    const embed = formatMemberLeave(member as GuildMember);
    await sendLogEmbed(member.guild, config.channelId, embed);

    const roles = member.roles.cache
      .filter((r) => r.id !== member.guild.id)
      .map((r) => r.id);

    await createLogEntry({
      guildId: member.guild.id,
      category: "member",
      eventType: "memberLeave",
      targetId: member.id,
      content: {
        tag: member.user.tag,
        roles,
        memberCount: member.guild.memberCount,
      },
    });
  },
};

export default event;
