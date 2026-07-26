import type { Event } from "@fluxcore/types";
import type { GuildMember, PartialGuildMember } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatMemberLeave } from "@fluxcore/systems/logging/formatter";
import { getWelcomeConfig } from "@fluxcore/systems/welcome/config";
import { deliverWelcomeMessage } from "@fluxcore/systems/welcome/send";

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
    // `member` is partial when Discord couldn't supply a full cache entry
    // (only possible if the client opts into GuildMember partials, which
    // this bot does not — kept as a type-safe guard rather than a cast).
    if (member.partial) return;

    const channel = member.guild.channels.cache.get(welcomeConfig.farewellChannelId);
    if (channel?.isTextBased() && channel.isSendable()) {
      await deliverWelcomeMessage({
        channel,
        member,
        style: welcomeConfig.farewellMessageStyle,
        content: welcomeConfig.farewellContent,
        embedConfig: welcomeConfig.farewellMessage,
        imageEnabled: welcomeConfig.farewellImageEnabled,
        imageSettings: welcomeConfig.farewellImageConfig,
        attachmentName: "farewell.png",
        label: "farewell",
      });
    }
  },
};

export default event;
