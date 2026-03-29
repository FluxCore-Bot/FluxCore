import type { Event } from "@fluxcore/types";
import type { GuildMember, PartialGuildMember } from "discord.js";
import { logger } from "@fluxcore/utils";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatMemberLeave } from "@fluxcore/systems/logging/formatter";
import { getWelcomeConfig } from "@fluxcore/systems/welcome/config";
import { buildWelcomeEmbed } from "@fluxcore/systems/welcome/builder";

const event: Event<"guildMemberRemove"> = {
  name: "guildMemberRemove",
  async execute(member: GuildMember | PartialGuildMember) {
    // === Logging ===
    if (!member.user.bot) {
      const config = await getLogConfig(member.guild.id, "member");
      if (config?.enabled) {
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
      }
    }

    // === Farewell ===
    const welcomeConfig = await getWelcomeConfig(member.guild.id);
    if (!welcomeConfig?.farewellEnabled || !welcomeConfig.farewellChannelId) return;

    const channel = member.guild.channels.cache.get(welcomeConfig.farewellChannelId);
    if (channel?.isTextBased()) {
      const embed = buildWelcomeEmbed(welcomeConfig.farewellMessage, member as GuildMember);
      await channel.send({ embeds: [embed] }).catch((err) => {
        logger.error(`Failed to send farewell message in guild ${member.guild.id}`, err instanceof Error ? err : new Error(String(err)));
      });
    }
  },
};

export default event;
