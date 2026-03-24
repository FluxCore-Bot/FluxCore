import type { Event } from "@fluxcore/types";
import type { GuildMember, PartialGuildMember } from "discord.js";
import { getLogConfig, isIgnored } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatNicknameChange, formatRoleChange } from "@fluxcore/systems/logging/formatter";

const event: Event<"guildMemberUpdate"> = {
  name: "guildMemberUpdate",
  async execute(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ) {
    if (newMember.user.bot) return;

    const config = await getLogConfig(newMember.guild.id, "member");
    if (!config?.enabled) return;
    if (isIgnored(config, undefined, newMember.roles)) return;

    // Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      const embed = formatNicknameChange(newMember, oldMember.nickname ?? null, newMember.nickname);
      await sendLogEmbed(newMember.guild, config.channelId, embed);

      await createLogEntry({
        guildId: newMember.guild.id,
        category: "member",
        eventType: "memberNicknameChange",
        targetId: newMember.id,
        content: {
          before: oldMember.nickname,
          after: newMember.nickname,
        },
      });
    }

    // Role changes
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    const addedRoles = newRoles.filter((r) => !oldRoles.has(r.id)).map((r) => r.id);
    const removedRoles = oldRoles.filter((r) => !newRoles.has(r.id)).map((r) => r.id);

    if (addedRoles.length > 0 || removedRoles.length > 0) {
      const embed = formatRoleChange(newMember, addedRoles, removedRoles);
      await sendLogEmbed(newMember.guild, config.channelId, embed);

      await createLogEntry({
        guildId: newMember.guild.id,
        category: "member",
        eventType: "memberRoleChange",
        targetId: newMember.id,
        content: {
          addedRoles,
          removedRoles,
        },
      });
    }
  },
};

export default event;
